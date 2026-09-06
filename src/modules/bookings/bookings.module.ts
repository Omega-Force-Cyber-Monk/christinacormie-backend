import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { RewardsModule } from '../rewards/rewards.module';
import { BookingsController } from './bookings.controller';
import { BookingsRepository } from './bookings.repository';
import { BookingsService } from './bookings.service';

@Module({
  imports: [JwtModule.register({}), NotificationsModule, RewardsModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsRepository, JwtAuthGuard, RolesGuard],
})
export class BookingsModule {}
