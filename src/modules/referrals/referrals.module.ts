import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { RewardsModule } from '../rewards/rewards.module';
import { ReferralsController } from './referrals.controller';
import { ReferralsRepository } from './referrals.repository';
import { ReferralsService } from './referrals.service';

@Module({
  imports: [JwtModule.register({}), NotificationsModule, RewardsModule],
  controllers: [ReferralsController],
  providers: [ReferralsService, ReferralsRepository, JwtAuthGuard, RolesGuard],
  exports: [ReferralsService],
})
export class ReferralsModule {}
