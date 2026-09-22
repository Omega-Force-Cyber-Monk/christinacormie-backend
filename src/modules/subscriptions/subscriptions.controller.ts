import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { UpdateFoundingOfferDto } from './dto/update-founding-offer.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { UpsertProviderProductDto } from './dto/upsert-provider-product.dto';
import { SubscriptionsService } from './subscriptions.service';

const subscriptionStatusExample = {
  vendorId: '12441f40-2dc9-456d-948a-c33135359c70',
  plan: {
    id: '8ef2c2b6-c04d-49ca-92db-4e6d5e2ef3d1',
    code: 'PRO',
    name: 'Pro',
    monthlyPrice: 19,
    standardCommissionRate: 0.12,
    foundingCommissionRate: 0.1,
    trialDays: 90,
    features: ['starter_features', 'community_booking_requests'],
    limits: { staffAccounts: 2, truckListings: 1, bookings: true },
  },
  subscription: {
    id: '70b66cc1-1ef0-49c5-b74d-1f06fb3ef4e8',
    provider: 'REVENUECAT',
    platform: 'IOS',
    status: 'ACTIVE',
    accessActive: true,
    isFoundingVendor: true,
    currentPeriodEndsAt: '2026-11-22T00:00:00.000Z',
    willRenew: true,
    revenueCatAppUserId: '7c8c9420-0d7f-4b77-9f2b-57aa58b91541',
    productId: 'com.bitedrop.app.vendor.pro.monthly',
    entitlementId: 'vendor_subscription',
  },
  commissionRate: 0.1,
};

@ApiTags('Subscriptions')
@Controller('api/v1/subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @ApiOperation({ summary: 'List active vendor subscription plans' })
  @ApiResponse({
    status: 200,
    description: 'Active subscription plans fetched successfully',
  })
  @Get('plans')
  listPlans() {
    return this.subscriptionsService.listPublicPlans();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiOperation({ summary: 'Get current vendor subscription status' })
  @ApiResponse({ status: 200, schema: { example: subscriptionStatusExample } })
  @Get('me')
  getMySubscription(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.getMySubscription(user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiOperation({
    summary: 'Sync current vendor subscription from RevenueCat immediately',
    description:
      'Flutter/web can call this after purchase success or restore. Backend fetches the latest RevenueCat subscriber state and updates DB status.',
  })
  @ApiResponse({ status: 200, schema: { example: subscriptionStatusExample } })
  @Post('revenuecat/sync')
  @HttpCode(200)
  syncRevenueCat(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.syncMyRevenueCatSubscription(user.sub);
  }

  @ApiOperation({ summary: 'RevenueCat webhook for web/iOS/Android subscriptions' })
  @ApiBody({
    schema: {
      example: {
        event: {
          id: 'event-id',
          type: 'INITIAL_PURCHASE',
          app_user_id: '7c8c9420-0d7f-4b77-9f2b-57aa58b91541',
          product_id: 'com.bitedrop.app.vendor.pro.monthly',
          entitlement_ids: ['vendor_subscription'],
          store: 'APP_STORE',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook accepted and subscription status synced',
  })
  @Post('webhooks/revenuecat')
  @HttpCode(200)
  handleRevenueCatWebhook(
    @Body() body: unknown,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: Request & { rawBody?: Buffer },
  ) {
    return this.subscriptionsService.handleRevenueCatWebhook(
      body as any,
      headers,
      req.rawBody,
    );
  }
}

@ApiTags('Admin Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('api/v1/admin/subscriptions')
export class AdminSubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @ApiOperation({ summary: 'List all vendor subscription plans' })
  @Get('plans')
  listPlans() {
    return this.subscriptionsService.listAdminPlans();
  }

  @ApiOperation({ summary: 'Update a vendor subscription plan' })
  @Patch('plans/:planId')
  updatePlan(
    @Param('planId') planId: string,
    @Body() dto: UpdateSubscriptionPlanDto,
  ) {
    return this.subscriptionsService.updatePlan(planId, dto);
  }

  @ApiOperation({ summary: 'Create or update RevenueCat product mapping for a plan' })
  @Post('plans/:planId/provider-products')
  upsertProviderProduct(
    @Param('planId') planId: string,
    @Body() dto: UpsertProviderProductDto,
  ) {
    return this.subscriptionsService.upsertProviderProduct(planId, dto);
  }

  @ApiOperation({ summary: 'Get founding vendor offer configuration' })
  @Get('founding-offer')
  getFoundingOffer() {
    return this.subscriptionsService.getFoundingOfferStatus();
  }

  @ApiOperation({ summary: 'Update founding vendor offer configuration' })
  @Patch('founding-offer')
  updateFoundingOffer(@Body() dto: UpdateFoundingOfferDto) {
    return this.subscriptionsService.updateFoundingOffer(dto);
  }
}
