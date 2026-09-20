import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { VendorPlan } from '@prisma/client';
import { AccountStatus } from '../../common/enums/account-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { CloudinaryService } from '../../infrastructure/cloudinary/cloudinary.service';
import { MailService } from '../../infrastructure/mail/mail.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CheckInsService } from '../check-ins/check-ins.service';
import { AdminListQueryDto } from '../admin/dto/admin-list-query.dto';
import { NotificationEventType } from '../notifications/enums/notification-event-type.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { CompleteVendorOnboardingDto } from './dto/complete-vendor-onboarding.dto';
import { CreateVendorStaffDto } from './dto/create-vendor-staff.dto';
import { ResetVendorStaffPinDto } from './dto/reset-vendor-staff-pin.dto';
import { SubmitVerificationRequestDto } from './dto/submit-verification-request.dto';
import { UpdateCreditSettingsDto } from './dto/update-credit-settings.dto';
import { UpdatePhotoShootRequestDto } from './dto/update-photo-shoot-request.dto';
import { VendorVerificationDocumentType } from './enums/vendor-verification-document-type.enum';
import { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto';
import { VendorCreditAnalyticsQueryDto } from './dto/vendor-credit-analytics-query.dto';
import { assertVendorPlanFeature } from './vendor-plan-access';
import {
  DEFAULT_VENDOR_FOUNDING_OFFER,
  VENDOR_FOUNDING_OFFER_SETTING_KEY,
  VENDOR_PLAN_CONFIG,
  type VendorFoundingOfferConfig,
} from './vendor-plan.config';
import {
  NON_TEXAS_VENDOR_DOCUMENT_REQUIREMENTS,
  TEXAS_STATES,
  TEXAS_VENDOR_DOCUMENT_REQUIREMENTS,
  VENDOR_DOCUMENT_SUBMISSION_CONFIRMATION,
} from './vendor-verification.constants';
import { VendorsRepository } from './vendors.repository';

const STAFF_PIN_SALT_ROUNDS = 12;

@Injectable()
export class VendorsService {
  private readonly logger = new Logger(VendorsService.name);
  private readonly vendorApprovalMessage =
    'Vendor account is not approved yet. Please complete onboarding and submit verification documents for admin review.';

  constructor(
    private readonly vendorsRepository: VendorsRepository,
    private readonly prisma: PrismaService,
    private readonly checkInsService: CheckInsService,
    private readonly mailService: MailService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getMyVendorProfile(userId: string) {
    const vendor = await this.findVendorForActor(userId);

    if (!vendor) {
      throw new NotFoundException('Vendor profile not found');
    }

    return {
      ...vendor,
      verificationRequirements: this.getVerificationRequirements(vendor),
    };
  }

  async listVendorPlans() {
    const foundingOffer = await this.getFoundingOfferConfig();
    const tiers = await this.prisma.vendorSubscriptionTier.findMany({
      where: { active: true, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const now = new Date();
    const isActiveNow = this.isFoundingOfferActive(foundingOffer, now);

    return {
      foundingOffer: {
        ...foundingOffer,
        isActiveNow,
        displayText: isActiveNow
          ? 'Founding vendor offer available August 5 – October 4, 2026'
          : 'Standard pricing applies',
      },
      trial: {
        freeTrialMonths: foundingOffer.freeTrialMonths,
        foundingDiscountPercent: foundingOffer.subscriptionDiscountPercent,
        foundingDiscountMonths: foundingOffer.subscriptionDiscountMonths,
      },
      plans: tiers.map((tier) => this.formatSubscriptionTier(tier)),
    };
  }

  async getMyVendorQrCode(userId: string) {
    const vendor = await this.getMyVendorProfile(userId);
    this.ensureVendorApproved(vendor);

    const qrs = await this.checkInsService.ensureQrCodesForApprovedVendor(
      vendor.id,
    );
    const primaryQr = qrs[0];

    return {
      vendorId: vendor.id,
      businessName: vendor.businessName,
      foodTruckId: primaryQr?.foodTruckId ?? null,
      qrCode: primaryQr?.code ?? null,
      qrCodeUrl: primaryQr ? `/api/v1/qr/${primaryQr.code}/profile` : null,
      downloadUrl: primaryQr?.qrImageUrl ?? null,
      shareMessage: `Scan our BiteDrop QR code at ${vendor.businessName} to check in and earn rewards!`,
    };
  }

  async listStaff(userId: string) {
    const vendor = await this.getVendorOwnerProfile(userId);
    this.ensureVendorApproved(vendor);

    const staff = await this.prisma.vendorStaff.findMany({
      where: {
        vendorId: vendor.id,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: staff.map((item) => this.toStaffResponse(item)),
    };
  }

  async addStaff(userId: string, dto: CreateVendorStaffDto) {
    const vendor = await this.getVendorOwnerProfile(userId);
    this.ensureVendorApproved(vendor);
    const planConfig = assertVendorPlanFeature(vendor, 'STAFF_ACCOUNTS');
    const activeStaffCount = await this.prisma.vendorStaff.count({
      where: {
        vendorId: vendor.id,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });

    if (activeStaffCount >= planConfig.maxStaffAccounts) {
      throw new ForbiddenException(
        `${planConfig.name} plan allows ${planConfig.maxStaffAccounts} staff account${planConfig.maxStaffAccounts === 1 ? '' : 's'}. Upgrade your plan to add more staff.`,
      );
    }

    const email = dto.email.trim().toLowerCase();
    const pin = dto.pin.trim();

    const existingForVendor = await this.prisma.vendorStaff.findUnique({
      where: {
        vendorId_email: {
          vendorId: vendor.id,
          email,
        },
      },
    });

    if (existingForVendor && !existingForVendor.deletedAt) {
      throw new ConflictException(
        'Staff member already exists for this vendor',
      );
    }

    let staffUser = await this.prisma.user.findFirst({
      where: { email },
      include: { userRoles: true },
    });

    if (staffUser?.deletedAt) {
      throw new BadRequestException(
        'This email belongs to a deleted account and cannot be used for staff',
      );
    }

    if (
      staffUser &&
      [AccountStatus.SUSPENDED, AccountStatus.BLOCKED].includes(
        staffUser.status as AccountStatus,
      )
    ) {
      throw new BadRequestException(
        'This email belongs to an account that cannot be used for staff',
      );
    }

    const existingStaffForUser = staffUser
      ? await this.prisma.vendorStaff.findUnique({
          where: { userId: staffUser.id },
        })
      : null;

    if (
      existingStaffForUser &&
      existingStaffForUser.vendorId !== vendor.id &&
      !existingStaffForUser.deletedAt
    ) {
      throw new ConflictException(
        'This email is already assigned as staff for another vendor',
      );
    }

    const pinHash = await bcrypt.hash(pin, STAFF_PIN_SALT_ROUNDS);
    const pinEncrypted = this.encryptStaffPin(pin);

    const staff = await this.prisma.$transaction(async (tx) => {
      if (!staffUser) {
        staffUser = await tx.user.create({
          data: {
            email,
            status: AccountStatus.ACTIVE,
            emailVerifiedAt: new Date(),
            profile: {
              create: {
                displayName: email.split('@')[0],
              },
            },
            userRoles: {
              create: {
                role: UserRole.VENDOR_STAFF,
              },
            },
          },
          include: { userRoles: true },
        });
      } else {
        await tx.user.update({
          where: { id: staffUser.id },
          data: {
            status:
              staffUser.status === AccountStatus.PENDING
                ? AccountStatus.ACTIVE
                : staffUser.status,
            emailVerifiedAt: staffUser.emailVerifiedAt ?? new Date(),
          },
        });

        await tx.userRoleAssignment.upsert({
          where: {
            userId_role: {
              userId: staffUser.id,
              role: UserRole.VENDOR_STAFF,
            },
          },
          create: {
            userId: staffUser.id,
            role: UserRole.VENDOR_STAFF,
          },
          update: {},
        });
      }

      const staffData = {
        vendorId: vendor.id,
        userId: staffUser.id,
        email,
        pinHash,
        pinEncrypted,
        status: 'ACTIVE' as const,
        deletedAt: null,
        updatedAt: new Date(),
      };

      if (existingForVendor) {
        return tx.vendorStaff.update({
          where: { id: existingForVendor.id },
          data: staffData,
        });
      }

      if (existingStaffForUser) {
        return tx.vendorStaff.update({
          where: { id: existingStaffForUser.id },
          data: staffData,
        });
      }

      return tx.vendorStaff.create({
        data: staffData,
      });
    });

    await this.sendStaffPinEmail(email, vendor.businessName, pin, false);

    return {
      ...this.toStaffResponse(staff),
      message: 'Staff account created and PIN sent to email',
    };
  }

  async resetStaffPin(
    userId: string,
    staffId: string,
    dto: ResetVendorStaffPinDto,
  ) {
    const vendor = await this.getVendorOwnerProfile(userId);
    this.ensureVendorApproved(vendor);
    const staff = await this.prisma.vendorStaff.findFirst({
      where: {
        id: staffId,
        vendorId: vendor.id,
        deletedAt: null,
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    const pin = dto.pin.trim();
    const updated = await this.prisma.vendorStaff.update({
      where: { id: staff.id },
      data: {
        pinHash: await bcrypt.hash(pin, STAFF_PIN_SALT_ROUNDS),
        pinEncrypted: this.encryptStaffPin(pin),
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
    });

    await this.sendStaffPinEmail(staff.email, vendor.businessName, pin, true);

    return {
      ...this.toStaffResponse(updated),
      message: 'Staff PIN reset successfully and sent to email',
    };
  }

  async deleteStaff(userId: string, staffId: string) {
    const vendor = await this.getVendorOwnerProfile(userId);
    this.ensureVendorApproved(vendor);
    const staff = await this.prisma.vendorStaff.findFirst({
      where: {
        id: staffId,
        vendorId: vendor.id,
        deletedAt: null,
      },
      include: {
        user: {
          include: { userRoles: true },
        },
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.vendorStaff.delete({ where: { id: staff.id } });
      await tx.userRoleAssignment.deleteMany({
        where: {
          userId: staff.userId,
          role: UserRole.VENDOR_STAFF,
        },
      });

      const remainingRoles = staff.user.userRoles.filter(
        (item) => item.role !== UserRole.VENDOR_STAFF,
      );

      if (remainingRoles.length === 0) {
        await tx.deviceToken.deleteMany({ where: { userId: staff.userId } });
        await tx.refreshToken.deleteMany({ where: { userId: staff.userId } });
        await tx.userProfile.deleteMany({ where: { userId: staff.userId } });
        await tx.userSetting.deleteMany({ where: { userId: staff.userId } });
        await tx.user.delete({ where: { id: staff.userId } });
      }
    });

    return {
      deleted: true,
      message: 'Staff member deleted successfully',
    };
  }

  async updateMyVendorProfile(userId: string, dto: UpdateVendorProfileDto) {
    const vendor = await this.getMyVendorProfile(userId);
    return this.vendorsRepository.updateProfile(vendor.id, dto);
  }

  async completeOnboarding(userId: string, dto: CompleteVendorOnboardingDto) {
    const vendor = await this.getMyVendorProfile(userId);
    const foundingData = await this.resolveFoundingData(
      dto.selectedPlan ?? dto.plan ?? VendorPlan.FREE,
      dto.claimFoundingMember === true,
      vendor,
    );
    const result = await this.vendorsRepository.completeOnboarding(
      userId,
      vendor.id,
      dto,
      foundingData,
    );

    if (result.photoShootRequest) {
      try {
        const contactName = dto.contactName ?? dto.contact?.name ?? 'Vendor';
        const contactCity =
          dto.city ?? dto.contact?.city ?? dto.primaryCity ?? 'Austin';
        const contactEmail = dto.email ?? dto.contact?.email ?? '';
        const contactPhone = dto.contact?.phoneNumber ?? '';

        await this.mailService.send({
          to:
            process.env.VENDOR_REVIEW_NOTIFICATION_EMAIL ||
            'vendors@bitedropapp.com',
          subject: `Photo shoot requested: ${dto.truckName}`,
          text: [
            `Vendor: ${contactName}`,
            `Truck: ${dto.truckName}`,
            `City: ${contactCity}`,
            `Email: ${contactEmail}`,
            `Phone: ${contactPhone}`,
            `Request ID: ${result.photoShootRequest.id}`,
          ].join('\n'),
        });
      } catch (error) {
        this.logger.warn(
          `Failed to send photo shoot notification email: ${error.message}`,
        );
      }
    }

    return {
      ...result,
      message: 'Vendor onboarding saved successfully.',
      photoShootMessage: result.photoShootRequest
        ? 'Thank you. Our team will contact you about professional photos shortly.'
        : null,
    };
  }

  private async resolveFoundingData(
    selectedPlan: VendorPlan,
    claimFoundingMember: boolean,
    existingVendor: any,
  ) {
    const foundingOffer = await this.getFoundingOfferConfig();
    const now = new Date();
    const trialStartedAt = existingVendor.trialStartedAt ?? now;
    const trialEndsAt =
      existingVendor.trialEndsAt ??
      this.addMonths(trialStartedAt, foundingOffer.freeTrialMonths);
    const existingFoundingJoinedAt = existingVendor.foundingJoinedAt ?? now;

    if (existingVendor.isFoundingMember) {
      return {
        isFoundingMember: true,
        foundingJoinedAt: existingFoundingJoinedAt,
        trialStartedAt,
        trialEndsAt,
        foundingDiscountEndsAt:
          existingVendor.foundingDiscountEndsAt ??
          this.addMonths(existingFoundingJoinedAt, 12),
        lockedCommissionRate:
          VENDOR_PLAN_CONFIG[selectedPlan].foundingCommissionRate,
      };
    }

    if (!claimFoundingMember) {
      return {
        isFoundingMember: false,
        foundingJoinedAt: null,
        trialStartedAt,
        trialEndsAt,
        foundingDiscountEndsAt: null,
        lockedCommissionRate: null,
      };
    }

    if (!this.isFoundingOfferActive(foundingOffer, now)) {
      throw new BadRequestException(
        'Founding member offer ended on October 4, 2026. Standard pricing applies from October 5, 2026.',
      );
    }

    const planConfig = VENDOR_PLAN_CONFIG[selectedPlan];

    return {
      isFoundingMember: true,
      foundingJoinedAt: now,
      trialStartedAt,
      trialEndsAt,
      foundingDiscountEndsAt: this.addMonths(now, 12),
      lockedCommissionRate: planConfig.foundingCommissionRate,
    };
  }

  private async getFoundingOfferConfig(): Promise<VendorFoundingOfferConfig> {
    const setting = await this.prisma.platformSetting.findUnique({
      where: { key: VENDOR_FOUNDING_OFFER_SETTING_KEY },
    });
    const value =
      setting?.value && typeof setting.value === 'object'
        ? (setting.value as Partial<VendorFoundingOfferConfig>)
        : {};

    return {
      ...DEFAULT_VENDOR_FOUNDING_OFFER,
      ...value,
    };
  }

  private formatSubscriptionTier(tier: any) {
    return {
      id: tier.id,
      code: tier.code,
      plan: tier.legacyPlan,
      name: tier.name,
      subtitle: tier.subtitle,
      badge: tier.badge,
      monthlyPriceCents: tier.monthlyPriceCents,
      foundingMonthlyPriceCentsAfterTrial:
        tier.foundingMonthlyPriceCentsAfterTrial,
      normalCommissionRate: tier.normalCommissionRate,
      foundingCommissionRate: tier.foundingCommissionRate,
      bookingEnabled: tier.bookingEnabled,
      maxStaffAccounts: tier.maxStaffAccounts,
      maxIncludedTrucks: tier.maxIncludedTrucks,
      additionalTruckMonthlyPriceCents: tier.additionalTruckMonthlyPriceCents,
      analyticsLevel: tier.analyticsLevel,
      trialDays: tier.trialDays,
      features: tier.features,
      included: tier.included,
      notIncluded: tier.notIncluded,
      active: tier.active,
    };
  }

  private isFoundingOfferActive(
    config: VendorFoundingOfferConfig,
    now: Date,
  ) {
    if (!config.enabled) {
      return false;
    }

    return now >= new Date(config.startAt) && now <= new Date(config.endAt);
  }

  private addMonths(date: Date, months: number) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  async submitVerificationRequest(
    userId: string,
    dto: SubmitVerificationRequestDto,
  ) {
    const vendor = await this.getMyVendorProfile(userId);

    if (vendor.status === 'APPROVED') {
      throw new ForbiddenException('Approved vendors are already verified');
    }

    const requirements = this.getVerificationRequirements(vendor);

    if (!requirements.state) {
      throw new BadRequestException(
        'Vendor state is required before submitting verification documents',
      );
    }

    this.validateRequiredDocuments(dto, requirements.requiredDocumentTypes);

    const result = await this.vendorsRepository.submitVerificationRequest(
      vendor.id,
      dto.documents,
      dto.notes,
    );

    await this.notificationsService.notifyAdmins({
      actorUserId: userId,
      title: 'Vendor verification submitted',
      message: `${vendor.businessName} submitted documents for admin review.`,
      actionUrl: `/api/v1/admin/vendors/${vendor.id}`,
      priority: 'HIGH',
      metadata: {
        eventType: NotificationEventType.VENDOR_VERIFICATION_SUBMITTED,
        vendorId: vendor.id,
        verificationRequestId: result.verificationRequest.id,
      },
      pushData: {
        eventType: NotificationEventType.VENDOR_VERIFICATION_SUBMITTED,
        vendorId: vendor.id,
        verificationRequestId: result.verificationRequest.id,
      },
    });

    try {
      await this.mailService.send({
        to:
          process.env.VENDOR_REVIEW_NOTIFICATION_EMAIL ||
          'vendors@bitedropapp.com',
        subject: `Vendor verification submitted: ${vendor.businessName}`,
        text: [
          `Vendor: ${vendor.businessName}`,
          `Vendor ID: ${vendor.id}`,
          `State: ${requirements.state}`,
          `Requirement set: ${requirements.requirementSet}`,
          `Submitted document types: ${dto.documents.map((document) => document.type).join(', ')}`,
          dto.notes ? `Notes: ${dto.notes}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send vendor verification notification email: ${error.message}`,
      );
    }

    return {
      ...result,
      message: VENDOR_DOCUMENT_SUBMISSION_CONFIRMATION,
      verificationRequirements: requirements,
    };
  }

  getPendingApprovalVendors(query: AdminListQueryDto) {
    return this.vendorsRepository.findPendingApproval(query);
  }

  getPhotoShootRequests() {
    return this.vendorsRepository.findPhotoShootRequests();
  }

  async updatePhotoShootRequest(
    requestId: string,
    dto: UpdatePhotoShootRequestDto,
  ) {
    return this.vendorsRepository.updatePhotoShootRequest(requestId, dto);
  }

  async approveVendor(vendorId: string, adminUserId: string) {
    await this.ensureVendorExists(vendorId);
    const vendor = await this.vendorsRepository.approve(vendorId, adminUserId);
    const qrCodes = await this.checkInsService.ensureQrCodesForApprovedVendor(
      vendor.id,
    );

    return {
      vendor,
      qrCodes,
    };
  }

  async rejectVendor(
    vendorId: string,
    adminUserId: string,
    rejectionReason: string,
  ) {
    await this.ensureVendorExists(vendorId);
    return this.vendorsRepository.reject(
      vendorId,
      adminUserId,
      rejectionReason,
    );
  }

  async getMyVendorAnalytics(userId: string) {
    const vendor = await this.getMyVendorProfile(userId);
    this.ensureVendorApproved(vendor);
    assertVendorPlanFeature(vendor, 'BASIC_ANALYTICS');

    return this.vendorsRepository.getVendorAnalytics(vendor.id);
  }

  async getMyCreditAnalytics(
    userId: string,
    query: VendorCreditAnalyticsQueryDto,
  ) {
    const vendor = await this.getMyVendorProfile(userId);
    this.ensureVendorApproved(vendor);
    assertVendorPlanFeature(vendor, 'BASIC_ANALYTICS');
    assertVendorPlanFeature(vendor, 'REWARDS');

    const range = query.range ?? 'week';
    const { start, end, previousStart, previousEnd, days } =
      this.creditAnalyticsRange(range);

    const foodTrucks = await this.vendorsRepository.findActiveFoodTruckIds(
      vendor.id,
      query.foodTruckId,
    );

    if (query.foodTruckId && !foodTrucks.length) {
      throw new ForbiddenException('Food truck does not belong to this vendor');
    }

    const foodTruckIds = foodTrucks.map((truck) => truck.id);
    const monthStart = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1),
    );

    const [
      qrRows,
      totalFollowers,
      followersThisMonth,
      followerRows,
      topLocationRows,
      redemptionSummary,
      recentRedemptions,
    ] = await Promise.all([
      this.vendorsRepository.getQrScanDailyChart(foodTruckIds, start, end),
      this.vendorsRepository.countFollowers(foodTruckIds),
      this.vendorsRepository.countFollowersSince(foodTruckIds, monthStart),
      this.vendorsRepository.getFollowerWeeklyChart(foodTruckIds, start, end),
      this.vendorsRepository.getTopScanLocations(foodTruckIds, start, end),
      this.vendorsRepository.getCreditRedemptionSummary(
        vendor.id,
        start,
        end,
        previousStart,
        previousEnd,
      ),
      this.vendorsRepository.findRecentCreditRedemptions(vendor.id, 5),
    ]);

    const qrChart = this.buildDailyChart(qrRows, start, days);
    const followerChart = this.buildFollowerChart(
      followerRows,
      totalFollowers,
      followersThisMonth,
      range,
    );
    const changeVsLastWeekPercent = this.percentChange(
      redemptionSummary.currentCount,
      redemptionSummary.previousCount,
    );

    return {
      creditAcceptance: this.presentCreditAcceptance(vendor),
      qrScans: {
        totalThisWeek: qrChart.reduce((sum, item) => sum + item.count, 0),
        chart: qrChart,
      },
      followers: {
        total: totalFollowers,
        changeThisMonth: followersThisMonth,
        chart: followerChart,
      },
      topDropLocations: topLocationRows.map((row) => {
        const latitude =
          row.latitude === null ? null : Number(row.latitude);
        const longitude =
          row.longitude === null ? null : Number(row.longitude);

        return {
          label:
            latitude === null || longitude === null
              ? 'Unknown location'
              : `Lat ${latitude.toFixed(2)}, Lng ${longitude.toFixed(2)}`,
          scanCount: Number(row.scanCount),
          latitude,
          longitude,
        };
      }),
      creditRedemptions: {
        totalRedeemedCount: redemptionSummary.currentCount,
        totalCreditApplied: redemptionSummary.currentCredit,
        averagePerDay:
          days === 0
            ? 0
            : Number((redemptionSummary.currentCount / days).toFixed(1)),
        changeVsLastWeekPercent,
        recent: recentRedemptions.map((redemption) => ({
          id: redemption.id,
          customerName: this.userDisplayName(redemption.user),
          method: redemption.redemptionMethod ?? 'UNKNOWN',
          amount: Number(redemption.rewardValue ?? 0),
          createdAt: redemption.usedAt ?? redemption.redeemedAt,
        })),
      },
    };
  }

  async updateMyCreditSettings(
    userId: string,
    dto: UpdateCreditSettingsDto,
  ) {
    const vendor = await this.getVendorOwnerProfile(userId);
    this.ensureVendorApproved(vendor);
    assertVendorPlanFeature(vendor, 'REWARDS');

    const updated = await this.vendorsRepository.updateCreditSettings(
      vendor.id,
      dto.creditAcceptanceEnabled,
    );

    return {
      message: 'Credit acceptance updated successfully',
      creditAcceptance: this.presentCreditAcceptance(updated),
    };
  }

  async uploadOnboardingAsset(userId: string, file: Express.Multer.File) {
    await this.getMyVendorProfile(userId);
    this.ensureCloudinaryReady();
    this.ensureFileProvided(file);
    this.ensureImageFile(file);

    const upload = await this.cloudinaryService.uploadBuffer(file.buffer, {
      folder: 'bitedrop/vendors/onboarding',
      resourceType: 'image',
    });

    return {
      url: upload.secure_url,
      publicId: upload.public_id,
      width: upload.width,
      height: upload.height,
      format: upload.format,
      resourceType: upload.resource_type,
      originalFilename: file.originalname,
    };
  }

  async uploadVerificationDocument(userId: string, file: Express.Multer.File) {
    const vendor = await this.getMyVendorProfile(userId);
    this.ensureCloudinaryReady();
    this.ensureFileProvided(file);

    const upload = await this.cloudinaryService.uploadBuffer(file.buffer, {
      folder: `bitedrop/vendors/${vendor.id}/verification-documents`,
      resourceType: 'raw',
    });

    return {
      url: upload.secure_url,
      publicId: upload.public_id,
      format: upload.format,
      bytes: upload.bytes,
      resourceType: upload.resource_type,
      originalFilename: file.originalname,
    };
  }

  private async ensureVendorExists(vendorId: string) {
    const vendor = await this.vendorsRepository.findById(vendorId);

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }
  }

  private validateRequiredDocuments(
    dto: SubmitVerificationRequestDto,
    requiredDocumentTypes: VendorVerificationDocumentType[],
  ) {
    const submittedTypes = dto.documents.map((document) => document.type);
    const uniqueSubmittedTypes = new Set(submittedTypes);

    if (uniqueSubmittedTypes.size !== submittedTypes.length) {
      throw new BadRequestException(
        'Duplicate verification document types are not allowed',
      );
    }

    const missingDocumentTypes = requiredDocumentTypes.filter(
      (type) => !uniqueSubmittedTypes.has(type),
    );

    if (missingDocumentTypes.length > 0) {
      throw new BadRequestException(
        `Missing required verification documents: ${missingDocumentTypes.join(', ')}`,
      );
    }
  }

  private getVerificationRequirements(vendor: any) {
    const rawState =
      vendor.user?.profile?.state ?? vendor.market?.state ?? null;
    const normalizedState = this.normalizeState(rawState);
    const isTexasVendor = normalizedState
      ? TEXAS_STATES.has(normalizedState)
      : false;
    const requirements = isTexasVendor
      ? TEXAS_VENDOR_DOCUMENT_REQUIREMENTS
      : NON_TEXAS_VENDOR_DOCUMENT_REQUIREMENTS;

    return {
      state: rawState,
      normalizedState,
      requirementSet: isTexasVendor ? 'TEXAS' : 'NON_TEXAS',
      requiredDocumentTypes: requirements.map((item) => item.type),
      requiredDocuments: requirements,
      confirmationMessage: VENDOR_DOCUMENT_SUBMISSION_CONFIRMATION,
      pendingUntilApproved: true,
    };
  }

  private normalizeState(state: string | null | undefined) {
    if (!state) {
      return null;
    }

    return state.trim().toUpperCase();
  }

  private async getVendorOwnerProfile(userId: string) {
    const vendor = await this.vendorsRepository.findByUserId(userId);

    if (!vendor) {
      throw new NotFoundException('Vendor profile not found');
    }

    return vendor;
  }

  private async findVendorForActor(userId: string) {
    const ownerVendor = await this.vendorsRepository.findByUserId(userId);

    if (ownerVendor) {
      return ownerVendor;
    }

    const staff = await this.prisma.vendorStaff.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: {
        vendor: {
          include: this.vendorsRepository.vendorInclude(),
        },
      },
    });

    return staff?.vendor ?? null;
  }

  private toStaffResponse(staff: {
    id: string;
    email: string;
    pinEncrypted: string;
    status: string;
    createdAt: Date;
  }) {
    return {
      id: staff.id,
      email: staff.email,
      pin: this.decryptStaffPin(staff.pinEncrypted),
      status: staff.status,
      addedAt: staff.createdAt,
    };
  }

  private async sendStaffPinEmail(
    email: string,
    businessName: string,
    pin: string,
    isReset: boolean,
  ) {
    const subject = isReset
      ? 'Your BiteDrop staff PIN was reset'
      : 'Your BiteDrop staff PIN';
    const text = isReset
      ? `Your new staff login PIN is ${pin}.`
      : `You have been added as staff for ${businessName}. Your login PIN is ${pin}.`;

    try {
      await this.mailService.send({
        to: email,
        subject,
        text,
        html: `<p>${text}</p>`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown email delivery error';
      this.logger.error(
        `Failed to deliver staff PIN email to ${email}: ${message}`,
      );
    }
  }

  private encryptStaffPin(pin: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.staffPinKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(pin, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  private decryptStaffPin(value: string) {
    const [ivValue, tagValue, encryptedValue] = value.split(':');

    if (!ivValue || !tagValue || !encryptedValue) {
      return '';
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.staffPinKey(),
      Buffer.from(ivValue, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagValue, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  private staffPinKey() {
    return createHash('sha256')
      .update(
        process.env.STAFF_PIN_ENCRYPTION_SECRET ??
          process.env.JWT_ACCESS_SECRET ??
          'dev-staff-pin-secret-change-me',
      )
      .digest();
  }

  private ensureVendorApproved(vendor: {
    status?: string;
    isVerified?: boolean;
  }) {
    if (vendor.status !== 'APPROVED' || !vendor.isVerified) {
      throw new ForbiddenException(this.vendorApprovalMessage);
    }
  }

  private presentCreditAcceptance(vendor: {
    creditAcceptanceEnabled?: boolean | null;
    creditAcceptanceUpdatedAt?: Date | null;
  }) {
    const enabled = vendor.creditAcceptanceEnabled !== false;

    return {
      enabled,
      statusLabel: enabled ? 'Currently Accepting' : 'Not Accepting',
      updatedAt: vendor.creditAcceptanceUpdatedAt ?? null,
    };
  }

  private creditAnalyticsRange(range: 'week' | 'month') {
    const now = new Date();
    const end = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
      ),
    );
    const days = range === 'month' ? 28 : 7;
    const start = new Date(end);
    start.setUTCDate(end.getUTCDate() - days);
    const previousEnd = new Date(start);
    const previousStart = new Date(previousEnd);
    previousStart.setUTCDate(previousEnd.getUTCDate() - days);

    return { start, end, previousStart, previousEnd, days };
  }

  private buildDailyChart(
    rows: Array<{ dayIndex: number; count: bigint }>,
    start: Date,
    days: number,
  ) {
    const counts = new Map(
      rows.map((row) => [Number(row.dayIndex), Number(row.count)]),
    );
    const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return Array.from({ length: days }, (_, index) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + index);

      return {
        label:
          days === 7
            ? weekdayLabels[date.getUTCDay()]
            : `${date.getUTCMonth() + 1}/${date.getUTCDate()}`,
        count: counts.get(index) ?? 0,
      };
    });
  }

  private buildFollowerChart(
    rows: Array<{ weekIndex: number; count: bigint }>,
    totalFollowers: number,
    followersThisMonth: number,
    range: 'week' | 'month',
  ) {
    const buckets = range === 'month' ? 4 : 1;
    const newFollowerCounts = new Map(
      rows.map((row) => [Number(row.weekIndex), Number(row.count)]),
    );
    let runningTotal = Math.max(totalFollowers - followersThisMonth, 0);

    return Array.from({ length: buckets }, (_, index) => {
      runningTotal += newFollowerCounts.get(index) ?? 0;

      return {
        label: `W${index + 1}`,
        count: runningTotal,
      };
    });
  }

  private percentChange(current: number, previous: number) {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }

    return Number((((current - previous) / previous) * 100).toFixed(1));
  }

  private userDisplayName(user: any) {
    const profile = user?.profile;
    const fullName = [profile?.firstName, profile?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    return profile?.displayName || fullName || user?.email || 'Customer';
  }

  private ensureCloudinaryReady() {
    if (!this.cloudinaryService.isConfigured()) {
      throw new BadRequestException(
        'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
      );
    }
  }

  private ensureFileProvided(file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File upload is required');
    }
  }

  private ensureImageFile(file: Express.Multer.File) {
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException(
        'Only image files are allowed for onboarding assets',
      );
    }
  }
}
