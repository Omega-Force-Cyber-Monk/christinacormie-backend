import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { RewardsModule } from '../rewards/rewards.module';
import { SocialController } from './social.controller';
import { SocialRepository } from './social.repository';
import { SocialService } from './social.service';

@Module({
  imports: [JwtModule.register({}), NotificationsModule, RewardsModule],
  controllers: [SocialController],
  providers: [SocialService, SocialRepository, JwtAuthGuard, RolesGuard],
})
export class SocialModule {}
