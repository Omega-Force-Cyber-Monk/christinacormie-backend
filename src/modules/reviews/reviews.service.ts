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
import { RewardsService } from '../rewards/rewards.service';
import { ReviewsRepository } from './reviews.repository';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly reviewsRepository: ReviewsRepository,
    private readonly rewardsService: RewardsService,
  ) {}

  async createReview(userId: string, dto: CreateReviewDto) {
    const booking = await this.reviewsRepository.findBookingForReview(
      dto.bookingId,
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
      const review = await this.reviewsRepository.createReview(userId, booking, dto);

      await this.rewardsService.awardPoints(userId, 'REVIEW', review.id);

      return review;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Booking already has a review');
      }

      throw error;
    }
  }

  async respondToReview(userId: string, reviewId: string, dto: VendorResponseDto) {
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
    return this.reviewsRepository.createReport(reviewId, userId, dto);
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

    return vendor;
  }
}
