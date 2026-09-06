import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { RewardsController } from './rewards.controller';
import { RewardsRepository } from './rewards.repository';
import { RewardsService } from './rewards.service';

@Module({
  imports: [JwtModule.register({}), NotificationsModule],
  controllers: [RewardsController],
  providers: [RewardsService, RewardsRepository, JwtAuthGuard, RolesGuard],
  exports: [RewardsService],
})
export class RewardsModule {}
