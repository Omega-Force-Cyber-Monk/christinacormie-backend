import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AdminSubscriptionsController,
  SubscriptionsController,
} from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [SubscriptionsController, AdminSubscriptionsController],
  providers: [SubscriptionsService, JwtAuthGuard, RolesGuard],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
