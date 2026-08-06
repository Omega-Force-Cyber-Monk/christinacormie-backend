import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { RewardsModule } from '../rewards/rewards.module';
import {
  CheckInAnalyticsController,
  CheckInsController,
} from './check-ins.controller';
import { CheckInsRepository } from './check-ins.repository';
import { CheckInsService } from './check-ins.service';

@Module({
  imports: [JwtModule.register({}), NotificationsModule, RewardsModule],
  controllers: [CheckInsController, CheckInAnalyticsController],
  providers: [CheckInsService, CheckInsRepository, JwtAuthGuard, RolesGuard],
  exports: [CheckInsService],
})
export class CheckInsModule {}
