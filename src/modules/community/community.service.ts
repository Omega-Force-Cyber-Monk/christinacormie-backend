import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommentRequestDto } from './dto/comment-request.dto';
import { CreateCommunityRequestDto } from './dto/create-community-request.dto';
import { CreateVendorOfferDto } from './dto/create-vendor-offer.dto';
import { NewFoodTruckLeadDto } from './dto/new-food-truck-lead.dto';
import { ReactRequestDto } from './dto/react-request.dto';
import { RequestMediaDto } from './dto/request-media.dto';
import { CommunityRepository } from './community.repository';

@Injectable()
export class CommunityService {
  constructor(private readonly communityRepository: CommunityRepository) {}

  async createPublicRequest(userId: string, dto: CreateCommunityRequestDto) {
    this.validateRequestDto(dto);
    return this.communityRepository.createRequest(userId, dto, 'PUBLIC');
  }

  listOpenRequests() {
    return this.communityRepository.listOpenRequests();
  }

  listMyRequests(userId: string) {
    return this.communityRepository.listMyRequests(userId);
  }

  async getRequestDetails(userId: string, requestId: string) {
    return this.ensureRequestVisible(userId, requestId);
  }

  async listRequestOffers(
    userId: string,
    requestId: string,
    sort: 'LOW_PRICE' | 'HIGH_RATED' | 'RECENT' = 'RECENT',
  ) {
    await this.ensureRequestVisible(userId, requestId);
    return this.communityRepository.listOffersForRequest(requestId, sort);
  }

  async createPrivateTruckRequest(
    userId: string,
    foodTruckId: string,
    dto: CreateCommunityRequestDto,
  ) {
    await this.ensureFoodTruckExists(foodTruckId);
    this.validateRequestDto(dto);

    return this.communityRepository.createRequest(
      userId,
      dto,
      'PRIVATE',
      foodTruckId,
    );
  }

  async addRequestMedia(
    userId: string,
    requestId: string,
    dto: RequestMediaDto,
  ) {
    const request = await this.ensureRequestExists(requestId);

    if (request.createdById !== userId) {
      throw new ForbiddenException('Only the request owner can add media');
    }

    return this.communityRepository.addRequestMedia(requestId, dto);
  }

  async commentOnRequest(
    userId: string,
    requestId: string,
    dto: CommentRequestDto,
  ) {
    const request = await this.ensureRequestVisible(userId, requestId);

    if (!request.allowPublicComments && request.createdById !== userId) {
      await this.ensureTargetVendorUser(userId, request);
    }

    if (dto.parentCommentId) {
      const parentComment = await this.communityRepository.findCommentById(
        dto.parentCommentId,
      );

      if (!parentComment || parentComment.communityRequestId !== requestId) {
        throw new NotFoundException('Parent comment not found');
      }
    }

    return this.communityRepository.createComment(requestId, userId, dto);
  }

  async reactToRequest(userId: string, requestId: string, dto: ReactRequestDto) {
    await this.ensureRequestVisible(userId, requestId);
    return this.communityRepository.reactToRequest(requestId, userId, dto);
  }

  async createVendorOffer(
    userId: string,
    requestId: string,
    dto: CreateVendorOfferDto,
  ) {
    const vendor = await this.ensureVendor(userId);
    const request = await this.ensureRequestExists(requestId);
    const foodTruck = await this.ensureFoodTruckExists(dto.foodTruckId);

    if (foodTruck.vendorId !== vendor.id) {
      throw new ForbiddenException('Food truck does not belong to this vendor');
    }

    if (request.status !== 'OPEN') {
      throw new BadRequestException('Request is not open for offers');
    }

    if (request.expiresAt && request.expiresAt < new Date()) {
      throw new BadRequestException('Request has expired');
    }

    if (
      request.visibility === 'PRIVATE' &&
      request.targetFoodTruckId !== dto.foodTruckId
    ) {
      throw new ForbiddenException('This private request targets another truck');
    }

    this.validateOfferDto(dto);

    return this.communityRepository.createVendorOffer(vendor.id, requestId, dto);
  }

  async acceptOffer(userId: string, offerId: string) {
    const offer = await this.ensureOfferExists(offerId);

    if (offer.communityRequest.createdById !== userId) {
      throw new ForbiddenException('Only the request owner can accept offers');
    }

    if (offer.status !== 'PENDING') {
      throw new BadRequestException('Offer is not pending');
    }

    if (offer.expiresAt && offer.expiresAt < new Date()) {
      throw new BadRequestException('Offer has expired');
    }

    return this.communityRepository.acceptOffer(
      offerId,
      offer.communityRequestId,
    );
  }

