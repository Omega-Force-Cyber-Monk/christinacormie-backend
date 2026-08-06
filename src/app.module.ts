import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { CheckInsModule } from './modules/check-ins/check-ins.module';
import { CommunityModule } from './modules/community/community.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { FoodTrucksModule } from './modules/food-trucks/food-trucks.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { RewardsModule } from './modules/rewards/rewards.module';
import { SocialModule } from './modules/social/social.module';
import { UsersModule } from './modules/users/users.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { LeaderboardsModule } from './modules/leaderboards/leaderboards.module';

@Module({
  imports: [
    PrismaModule,
    AdminModule,
    AuthModule,
    UsersModule,
    VendorsModule,
    FoodTrucksModule,
    DiscoveryModule,
    SocialModule,
    PromotionsModule,
    CommunityModule,
    BookingsModule,
    PaymentsModule,
    NotificationsModule,
    ReviewsModule,
    CheckInsModule,
    RewardsModule,
    ReferralsModule,
    LeaderboardsModule,
  ],
  controllers: [AppController],
})
/**
 * RATE LIMITING HARDENING:
 * If `@nestjs/throttler` is installed in production, register ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }])
 * and bind APP_GUARD with ThrottlerGuard here.
 */
export class AppModule {}
