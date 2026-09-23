import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { MailModule } from './infrastructure/mail/mail.module';
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
import { MessagingModule } from './modules/messaging/messaging.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { RewardsModule } from './modules/rewards/rewards.module';
import { SocialModule } from './modules/social/social.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { UsersModule } from './modules/users/users.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { LeaderboardsModule } from './modules/leaderboards/leaderboards.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: Number(process.env.RATE_LIMIT_GLOBAL_PER_MINUTE ?? 120),
      },
    ]),
    MailModule,
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
    MessagingModule,
    ReviewsModule,
    CheckInsModule,
    RewardsModule,
    ReferralsModule,
    SubscriptionsModule,
    LeaderboardsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
