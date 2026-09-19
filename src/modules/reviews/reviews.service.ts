import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { ReportReviewDto } from './dto/report-review.dto';
import { ResolveReviewReportDto } from './dto/resolve-review-report.dto';
import { VendorResponseDto } from './dto/vendor-response.dto';
import { NotificationEventType } from '../notifications/enums/notification-event-type.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { RewardsService } from '../rewards/rewards.service';
import { ReviewsRepository } from './reviews.repository';

@Injectable()
export class ReviewsService {
  private readonly vendorApprovalMessage =
    'Vendor account is not approved yet. Please complete onboarding and submit verification documents for admin review.';

  constructor(
    private readonly reviewsRepository: ReviewsRepository,
    private readonly rewardsService: RewardsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createReview(userId: string, dto: CreateReviewDto) {
    if (dto.bookingId && dto.redemptionId) {
      throw new BadRequestException(
        'Provide either bookingId or redemptionId, not both',
      );
    }

    if (!dto.bookingId && !dto.redemptionId) {
      throw new BadRequestException(
        'Either bookingId or redemptionId must be provided',
      );
    }

    if (dto.redemptionId) {
      return this.createRedemptionReview(userId, dto);
    }

    return this.createBookingReview(userId, dto);
  }

  private async createBookingReview(userId: string, dto: CreateReviewDto) {
    const booking = await this.reviewsRepository.findBookingForReview(
      dto.bookingId!,
    );

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.customerId !== userId) {
      throw new ForbiddenException('Booking does not belong to this customer');
    }

    if (booking.status !== 'COMPLETED') {
      throw new BadRequestException('Only completed bookings can be reviewed');
    }

    if (booking.review) {
      throw new ConflictException('Booking already has a review');
    }

    try {
      const review = await this.reviewsRepository.createReviewForBooking(
        userId,
        booking,
        dto,
      );

      await this.rewardsService.awardPoints(userId, 'REVIEW', review.id);

      return review;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Booking already has a review');
      }

      throw error;
    }
  }

  private async createRedemptionReview(userId: string, dto: CreateReviewDto) {
    const redemption = await this.reviewsRepository.findRedemptionForReview(
      dto.redemptionId!,
    );

    if (!redemption) {
      throw new NotFoundException('Redemption not found');
    }

    if (redemption.userId !== userId) {
      throw new ForbiddenException(
        'Redemption does not belong to this customer',
      );
    }

    if (redemption.status !== 'COMPLETED' || !redemption.usedAt) {
      throw new BadRequestException(
        'Only confirmed redemptions can be reviewed',
      );
    }

    if (!redemption.vendorId || !redemption.foodTruckId) {
      throw new BadRequestException(
        'Redemption is missing vendor or food truck information',
      );
    }

    if (redemption.review) {
      throw new ConflictException('Redemption already has a review');
    }

    try {
      const review = await this.reviewsRepository.createReviewForRedemption(
        userId,
        redemption,
        dto,
      );

      await this.rewardsService.awardPoints(userId, 'REVIEW', review.id);

      return review;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Redemption already has a review');
      }

      throw error;
    }
  }

  async respondToReview(
    userId: string,
    reviewId: string,
    dto: VendorResponseDto,
  ) {
    const review = await this.ensureReviewExists(reviewId);
    const vendor = await this.ensureVendor(userId);

    if (review.vendorId !== vendor.id) {
      throw new ForbiddenException('Review does not belong to this vendor');
    }

    if (review.status === 'REMOVED') {
      throw new BadRequestException('Removed reviews cannot receive responses');
    }

    return this.reviewsRepository.updateVendorResponse(reviewId, dto);
  }

  async reportReview(userId: string, reviewId: string, dto: ReportReviewDto) {
    await this.ensureReviewExists(reviewId);
    const report = await this.reviewsRepository.createReport(
      reviewId,
      userId,
      dto,
    );

    await this.notificationsService.notifyAdmins({
      actorUserId: userId,
      title: 'Review report submitted',
      message: 'A review was reported and needs moderation.',
      actionUrl: `/api/v1/admin/reviews`,
      priority: 'MEDIUM',
      metadata: {
        eventType: NotificationEventType.CONTENT_REPORT_SUBMITTED,
        reportType: 'REVIEW',
        reportId: report.id,
        reviewId,
        reason: report.reason,
      },
      pushData: {
        eventType: NotificationEventType.CONTENT_REPORT_SUBMITTED,
        reportType: 'REVIEW',
        reportId: report.id,
        reviewId,
      },
    });

    return report;
  }

  async moderateReview(
    adminUserId: string,
    reviewId: string,
    dto: ModerateReviewDto,
  ) {
    await this.ensureReviewExists(reviewId);

    if (
      dto.status === undefined &&
      dto.contentHidden === undefined &&
      dto.ratingVisible === undefined
    ) {
      throw new BadRequestException('No moderation changes provided');
    }

    return this.reviewsRepository.moderateReview(reviewId, adminUserId, dto);
  }

  async resolveReport(
    adminUserId: string,
    reportId: string,
    dto: ResolveReviewReportDto,
  ) {
    const report = await this.reviewsRepository.findReportById(reportId);

    if (!report) {
      throw new NotFoundException('Review report not found');
    }

    return this.reviewsRepository.resolveReport(reportId, adminUserId, dto);
  }

  private async ensureReviewExists(reviewId: string) {
    const review = await this.reviewsRepository.findReviewById(reviewId);

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  private async ensureVendor(userId: string) {
    const vendor = await this.reviewsRepository.findVendorByUserId(userId);

    if (!vendor) {
      throw new ForbiddenException('Vendor profile is required');
    }

    if (vendor.status !== 'APPROVED' || !vendor.isVerified) {
      throw new ForbiddenException(this.vendorApprovalMessage);
    }

    return vendor;
  }
}
