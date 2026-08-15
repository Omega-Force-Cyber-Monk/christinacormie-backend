import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MailService } from '../../infrastructure/mail/mail.service';
import { CheckInsService } from '../check-ins/check-ins.service';
import { CompleteVendorOnboardingDto } from './dto/complete-vendor-onboarding.dto';
import { SubmitVerificationRequestDto } from './dto/submit-verification-request.dto';
import { UpdatePhotoShootRequestDto } from './dto/update-photo-shoot-request.dto';
import { VendorVerificationDocumentType } from './enums/vendor-verification-document-type.enum';
import { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto';
import {
  NON_TEXAS_VENDOR_DOCUMENT_REQUIREMENTS,
  TEXAS_STATES,
  TEXAS_VENDOR_DOCUMENT_REQUIREMENTS,
  VENDOR_DOCUMENT_SUBMISSION_CONFIRMATION,
} from './vendor-verification.constants';
import { VendorsRepository } from './vendors.repository';

@Injectable()
export class VendorsService {
  private readonly logger = new Logger(VendorsService.name);

  constructor(
    private readonly vendorsRepository: VendorsRepository,
    private readonly checkInsService: CheckInsService,
    private readonly mailService: MailService,
  ) {}

  async getMyVendorProfile(userId: string) {
    const vendor = await this.vendorsRepository.findByUserId(userId);

    if (!vendor) {
      throw new NotFoundException('Vendor profile not found');
    }

    return {
      ...vendor,
      verificationRequirements: this.getVerificationRequirements(vendor),
    };
  }

  async updateMyVendorProfile(userId: string, dto: UpdateVendorProfileDto) {
    const vendor = await this.getMyVendorProfile(userId);
    return this.vendorsRepository.updateProfile(vendor.id, dto);
  }

  async completeOnboarding(userId: string, dto: CompleteVendorOnboardingDto) {
    const vendor = await this.getMyVendorProfile(userId);
    const result = await this.vendorsRepository.completeOnboarding(
      userId,
      vendor.id,
      dto,
    );

    if (result.photoShootRequest) {
      try {
        const contactName = dto.contactName ?? dto.contact?.name ?? 'Vendor';
        const contactCity = dto.city ?? dto.contact?.city ?? dto.primaryCity ?? 'Austin';
        const contactEmail = dto.email ?? dto.contact?.email ?? '';
        const contactPhone = dto.phoneNumber ?? dto.phone ?? dto.contact?.phoneNumber ?? '';

        await this.mailService.send({
          to: process.env.VENDOR_REVIEW_NOTIFICATION_EMAIL || 'vendors@bitedropapp.com',
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
        this.logger.warn(`Failed to send photo shoot notification email: ${error.message}`);
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

  async submitVerificationRequest(userId: string, dto: SubmitVerificationRequestDto) {
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

    try {
      await this.mailService.send({
        to: process.env.VENDOR_REVIEW_NOTIFICATION_EMAIL || 'vendors@bitedropapp.com',
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
      this.logger.warn(`Failed to send vendor verification notification email: ${error.message}`);
    }

    return {
      ...result,
      message: VENDOR_DOCUMENT_SUBMISSION_CONFIRMATION,
      verificationRequirements: requirements,
    };
  }

  getPendingApprovalVendors() {
    return this.vendorsRepository.findPendingApproval();
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
    const qrCodes =
      await this.checkInsService.ensureQrCodesForApprovedVendor(vendor.id);

    return {
      vendor,
      qrCodes,
    };
  }

  async rejectVendor(vendorId: string, adminUserId: string, rejectionReason: string) {
    await this.ensureVendorExists(vendorId);
    return this.vendorsRepository.reject(vendorId, adminUserId, rejectionReason);
  }

  async getMyVendorAnalytics(userId: string) {
    const vendor = await this.getMyVendorProfile(userId);
    return this.vendorsRepository.getVendorAnalytics(vendor.id);
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
    const rawState = vendor.user?.profile?.state ?? vendor.market?.state ?? null;
    const normalizedState = this.normalizeState(rawState);
    const isTexasVendor = normalizedState ? TEXAS_STATES.has(normalizedState) : false;
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
}
