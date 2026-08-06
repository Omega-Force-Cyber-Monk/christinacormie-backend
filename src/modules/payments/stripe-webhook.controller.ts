import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

@Controller('api/v1/payments/webhooks/stripe')
export class StripeWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(200)
  handleStripeWebhook(
    @Req() request: RawBodyRequest,
    @Headers('stripe-signature') signature?: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Stripe signature header is required');
    }

    if (!request.rawBody) {
      throw new BadRequestException('Raw request body is required');
    }

    return this.paymentsService.processStripeWebhook(
      request.rawBody,
      signature,
    );
  }
}
