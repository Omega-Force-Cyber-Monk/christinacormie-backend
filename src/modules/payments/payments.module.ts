import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsController } from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';
import { StripeClientService } from './stripe-client.service';
import { StripeWebhookController } from './stripe-webhook.controller';

@Module({
  imports: [JwtModule.register({}), NotificationsModule],
  controllers: [PaymentsController, StripeWebhookController],
  providers: [
    PaymentsService,
    PaymentsRepository,
    StripeClientService,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class PaymentsModule {}
