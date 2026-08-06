import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { ReviewsService } from '../reviews/reviews.service';
import { UpdateAccountStatusDto } from '../users/dto/update-account-status.dto';
import { ModerateReviewDto } from '../reviews/dto/moderate-review.dto';
import { AdminRepository } from './admin.repository';
import { AdminListQueryDto } from './dto/admin-list-query.dto';
import { CreateMarketDto } from './dto/create-market.dto';
import { ModerateCommunityRequestDto } from './dto/moderate-community-request.dto';
import { UpdateFoodTruckAdminDto } from './dto/update-food-truck-admin.dto';
import { UpdateMarketDto } from './dto/update-market.dto';
import { UpsertLeaderboardRuleDto } from './dto/upsert-leaderboard-rule.dto';
import { UpsertPlatformSettingDto } from './dto/upsert-platform-setting.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly usersService: UsersService,
    private readonly reviewsService: ReviewsService,
  ) {}

  listUsers(query: AdminListQueryDto) {
    return this.adminRepository.listUsers(query);
  }

  async getUser(userId: string) {
    const user = await this.adminRepository.getUser(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateUserStatus(adminUserId: string, userId: string, dto: UpdateAccountStatusDto) {
    const updated = await this.usersService.updateAccountStatus(userId, dto.status);
    await this.adminRepository.createAuditLog(adminUserId, 'UPDATE_USER_STATUS', 'User', userId, {
      newStatus: dto.status,
    });
    return updated;
  }

  listVendors(query: AdminListQueryDto) {
    return this.adminRepository.listVendors(query);
  }

  async getVendor(vendorId: string) {
    const vendor = await this.adminRepository.getVendor(vendorId);

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    return vendor;
  }

  listVerificationRequests(query: AdminListQueryDto) {
    return this.adminRepository.listVerificationRequests(query);
  }

  listFoodTrucks(query: AdminListQueryDto) {
    return this.adminRepository.listFoodTrucks(query);
  }

  async getFoodTruck(foodTruckId: string) {
    const foodTruck = await this.adminRepository.getFoodTruck(foodTruckId);

    if (!foodTruck) {
      throw new NotFoundException('Food truck not found');
    }

    return foodTruck;
  }

  async updateFoodTruck(adminUserId: string, foodTruckId: string, dto: UpdateFoodTruckAdminDto) {
    const updated = await this.adminRepository.updateFoodTruck(foodTruckId, dto);
    await this.adminRepository.createAuditLog(adminUserId, 'UPDATE_FOOD_TRUCK', 'FoodTruck', foodTruckId, dto as any);
    return updated;
  }

  listBookings(query: AdminListQueryDto) {
    return this.adminRepository.listBookings(query);
  }

  async getBooking(bookingId: string) {
    const booking = await this.adminRepository.getBooking(bookingId);

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  listPayments(query: AdminListQueryDto) {
    return this.adminRepository.listPayments(query);
  }

  listCommissions(query: AdminListQueryDto) {
    return this.adminRepository.listCommissions(query);
  }

  listRefunds(query: AdminListQueryDto) {
    return this.adminRepository.listRefunds(query);
  }

  listReviews(query: AdminListQueryDto) {
    return this.adminRepository.listReviews(query);
  }

  async moderateReview(adminUserId: string, reviewId: string, dto: ModerateReviewDto) {
    const result = await this.reviewsService.moderateReview(adminUserId, reviewId, dto);
    await this.adminRepository.createAuditLog(adminUserId, 'MODERATE_REVIEW', 'Review', reviewId, dto as any);
    return result;
  }

  listCommunityRequests(query: AdminListQueryDto) {
    return this.adminRepository.listCommunityRequests(query);
  }

  async moderateCommunityRequest(
    adminUserId: string,
    requestId: string,
    dto: ModerateCommunityRequestDto,
  ) {
    const updated = await this.adminRepository.moderateCommunityRequest(requestId, dto);
    await this.adminRepository.createAuditLog(adminUserId, 'MODERATE_COMMUNITY_REQUEST', 'CommunityRequest', requestId, dto as any);
    return updated;
  }

  async deleteCommunityComment(adminUserId: string, commentId: string) {
    const result = await this.adminRepository.deleteCommunityComment(commentId);
    await this.adminRepository.createAuditLog(adminUserId, 'DELETE_COMMUNITY_COMMENT', 'CommunityRequestComment', commentId);
    return result;
  }

  listMarkets() {
    return this.adminRepository.listMarkets();
  }

  async createMarket(adminUserId: string, dto: CreateMarketDto) {
    const market = await this.adminRepository.createMarket(dto);
    await this.adminRepository.createAuditLog(adminUserId, 'CREATE_MARKET', 'Market', market.id, dto as any);
    return market;
  }

  async updateMarket(adminUserId: string, marketId: string, dto: UpdateMarketDto) {
    const market = await this.adminRepository.updateMarket(marketId, dto);
    await this.adminRepository.createAuditLog(adminUserId, 'UPDATE_MARKET', 'Market', marketId, dto as any);
    return market;
  }

  listPlatformSettings() {
    return this.adminRepository.listPlatformSettings();
  }

  async upsertPlatformSetting(
    key: string,
    adminUserId: string,
    dto: UpsertPlatformSettingDto,
  ) {
    const setting = await this.adminRepository.upsertPlatformSetting(key, adminUserId, dto);
    await this.adminRepository.createAuditLog(adminUserId, 'UPSERT_PLATFORM_SETTING', 'PlatformSetting', key, dto as any);
    return setting;
  }

  listLeaderboardRules() {
    return this.adminRepository.listLeaderboardRules();
  }

  async createLeaderboardRule(adminUserId: string, dto: UpsertLeaderboardRuleDto) {
    const rule = await this.adminRepository.createLeaderboardRule(dto);
    await this.adminRepository.createAuditLog(adminUserId, 'CREATE_LEADERBOARD_RULE', 'LeaderboardRule', rule.id, dto as any);
    return rule;
  }

  async updateLeaderboardRule(adminUserId: string, ruleId: string, dto: UpsertLeaderboardRuleDto) {
    const rule = await this.adminRepository.updateLeaderboardRule(ruleId, dto);
    await this.adminRepository.createAuditLog(adminUserId, 'UPDATE_LEADERBOARD_RULE', 'LeaderboardRule', ruleId, dto as any);
    return rule;
  }

  listLeaderboards(query: AdminListQueryDto) {
    return this.adminRepository.listLeaderboards(query);
  }

  getOverviewAnalytics() {
    return this.adminRepository.getOverviewAnalytics();
  }

  getBookingsAnalytics() {
    return this.adminRepository.getBookingsAnalytics();
  }

  getPaymentsAnalytics() {
    return this.adminRepository.getPaymentsAnalytics();
  }

  getVendorsAnalytics() {
    return this.adminRepository.getVendorsAnalytics();
  }
}
