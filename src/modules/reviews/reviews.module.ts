import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RewardsModule } from '../rewards/rewards.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsRepository } from './reviews.repository';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [JwtModule.register({}), RewardsModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewsRepository, JwtAuthGuard, RolesGuard],
  exports: [ReviewsService],
})
export class ReviewsModule {}
