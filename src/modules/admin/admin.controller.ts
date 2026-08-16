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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { UpdateAccountStatusDto } from '../users/dto/update-account-status.dto';
import { ModerateReviewDto } from '../reviews/dto/moderate-review.dto';
import { VendorsService } from '../vendors/vendors.service';
import { AdminService } from './admin.service';
import { AdminListQueryDto } from './dto/admin-list-query.dto';
import { CreateMarketDto } from './dto/create-market.dto';
import { ModerateCommunityRequestDto } from './dto/moderate-community-request.dto';
import { UpdateFoodTruckAdminDto } from './dto/update-food-truck-admin.dto';
import { UpdateMarketDto } from './dto/update-market.dto';
import { UpsertLeaderboardRuleDto } from './dto/upsert-leaderboard-rule.dto';
import { UpsertPlatformSettingDto } from './dto/upsert-platform-setting.dto';

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

  @ApiOperation({ summary: 'Get vendor details by vendor ID' })
  @Get('vendors/:vendorId')
  getVendor(@Param('vendorId', ParseUUIDPipe) vendorId: string) {
    return this.adminService.getVendor(vendorId);
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

  @ApiOperation({ summary: 'Get booking details by ID' })
  @Get('bookings/:bookingId')
  getBooking(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.adminService.getBooking(bookingId);
  }

  @ApiOperation({ summary: 'List all payments' })
  @Get('payments')
  listPayments(@Query() query: AdminListQueryDto) {
    return this.adminService.listPayments(query);
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

  @ApiOperation({ summary: 'Moderate a review' })
  @Patch('reviews/:reviewId/moderation')
  moderateReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() dto: ModerateReviewDto,
  ) {
    return this.adminService.moderateReview(user.sub, reviewId, dto);
  }

  @ApiOperation({ summary: 'List community requests' })
  @Get('community/requests')
  listCommunityRequests(@Query() query: AdminListQueryDto) {
    return this.adminService.listCommunityRequests(query);
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
