import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { UpdateAccountStatusDto } from '../users/dto/update-account-status.dto';
import { ModerateReviewDto } from '../reviews/dto/moderate-review.dto';
import { ResolveBookingIssueDto } from '../bookings/dto/resolve-booking-issue.dto';
import { VendorsService } from '../vendors/vendors.service';
import { AdminService } from './admin.service';
import { AdminListQueryDto } from './dto/admin-list-query.dto';
import { CreateMarketDto } from './dto/create-market.dto';
import { ModerateCommunityRequestDto } from './dto/moderate-community-request.dto';
import { UpdateNewFoodTruckRequestDto } from './dto/update-new-food-truck-request.dto';
import { UpdateFoodTruckAdminDto } from './dto/update-food-truck-admin.dto';
import { UpdateMarketDto } from './dto/update-market.dto';
import { UpdateVerificationDocumentDto } from './dto/update-verification-document.dto';
import { UpsertLeaderboardRuleDto } from './dto/upsert-leaderboard-rule.dto';
import { UpsertPlatformSettingDto } from './dto/upsert-platform-setting.dto';
import { UpdateVendorFoundingMemberDto } from './dto/update-vendor-founding-member.dto';
import { UpdateVendorFoundingOfferDto } from './dto/update-vendor-founding-offer.dto';
import {
  CreateVendorSubscriptionTierDto,
  UpdateVendorSubscriptionTierDto,
} from './dto/vendor-subscription-tier.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('api/v1/admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly vendorsService: VendorsService,
  ) {}

  @ApiOperation({ summary: 'List all users with pagination and search' })
  @Get('users')
  listUsers(@Query() query: AdminListQueryDto) {
    return this.adminService.listUsers(query);
  }

  @ApiOperation({ summary: 'Get consolidated user management data' })
  @Get('users-management')
  getUsersManagement(@Query() query: AdminListQueryDto) {
    return this.adminService.getUsersManagement(query);
  }

  @ApiOperation({ summary: 'Get user details by user ID' })
  @Get('users/:userId')
  getUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.adminService.getUser(userId);
  }

  @ApiOperation({ summary: 'Update user account status' })
  @Patch('users/:userId/account-status')
  updateUserStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateAccountStatusDto,
  ) {
    return this.adminService.updateUserStatus(user.sub, userId, dto);
  }

  @ApiOperation({ summary: 'Suspend a user account' })
  @Patch('users/:userId/suspend')
  suspendUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.adminService.suspendUser(user.sub, userId);
  }

  @ApiOperation({ summary: 'Retrieve/reactivate a user account' })
  @Patch('users/:userId/retrieve')
  retrieveUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.adminService.retrieveUser(user.sub, userId);
  }

  @ApiOperation({ summary: 'List vendors pending approval' })
  @Get('vendors/pending-approval')
  getPendingApprovalVendors(@Query() query: AdminListQueryDto) {
    return this.vendorsService.getPendingApprovalVendors(query);
  }

  @ApiOperation({ summary: 'List all vendors with filtering and pagination' })
  @Get('vendors')
  listVendors(@Query() query: AdminListQueryDto) {
    return this.adminService.listVendors(query);
  }

  @ApiOperation({ summary: 'Get consolidated vendor management data' })
  @Get('vendors-management')
  getVendorsManagement(@Query() query: AdminListQueryDto) {
    return this.adminService.getVendorsManagement(query);
  }

  @ApiOperation({ summary: 'List new food truck requests for admin review' })
  @Get('vendors/truck-requests')
  listNewFoodTruckRequests(@Query() query: AdminListQueryDto) {
    return this.adminService.listNewFoodTruckRequests(query);
  }

  @ApiOperation({ summary: 'Update a new food truck request status' })
  @Patch('vendors/truck-requests/:requestId')
  updateNewFoodTruckRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: UpdateNewFoodTruckRequestDto,
  ) {
    return this.adminService.updateNewFoodTruckRequest(
      user.sub,
      requestId,
      dto,
    );
  }

  @ApiOperation({ summary: 'Get vendor details by vendor ID' })
  @Get('vendors/:vendorId')
  getVendor(@Param('vendorId', ParseUUIDPipe) vendorId: string) {
    return this.adminService.getVendor(vendorId);
  }

  @ApiOperation({ summary: 'Suspend a vendor account' })
  @Patch('vendors/:vendorId/suspend')
  suspendVendor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
  ) {
    return this.adminService.suspendVendor(user.sub, vendorId);
  }

  @ApiOperation({ summary: 'Retrieve/reactivate a vendor account' })
  @Patch('vendors/:vendorId/retrieve')
  retrieveVendor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
  ) {
    return this.adminService.retrieveVendor(user.sub, vendorId);
  }

  @ApiOperation({ summary: 'Remove a badge from a vendor' })
  @Delete('vendors/:vendorId/badges/:badgeId')
  removeVendorBadge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
    @Param('badgeId', ParseUUIDPipe) badgeId: string,
  ) {
    return this.adminService.removeVendorBadge(user.sub, vendorId, badgeId);
  }

  @ApiOperation({ summary: 'List vendor verification requests' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    description: 'Filter verification requests by verification status',
  })
  @Get('verification-requests')
  listVerificationRequests(@Query() query: AdminListQueryDto) {
    return this.adminService.listVerificationRequests(query);
  }

  @ApiOperation({ summary: 'Update one submitted verification document' })
  @Patch('verification-requests/:requestId/documents/:documentKey')
  updateVerificationDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Param('documentKey') documentKey: string,
    @Body() dto: UpdateVerificationDocumentDto,
  ) {
    return this.adminService.updateVerificationDocument(
      user.sub,
      requestId,
      documentKey,
      dto,
    );
  }

  @ApiOperation({ summary: 'List all food trucks' })
  @Get('food-trucks')
  listFoodTrucks(@Query() query: AdminListQueryDto) {
    return this.adminService.listFoodTrucks(query);
  }

  @ApiOperation({ summary: 'Get food truck details' })
  @Get('food-trucks/:foodTruckId')
  getFoodTruck(@Param('foodTruckId', ParseUUIDPipe) foodTruckId: string) {
    return this.adminService.getFoodTruck(foodTruckId);
  }

  @ApiOperation({ summary: 'Update food truck status or feature status' })
  @Patch('food-trucks/:foodTruckId')
  updateFoodTruck(
    @CurrentUser() user: AuthenticatedUser,
    @Param('foodTruckId', ParseUUIDPipe) foodTruckId: string,
    @Body() dto: UpdateFoodTruckAdminDto,
  ) {
    return this.adminService.updateFoodTruck(user.sub, foodTruckId, dto);
  }

  @ApiOperation({ summary: 'List all platform bookings' })
  @Get('bookings')
  listBookings(@Query() query: AdminListQueryDto) {
    return this.adminService.listBookings(query);
  }

  @ApiOperation({ summary: 'Get consolidated bookings management data' })
  @Get('bookings-management')
  getBookingsManagement(@Query() query: AdminListQueryDto) {
    return this.adminService.getBookingsManagement(query);
  }

  @ApiOperation({ summary: 'Get booking details by ID' })
  @Get('bookings/:bookingId')
  getBooking(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.adminService.getBooking(bookingId);
  }

  @ApiOperation({
    summary:
      'Resolve a booking issue with payout release or full refund decision',
  })
  @Patch('bookings/:bookingId/issues/:issueId/resolve')
  resolveBookingIssue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Param('issueId', ParseUUIDPipe) issueId: string,
    @Body() dto: ResolveBookingIssueDto,
  ) {
    return this.adminService.resolveBookingIssue(
      user.sub,
      bookingId,
      issueId,
      dto,
    );
  }

  @ApiOperation({ summary: 'List all payments' })
  @Get('payments')
  listPayments(@Query() query: AdminListQueryDto) {
    return this.adminService.listPayments(query);
  }

  @ApiOperation({ summary: 'Get consolidated payments and payouts data' })
  @Get('payments-management')
  getPaymentsManagement(@Query() query: AdminListQueryDto) {
    return this.adminService.getPaymentsManagement(query);
  }

  @ApiOperation({
    summary: 'Retry a failed vendor payout through Stripe transfer',
  })
  @Patch('payouts/:payoutId/approve')
  approvePayout(
    @CurrentUser() user: AuthenticatedUser,
    @Param('payoutId', ParseUUIDPipe) payoutId: string,
  ) {
    return this.adminService.approvePayout(user.sub, payoutId);
  }

  @ApiOperation({ summary: 'Retry a failed vendor payout' })
  @Post('payouts/:payoutId/retry')
  retryPayout(
    @CurrentUser() user: AuthenticatedUser,
    @Param('payoutId', ParseUUIDPipe) payoutId: string,
  ) {
    return this.adminService.retryPayout(user.sub, payoutId);
  }

  @ApiOperation({
    summary:
      'Deprecated: payout cancellation is handled by booking issue FULL_REFUND',
  })
  @Patch('payouts/:payoutId/reject')
  rejectPayout(
    @CurrentUser() user: AuthenticatedUser,
    @Param('payoutId', ParseUUIDPipe) payoutId: string,
    @Body('reason') reason?: string,
  ) {
    return this.adminService.rejectPayout(user.sub, payoutId, reason);
  }

  @ApiOperation({
    summary:
      'Deprecated: payouts are held automatically while a booking issue is open',
  })
  @Patch('payouts/:payoutId/hold')
  holdPayout(
    @CurrentUser() user: AuthenticatedUser,
    @Param('payoutId', ParseUUIDPipe) payoutId: string,
    @Body('reason') reason?: string,
  ) {
    return this.adminService.holdPayout(user.sub, payoutId, reason);
  }

  @ApiOperation({ summary: 'List platform commissions' })
  @Get('commissions')
  listCommissions(@Query() query: AdminListQueryDto) {
    return this.adminService.listCommissions(query);
  }

  @ApiOperation({ summary: 'List processed refunds' })
  @Get('refunds')
  listRefunds(@Query() query: AdminListQueryDto) {
    return this.adminService.listRefunds(query);
  }

  @ApiOperation({ summary: 'List reviews for moderation' })
  @Get('reviews')
  listReviews(@Query() query: AdminListQueryDto) {
    return this.adminService.listReviews(query);
  }

  @ApiOperation({ summary: 'Get consolidated review management data' })
  @Get('reviews-management')
  getReviewsManagement(@Query() query: AdminListQueryDto) {
    return this.adminService.getReviewsManagement(query);
  }

  @ApiOperation({ summary: 'Moderate a review' })
  @Patch('reviews/:reviewId/moderation')
  moderateReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() dto: ModerateReviewDto,
  ) {
    return this.adminService.moderateReview(user.sub, reviewId, dto);
  }

  @ApiOperation({ summary: 'Remove a review completely' })
  @Delete('reviews/:reviewId')
  removeReviewCompletely(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
  ) {
    return this.adminService.removeReviewCompletely(user.sub, reviewId);
  }

  @ApiOperation({ summary: 'Hide review text but keep rating visible' })
  @Patch('reviews/:reviewId/hide-text')
  hideReviewTextOnly(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
  ) {
    return this.adminService.hideReviewTextOnly(user.sub, reviewId);
  }

  @ApiOperation({ summary: 'Keep a reported review published' })
  @Patch('reviews/:reviewId/keep')
  keepReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
  ) {
    return this.adminService.keepReview(user.sub, reviewId);
  }

  @ApiOperation({ summary: 'List community requests' })
  @Get('community/requests')
  listCommunityRequests(@Query() query: AdminListQueryDto) {
    return this.adminService.listCommunityRequests(query);
  }

  @ApiOperation({ summary: 'Get consolidated community moderation data' })
  @Get('community-management')
  getCommunityManagement(@Query() query: AdminListQueryDto) {
    return this.adminService.getCommunityManagement(query);
  }

  @ApiOperation({ summary: 'Moderate a community request' })
  @Patch('community/requests/:requestId')
  moderateCommunityRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: ModerateCommunityRequestDto,
  ) {
    return this.adminService.moderateCommunityRequest(user.sub, requestId, dto);
  }

  @ApiOperation({ summary: 'Remove a community post' })
  @Delete('community/requests/:requestId')
  removeCommunityRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.adminService.removeCommunityRequest(user.sub, requestId);
  }

  @ApiOperation({ summary: 'Delete a community comment' })
  @Delete('community/comments/:commentId')
  deleteCommunityComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    return this.adminService.deleteCommunityComment(user.sub, commentId);
  }

  @ApiOperation({ summary: 'List all markets' })
  @Get('markets')
  listMarkets() {
    return this.adminService.listMarkets();
  }

  @ApiOperation({ summary: 'Create a new market' })
  @Post('markets')
  createMarket(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMarketDto,
  ) {
    return this.adminService.createMarket(user.sub, dto);
  }

  @ApiOperation({ summary: 'Update an existing market' })
  @Patch('markets/:marketId')
  updateMarket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('marketId', ParseUUIDPipe) marketId: string,
    @Body() dto: UpdateMarketDto,
  ) {
    return this.adminService.updateMarket(user.sub, marketId, dto);
  }

  @ApiOperation({ summary: 'List platform settings' })
  @Get('platform-settings')
  listPlatformSettings() {
    return this.adminService.listPlatformSettings();
  }

  @ApiOperation({ summary: 'Get vendor founding offer settings' })
  @Get('vendor-founding-offer')
  getVendorFoundingOffer() {
    return this.adminService.getVendorFoundingOffer();
  }

  @ApiOperation({ summary: 'Update vendor founding offer settings' })
  @Patch('vendor-founding-offer')
  updateVendorFoundingOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateVendorFoundingOfferDto,
  ) {
    return this.adminService.updateVendorFoundingOffer(user.sub, dto);
  }

  @ApiOperation({ summary: 'List vendor subscription tiers' })
  @Get('vendor-subscription-tiers')
  listVendorSubscriptionTiers(@Query('includeInactive') includeInactive?: string) {
    return this.adminService.listVendorSubscriptionTiers(
      includeInactive === 'true',
    );
  }

  @ApiOperation({
    summary:
      'Create a vendor subscription tier and automatically create Stripe product/price',
  })
  @Post('vendor-subscription-tiers')
  createVendorSubscriptionTier(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVendorSubscriptionTierDto,
  ) {
    return this.adminService.createVendorSubscriptionTier(user.sub, dto);
  }

  @ApiOperation({
    summary:
      'Update a vendor subscription tier and automatically sync Stripe product/price',
  })
  @Patch('vendor-subscription-tiers/:tierId')
  updateVendorSubscriptionTier(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tierId', ParseUUIDPipe) tierId: string,
    @Body() dto: UpdateVendorSubscriptionTierDto,
  ) {
    return this.adminService.updateVendorSubscriptionTier(
      user.sub,
      tierId,
      dto,
    );
  }

  @ApiOperation({
    summary: 'Disable a vendor subscription tier and archive Stripe price',
  })
  @Delete('vendor-subscription-tiers/:tierId')
  deleteVendorSubscriptionTier(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tierId', ParseUUIDPipe) tierId: string,
  ) {
    return this.adminService.deleteVendorSubscriptionTier(user.sub, tierId);
  }

  @ApiOperation({ summary: 'Manually update vendor founding member status' })
  @Patch('vendors/:vendorId/founding-member')
  updateVendorFoundingMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
    @Body() dto: UpdateVendorFoundingMemberDto,
  ) {
    return this.adminService.updateVendorFoundingMember(
      user.sub,
      vendorId,
      dto,
    );
  }

  @ApiOperation({ summary: 'Create or update a platform setting' })
  @Patch('platform-settings/:key')
  upsertPlatformSetting(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body() dto: UpsertPlatformSettingDto,
  ) {
    return this.adminService.upsertPlatformSetting(key, user.sub, dto);
  }

  @ApiOperation({ summary: 'List leaderboard rules' })
  @Get('leaderboard-rules')
  listLeaderboardRules() {
    return this.adminService.listLeaderboardRules();
  }

  @ApiOperation({ summary: 'Create a new leaderboard rule' })
  @Post('leaderboard-rules')
  createLeaderboardRule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertLeaderboardRuleDto,
  ) {
    return this.adminService.createLeaderboardRule(user.sub, dto);
  }

  @ApiOperation({ summary: 'Update an existing leaderboard rule' })
  @Patch('leaderboard-rules/:ruleId')
  updateLeaderboardRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: UpsertLeaderboardRuleDto,
  ) {
    return this.adminService.updateLeaderboardRule(user.sub, ruleId, dto);
  }

  @ApiOperation({ summary: 'List active leaderboards' })
  @Get('leaderboards')
  listLeaderboards(@Query() query: AdminListQueryDto) {
    return this.adminService.listLeaderboards(query);
  }

  @ApiOperation({ summary: 'Get consolidated rewards management data' })
  @Get('rewards-management')
  getRewardsManagement(@Query() query: AdminListQueryDto) {
    return this.adminService.getRewardsManagement(query);
  }

  @ApiOperation({ summary: 'Get consolidated admin dashboard data' })
  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @ApiOperation({ summary: 'Get overall admin analytics summary' })
  @Get('analytics/overview')
  getOverviewAnalytics() {
    return this.adminService.getOverviewAnalytics();
  }

  @ApiOperation({ summary: 'Get bookings analytics summary' })
  @Get('analytics/bookings')
  getBookingsAnalytics() {
    return this.adminService.getBookingsAnalytics();
  }

  @ApiOperation({ summary: 'Get payments analytics summary' })
  @Get('analytics/payments')
  getPaymentsAnalytics() {
    return this.adminService.getPaymentsAnalytics();
  }

  @ApiOperation({ summary: 'Get vendors analytics summary' })
  @Get('analytics/vendors')
  getVendorsAnalytics() {
    return this.adminService.getVendorsAnalytics();
  }
}
