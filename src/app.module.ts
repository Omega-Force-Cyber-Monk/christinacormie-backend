import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { FoodTrucksModule } from './modules/food-trucks/food-trucks.module';
import { SocialModule } from './modules/social/social.module';
import { UsersModule } from './modules/users/users.module';
import { VendorsModule } from './modules/vendors/vendors.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    VendorsModule,
    FoodTrucksModule,
    DiscoveryModule,
    SocialModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