  async rejectOffer(userId: string, offerId: string) {
    const offer = await this.ensureOfferExists(offerId);

    if (offer.communityRequest.createdById !== userId) {
      throw new ForbiddenException('Only the request owner can reject offers');
    }

    if (offer.status !== 'PENDING') {
      throw new BadRequestException('Offer is not pending');
    }

    return this.communityRepository.rejectOffer(offerId);
  }

  async withdrawOffer(userId: string, offerId: string) {
    const offer = await this.ensureOfferExists(offerId);
    const vendor = await this.ensureVendor(userId);

    if (offer.vendorId !== vendor.id) {
      throw new ForbiddenException('Offer does not belong to this vendor');
    }

    if (offer.status !== 'PENDING') {
      throw new BadRequestException('Only pending offers can be withdrawn');
    }

    return this.communityRepository.withdrawOffer(offerId);
  }

  createNewFoodTruckLead(dto: NewFoodTruckLeadDto) {
    return this.communityRepository.createNewFoodTruckLead(dto);
  }

  private validateRequestDto(dto: CreateCommunityRequestDto) {
    if (
      (dto.latitude === undefined && dto.longitude !== undefined) ||
      (dto.latitude !== undefined && dto.longitude === undefined)
    ) {
      throw new BadRequestException('latitude and longitude must be provided together');
    }

    if (
      dto.budgetMin !== undefined &&
      dto.budgetMax !== undefined &&
      dto.budgetMin > dto.budgetMax
    ) {
      throw new BadRequestException('budgetMin cannot exceed budgetMax');
    }

    if (dto.startTime && dto.endTime && dto.startTime >= dto.endTime) {
      throw new BadRequestException('startTime must be before endTime');
    }

    if (dto.expiresAt && new Date(dto.expiresAt) <= new Date()) {
      throw new BadRequestException('expiresAt must be in the future');
    }

    if (
      dto.eventDate &&
      new Date(dto.eventDate).toISOString().slice(0, 10) <
        new Date().toISOString().slice(0, 10)
    ) {
      throw new BadRequestException('eventDate cannot be in the past');
    }
  }

  private validateOfferDto(dto: CreateVendorOfferDto) {
    if (!dto.quotedAmount && !dto.baseServiceFee) {
      throw new BadRequestException(
        'Either quotedAmount or baseServiceFee is required',
      );
    }

    if (
      dto.depositAmount !== undefined &&
      dto.quotedAmount !== undefined &&
      dto.depositAmount > dto.quotedAmount
    ) {
      throw new BadRequestException(
        'depositAmount cannot be greater than quotedAmount',
      );
    }

    if (dto.depositPercent !== undefined && dto.depositPercent > 100) {
      throw new BadRequestException('depositPercent cannot exceed 100');
    }

    if (dto.expiresAt && new Date(dto.expiresAt) <= new Date()) {
      throw new BadRequestException('expiresAt must be in the future');
    }
  }

  private async ensureVendor(userId: string) {
    const vendor = await this.communityRepository.findVendorByUserId(userId);

    if (!vendor) {
      throw new ForbiddenException('Vendor profile is required');
    }

    return vendor;
  }

  private async ensureFoodTruckExists(foodTruckId: string) {
    const foodTruck = await this.communityRepository.findFoodTruckById(
      foodTruckId,
    );

    if (!foodTruck || foodTruck.deletedAt) {
      throw new NotFoundException('Food truck not found');
    }

    return foodTruck;
  }

  private async ensureRequestExists(requestId: string) {
    const request = await this.communityRepository.findRequestById(requestId);

    if (!request) {
      throw new NotFoundException('Community request not found');
    }

    return request;
  }

  private async ensureRequestVisible(userId: string, requestId: string) {
    const request = await this.ensureRequestExists(requestId);

    if (request.visibility === 'PUBLIC' || request.createdById === userId) {
      return request;
    }

    await this.ensureTargetVendorUser(userId, request);
    return request;
  }

  private async ensureTargetVendorUser(
    userId: string,
    request: Awaited<ReturnType<CommunityRepository['findRequestById']>>,
  ) {
    const vendor = await this.communityRepository.findVendorByUserId(userId);

    if (!vendor || request?.targetFoodTruck?.vendorId !== vendor.id) {
      throw new ForbiddenException('Community request is private');
    }
  }

  private async ensureOfferExists(offerId: string) {
    const offer = await this.communityRepository.findOfferById(offerId);

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    return offer;
  }
}
