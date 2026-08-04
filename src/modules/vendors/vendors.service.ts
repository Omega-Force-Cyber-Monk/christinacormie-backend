import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SubmitVerificationRequestDto } from './dto/submit-verification-request.dto';
import { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto';
import { VendorsRepository } from './vendors.repository';

@Injectable()
export class VendorsService {
  constructor(private readonly vendorsRepository: VendorsRepository) {}

  async getMyVendorProfile(userId: string) {
    const vendor = await this.vendorsRepository.findByUserId(userId);

    if (!vendor) {
      throw new NotFoundException('Vendor profile not found');
    }

    return vendor;
  }

  async updateMyVendorProfile(userId: string, dto: UpdateVendorProfileDto) {
    const vendor = await this.getMyVendorProfile(userId);
    return this.vendorsRepository.updateProfile(vendor.id, dto);
  }

  async submitVerificationRequest(userId: string, dto: SubmitVerificationRequestDto) {
    const vendor = await this.getMyVendorProfile(userId);

    if (vendor.status === 'APPROVED') {
      throw new ForbiddenException('Approved vendors are already verified');
    }

    return this.vendorsRepository.submitVerificationRequest(
      vendor.id,
      dto.documents,
      dto.notes,
    );
  }

  getPendingApprovalVendors() {
    return this.vendorsRepository.findPendingApproval();
  }

  async approveVendor(vendorId: string, adminUserId: string) {
    await this.ensureVendorExists(vendorId);
    return this.vendorsRepository.approve(vendorId, adminUserId);
  }

  async rejectVendor(vendorId: string, adminUserId: string, rejectionReason: string) {
    await this.ensureVendorExists(vendorId);
    return this.vendorsRepository.reject(vendorId, adminUserId, rejectionReason);
  }

  private async ensureVendorExists(vendorId: string) {
    const vendor = await this.vendorsRepository.findById(vendorId);

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }
  }
}
