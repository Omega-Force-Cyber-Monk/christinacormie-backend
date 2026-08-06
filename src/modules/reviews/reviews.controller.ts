import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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

@ApiTags('Reviews')
@ApiBearerAuth()
@Controller('api/v1/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @ApiOperation({ summary: 'Create a review for a completed booking (Customer)' })
  @UseGuards(JwtAuthGuard)
  @Post()
  createReview(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.createReview(user.sub, dto);
  }

  @ApiOperation({ summary: 'Resolve a reported review (Admin)' })
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
