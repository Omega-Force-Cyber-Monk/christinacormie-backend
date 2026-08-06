import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { ReportReviewDto } from './dto/report-review.dto';
import { ResolveReviewReportDto } from './dto/resolve-review-report.dto';
import { VendorResponseDto } from './dto/vendor-response.dto';

@Injectable()
export class ReviewsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findVendorByUserId(userId: string) {
    return this.prisma.vendor.findUnique({
      where: { userId },
      select: { id: true },
    });
  }

  findBookingForReview(bookingId: string) {
    return this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        review: true,
      },
    });
  }

  findReviewById(reviewId: string) {
    return this.prisma.review.findUnique({
      where: { id: reviewId },
      include: this.reviewInclude(),
    });
  }

  async createReview(customerId: string, booking: any, dto: CreateReviewDto) {
    const review = await this.prisma.review.create({
      data: {
        bookingId: booking.id,
        customerId,
        vendorId: booking.vendorId,
        foodTruckId: booking.foodTruckId,
        rating: dto.rating,
        title: dto.title,
        content: dto.content,
        isVerified: true,
      },
      include: this.reviewInclude(),
    });

    await this.refreshTrustScores(booking.foodTruckId, booking.vendorId);

    return review;
  }

  async updateVendorResponse(reviewId: string, dto: VendorResponseDto) {
    return this.prisma.review.update({
      where: { id: reviewId },
      data: {
        vendorResponse: dto.vendorResponse,
        vendorRespondedAt: new Date(),
      },
      include: this.reviewInclude(),
    });
  }

  createReport(reviewId: string, userId: string, dto: ReportReviewDto) {
    return this.prisma.reviewReport.create({
      data: {
        reviewId,
        reportedById: userId,
        reason: dto.reason,
        description: dto.description,
      },
      include: {
        review: {
          select: {
            id: true,
            rating: true,
            title: true,
            status: true,
          },
        },
      },
    });
  }

  async moderateReview(reviewId: string, adminUserId: string, dto: ModerateReviewDto) {
    const review = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        ...(dto.status !== undefined ? { status: dto.status as any } : {}),
        ...(dto.contentHidden !== undefined
          ? { contentHidden: dto.contentHidden }
          : {}),
        ...(dto.ratingVisible !== undefined
          ? { ratingVisible: dto.ratingVisible }
          : {}),
        moderatedById: adminUserId,
        moderatedAt: new Date(),
        moderationReason: dto.moderationReason,
      },
      include: this.reviewInclude(),
    });

    await this.refreshTrustScores(review.foodTruckId, review.vendorId);

    return review;
  }

  resolveReport(reportId: string, adminUserId: string, dto: ResolveReviewReportDto) {
    return this.prisma.reviewReport.update({
      where: { id: reportId },
      data: {
        status: dto.status as any,
        reviewedById: adminUserId,
        resolutionNotes: dto.resolutionNotes,
        reviewedAt: new Date(),
      },
      include: {
        review: {
          select: {
            id: true,
            status: true,
            rating: true,
          },
        },
      },
    });
  }

  findReportById(reportId: string) {
    return this.prisma.reviewReport.findUnique({
      where: { id: reportId },
    });
  }

  async refreshTrustScores(foodTruckId: string, vendorId: string) {
    const reviewAggregate = await this.prisma.review.aggregate({
      where: {
        foodTruckId,
        status: 'PUBLISHED',
        ratingVisible: true,
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const averageRating = Number((reviewAggregate._avg.rating ?? 0).toFixed(2));
    const totalReviews = reviewAggregate._count.rating;

    await this.prisma.foodTruck.update({
      where: { id: foodTruckId },
      data: {
        averageRating,
        totalReviews,
      },
    });

    const vendorAggregate = await this.prisma.review.aggregate({
      where: {
        vendorId,
        status: 'PUBLISHED',
        ratingVisible: true,
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const vendorAverage = vendorAggregate._avg.rating ?? 0;
    const vendorReviewCount = vendorAggregate._count.rating;
    const reliabilityScore = Number(
      Math.min(100, vendorAverage * 20 + Math.min(vendorReviewCount, 50) * 0.4).toFixed(2),
    );

    await this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        reliabilityScore,
      },
    });
  }

  private reviewInclude() {
    return {
      booking: {
        select: {
          id: true,
          bookingNumber: true,
          status: true,
          completedAt: true,
        },
      },
      customer: {
        select: {
          id: true,
          profile: {
            select: {
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      },
      vendor: {
        select: {
          id: true,
          businessName: true,
          reliabilityScore: true,
        },
      },
      foodTruck: {
        select: {
          id: true,
          name: true,
          slug: true,
          averageRating: true,
          totalReviews: true,
        },
      },
      reports: {
        orderBy: { createdAt: 'desc' as const },
      },
    };
  }
}
