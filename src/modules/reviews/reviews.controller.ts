import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { CreateReviewDto } from './dto/create-review.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { ReportReviewDto } from './dto/report-review.dto';
import { ResolveReviewReportDto } from './dto/resolve-review-report.dto';
import { VendorResponseDto } from './dto/vendor-response.dto';
import { ReviewsService } from './reviews.service';

const errorExample = (
  statusCode: number,
  message: string | string[],
  error: string,
) => ({
  statusCode,
  message,
  error,
});

const unauthorizedExample = errorExample(401, 'Unauthorized', 'Unauthorized');
const forbiddenAdminExample = errorExample(
  403,
  'Forbidden resource',
  'Forbidden',
);
const forbiddenVendorApprovalExample = errorExample(
  403,
  'Vendor account is not approved yet. Please complete onboarding and submit verification documents for admin review.',
  'Forbidden',
);

const reviewExample = {
  id: 'review-id',
  bookingId: 'booking-id',
  customerId: 'customer-user-id',
  vendorId: 'vendor-id',
  foodTruckId: 'food-truck-id',
  rating: 5,
  title: 'Amazing Tacos and Outstanding Service!',
  content:
    'Food arrived hot and on time. Everyone loved the tacos and fresh salsas.',
  isVerified: true,
  status: 'PUBLISHED',
  contentHidden: false,
  ratingVisible: true,
  vendorResponse: null,
  vendorRespondedAt: null,
  moderationReason: null,
  createdAt: '2026-09-08T06:10:00.000Z',
  updatedAt: '2026-09-08T06:10:00.000Z',
  booking: {
    id: 'booking-id',
    bookingNumber: 'BD-20260908-001',
    status: 'COMPLETED',
    completedAt: '2026-09-08T06:00:00.000Z',
  },
  customer: {
    id: 'customer-user-id',
    profile: {
      displayName: 'Alex Rivera',
      avatarUrl: 'https://cdn.bitedrop.com/avatars/alex.jpg',
    },
  },
  vendor: {
    id: 'vendor-id',
    businessName: 'Taco Paradise',
    reliabilityScore: 96,
  },
  foodTruck: {
    id: 'food-truck-id',
    name: 'Taco Paradise',
    slug: 'taco-paradise',
    averageRating: 4.8,
    totalReviews: 102,
  },
  reports: [],
};

const reviewReportExample = {
  id: 'review-report-id',
  reviewId: 'review-id',
  reportedById: 'customer-user-id',
  reason: 'INAPPROPRIATE_LANGUAGE',
  description: 'Review contains offensive remarks that violate guidelines.',
  status: 'REVIEWING',
  resolutionNotes: null,
  reviewedById: null,
  reviewedAt: null,
  createdAt: '2026-09-08T06:10:00.000Z',
  updatedAt: '2026-09-08T06:10:00.000Z',
  review: {
    id: 'review-id',
    rating: 5,
    title: 'Amazing Tacos and Outstanding Service!',
    status: 'PUBLISHED',
  },
};

const resolvedReportExample = {
  ...reviewReportExample,
  status: 'RESOLVED',
  resolutionNotes: 'Review moderated and hidden due to policy violation.',
  reviewedById: 'admin-user-id',
  reviewedAt: '2026-09-08T06:20:00.000Z',
  review: {
    id: 'review-id',
    status: 'HIDDEN',
    rating: 5,
  },
};

@ApiTags('Reviews')
@ApiBearerAuth()
@Controller('api/v1/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @ApiOperation({
    summary: 'Create a review for a completed booking (Customer)',
  })
  @ApiResponse({
    status: 201,
    description:
      'Review created successfully for a completed booking. Customer receives review points.',
    schema: { example: reviewExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Booking is not completed or request body is invalid.',
    schema: {
      example: errorExample(
        400,
        'Only completed bookings can be reviewed',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Booking does not belong to the authenticated customer.',
    schema: {
      example: errorExample(
        403,
        'Booking does not belong to this customer',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Booking was not found.',
    schema: { example: errorExample(404, 'Booking not found', 'Not Found') },
  })
  @ApiResponse({
    status: 409,
    description: 'Booking already has a review.',
    schema: {
      example: errorExample(409, 'Booking already has a review', 'Conflict'),
    },
  })
  @UseGuards(JwtAuthGuard)
  @Post()
  createReview(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.createReview(user.sub, dto);
  }

  @ApiOperation({ summary: 'Resolve a reported review (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Review report resolved or dismissed successfully.',
    schema: { example: resolvedReportExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body is invalid.',
    schema: {
      example: errorExample(
        400,
        [
          'status must be one of the following values: REVIEWING, RESOLVED, DISMISSED',
        ],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Authenticated user is not an admin.',
    schema: { example: forbiddenAdminExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Review report was not found.',
    schema: {
      example: errorExample(404, 'Review report not found', 'Not Found'),
    },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('reports/:reportId')
  resolveReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId') reportId: string,
    @Body() dto: ResolveReviewReportDto,
  ) {
    return this.reviewsService.resolveReport(user.sub, reportId, dto);
  }

  @ApiOperation({ summary: 'Respond to a customer review (Vendor)' })
  @ApiResponse({
    status: 200,
    description: 'Vendor response saved successfully.',
    schema: {
      example: {
        ...reviewExample,
        vendorResponse:
          'Thank you for your feedback! We are thrilled your guests enjoyed our tacos.',
        vendorRespondedAt: '2026-09-08T06:20:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Review was removed or request body is invalid.',
    schema: {
      example: errorExample(
        400,
        'Removed reviews cannot receive responses',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description:
      'Vendor is not approved or review does not belong to this vendor.',
    schema: { example: forbiddenVendorApprovalExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Review was not found.',
    schema: { example: errorExample(404, 'Review not found', 'Not Found') },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch(':reviewId/vendor-response')
  respondToReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reviewId') reviewId: string,
    @Body() dto: VendorResponseDto,
  ) {
    return this.reviewsService.respondToReview(user.sub, reviewId, dto);
  }

  @ApiOperation({ summary: 'Report a review for policy violation' })
  @ApiResponse({
    status: 201,
    description: 'Review report submitted successfully.',
    schema: { example: reviewReportExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body is invalid.',
    schema: {
      example: errorExample(
        400,
        ['reason must be shorter than or equal to 255 characters'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Review was not found.',
    schema: { example: errorExample(404, 'Review not found', 'Not Found') },
  })
  @UseGuards(JwtAuthGuard)
  @Post(':reviewId/reports')
  reportReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reviewId') reviewId: string,
    @Body() dto: ReportReviewDto,
  ) {
    return this.reviewsService.reportReview(user.sub, reviewId, dto);
  }

  @ApiOperation({ summary: 'Moderate a review status or visibility (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Review moderated successfully.',
    schema: {
      example: {
        ...reviewExample,
        status: 'HIDDEN',
        contentHidden: true,
        moderationReason: 'Inappropriate language in review content',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'No moderation changes provided or request body is invalid.',
    schema: {
      example: errorExample(
        400,
        'No moderation changes provided',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Authenticated user is not an admin.',
    schema: { example: forbiddenAdminExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Review was not found.',
    schema: { example: errorExample(404, 'Review not found', 'Not Found') },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':reviewId/moderation')
  moderateReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reviewId') reviewId: string,
    @Body() dto: ModerateReviewDto,
  ) {
    return this.reviewsService.moderateReview(user.sub, reviewId, dto);
  }
}
