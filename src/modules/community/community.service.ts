import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CommentRequestDto } from './dto/comment-request.dto';
import { CreateCommunityRequestDto } from './dto/create-community-request.dto';
import { CreateVendorOfferDto } from './dto/create-vendor-offer.dto';
import { NewFoodTruckLeadDto } from './dto/new-food-truck-lead.dto';
import { ReactRequestDto } from './dto/react-request.dto';
import { RequestMediaDto } from './dto/request-media.dto';
import { RewardsService } from '../rewards/rewards.service';
import { CommunityRepository } from './community.repository';
import {
  validateCommunityPost,
  validateCommunityMedia,
} from './community-validation';
import { calculateQuote } from '../bookings/quote-financials';
import { assertVendorPlanFeature } from '../vendors/vendor-plan-access';

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);
  private readonly vendorApprovalMessage =
    'Vendor account is not approved yet. Please complete onboarding and submit verification documents for admin review.';

  constructor(
    private readonly communityRepository: CommunityRepository,
    private readonly rewardsService: RewardsService,
  ) {}

  async createPublicRequest(userId: string, dto: CreateCommunityRequestDto) {
    await this.communityRepository.ensurePublisher(userId);
    validateCommunityPost(dto);
    const request = await this.communityRepository.createRequest(
      userId,
      dto,
      'PUBLIC',
    );

    if (!request) {
      throw new BadRequestException('Community post could not be created');
    }

    try {
      const reward = await this.rewardsService.awardPoints(
        userId,
        'COMMUNITY_POST',
        request.id,
      );
      return {
        ...request,
        rewardStatus: reward.awarded ? 'AWARDED' : 'NOT_AWARDED',
      };
    } catch (error) {
      this.logger.error(
        `Reward processing failed for Community post ${request.id}`,
        error instanceof Error ? error.stack : undefined,
      );
      return {
        ...request,
        rewardStatus: 'UNCONFIRMED',
        rewardMessage:
          'Post created, but reward processing could not be confirmed. Please contact support; do not repost.',
      };
    }
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
    const request = await this.ensureRequestVisible(userId, requestId);
    if (!['LOW_PRICE', 'HIGH_RATED', 'RECENT'].includes(sort))
      throw new BadRequestException(
        'sort must be LOW_PRICE, HIGH_RATED, or RECENT',
      );
    const vendor =
      request.createdById === userId
        ? undefined
        : await this.ensureVendor(userId);
    return this.communityRepository.listOffersForRequest(
      requestId,
      sort,
      vendor?.id,
    );
  }

  async createPrivateTruckRequest(
    userId: string,
    foodTruckId: string,
    dto: CreateCommunityRequestDto,
  ) {
    await this.communityRepository.ensurePublisher(userId);
    validateCommunityPost(dto);
    if (dto.category !== 'NEED_TRUCK')
      throw new BadRequestException(
        'Private truck requests must use the NEED_TRUCK category',
      );
    await this.ensureFoodTruckExists(foodTruckId);

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
    await this.communityRepository.ensurePublisher(userId);
    validateCommunityMedia([dto]);
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

  async reactToRequest(
    userId: string,
    requestId: string,
    dto: ReactRequestDto,
  ) {
    await this.ensureRequestVisible(userId, requestId);
    return this.communityRepository.reactToRequest(requestId, userId, dto);
  }

  async createVendorOffer(
    userId: string,
    requestId: string,
    dto: CreateVendorOfferDto,
  ) {
    await this.communityRepository.ensurePublisher(userId);
    const vendor = await this.ensureVendor(userId);
    assertVendorPlanFeature(vendor, 'COMMUNITY_BOOKING_REQUESTS');
    const request = await this.ensureRequestExists(requestId);
    const foodTruck = await this.ensureFoodTruckExists(dto.foodTruckId);

    if (request.category !== 'NEED_TRUCK')
      throw new BadRequestException(
        'Quotes can only be sent to Need-a-Truck requests',
      );
    if (request.createdById === userId)
      throw new ForbiddenException(
        'You cannot send a quote to your own request',
      );

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
      throw new ForbiddenException(
        'This private request targets another truck',
      );
    }

    const commissionRate = this.resolveVendorCommissionRate(vendor);
    calculateQuote(
      dto,
      request.guestCount,
      commissionRate,
    );
    if (dto.expiresAt && new Date(dto.expiresAt) <= new Date())
      throw new BadRequestException('Quote expiresAt must be in the future');

    return this.communityRepository.createVendorOffer(
      vendor.id,
      requestId,
      dto,
      commissionRate,
    );
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

  private async ensureVendor(userId: string) {
    const vendor = await this.communityRepository.findVendorByUserId(userId);

    if (!vendor) {
      throw new ForbiddenException('Vendor profile is required');
    }

    if (vendor.status !== 'APPROVED' || !vendor.isVerified) {
      throw new ForbiddenException(this.vendorApprovalMessage);
    }

    return vendor;
  }

  private resolveVendorCommissionRate(vendor: {
    lockedCommissionRate?: unknown;
    selectedPlan?: string | null;
    activeSubscriptionTier?: { normalCommissionRate?: unknown } | null;
  }) {
    if (
      vendor.lockedCommissionRate !== null &&
      vendor.lockedCommissionRate !== undefined
    ) {
      return Number(vendor.lockedCommissionRate);
    }

    if (vendor.activeSubscriptionTier?.normalCommissionRate !== undefined && vendor.activeSubscriptionTier.normalCommissionRate !== null) {
      return Number(vendor.activeSubscriptionTier.normalCommissionRate);
    }

    if (vendor.selectedPlan === 'STARTER') return 0.15;
    if (vendor.selectedPlan === 'PRO') return 0.12;
    if (vendor.selectedPlan === 'ELITE') return 0.08;
  }

  private async ensureFoodTruckExists(foodTruckId: string) {
    const foodTruck =
      await this.communityRepository.findFoodTruckById(foodTruckId);

    if (!foodTruck || foodTruck.deletedAt) {
      throw new NotFoundException('Food truck not found');
    }

    if (
      foodTruck.status !== 'ACTIVE' ||
      foodTruck.vendor.deletedAt ||
      foodTruck.vendor.status !== 'APPROVED' ||
      !foodTruck.vendor.isVerified
    ) {
      throw new ForbiddenException('Food truck is not available');
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

    if (request.createdById === userId) return request;
    if (['DRAFT', 'CANCELLED'].includes(request.status))
      throw new NotFoundException('Community post is not available');
    if (request.visibility === 'PUBLIC') {
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
