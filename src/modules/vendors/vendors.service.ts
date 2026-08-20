import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CloudinaryService } from '../../infrastructure/cloudinary/cloudinary.service';
import { MailService } from '../../infrastructure/mail/mail.service';
import { CheckInsService } from '../check-ins/check-ins.service';
import { AdminListQueryDto } from '../admin/dto/admin-list-query.dto';
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
    private readonly cloudinaryService: CloudinaryService,
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

  async getMyVendorQrCode(userId: string) {
    const vendor = await this.getMyVendorProfile(userId);
    const qrs = await this.checkInsService.ensureQrCodesForApprovedVendor(vendor.id);
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
        const contactPhone = dto.contact?.phoneNumber ?? '';

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
      throw new BadRequestException('Only image files are allowed for onboarding assets');
    }
  }
}
