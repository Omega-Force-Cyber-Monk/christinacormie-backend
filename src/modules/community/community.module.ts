import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RewardsModule } from '../rewards/rewards.module';
import { CommunityController } from './community.controller';
import { CommunityRepository } from './community.repository';
import { CommunityService } from './community.service';

@Module({
  imports: [JwtModule.register({}), RewardsModule],
  controllers: [CommunityController],
  providers: [CommunityService, CommunityRepository, JwtAuthGuard, RolesGuard],
})
export class CommunityModule {}
