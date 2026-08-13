import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateBookingPaymentDto } from './dto/create-booking-payment.dto';
import { CreateConnectAccountDto } from './dto/create-connect-account.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { NotificationEventType } from '../notifications/enums/notification-event-type.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsRepository } from './payments.repository';
import { StripeClientService } from './stripe-client.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly notificationsService: NotificationsService,
    private readonly stripeClient: StripeClientService,
  ) {}

  async createConnectAccount(userId: string, dto: CreateConnectAccountDto) {
    const vendor = await this.ensureVendor(userId);
    let paymentAccount = vendor.paymentAccount;

    if (!paymentAccount) {
      const stripeAccount = await this.stripeClient.createConnectAccount(
        dto.country ?? 'US',
      );

      paymentAccount = await this.paymentsRepository.upsertVendorPaymentAccount(
        vendor.id,
        stripeAccount.id,
        {
          onboardingCompleted: Boolean(stripeAccount.details_submitted),
          chargesEnabled: Boolean(stripeAccount.charges_enabled),
          payoutsEnabled: Boolean(stripeAccount.payouts_enabled),
          disabledReason: stripeAccount.requirements?.disabled_reason ?? null,
        },
      );
    }

    const refreshUrl =
      dto.refreshUrl ?? process.env.STRIPE_CONNECT_REFRESH_URL;
    const returnUrl = dto.returnUrl ?? process.env.STRIPE_CONNECT_RETURN_URL;

    if (!refreshUrl || !returnUrl) {
      throw new BadRequestException(
        'Stripe Connect refresh/return URLs are not configured',
      );
    }

    const accountLink = await this.stripeClient.createAccountLink(
      paymentAccount.stripeAccountId,
      refreshUrl,
      returnUrl,
    );

    return {
      paymentAccount,
      onboardingUrl: accountLink.url,
    };
  }

  async getVendorPaymentAccount(userId: string) {
    const vendor = await this.ensureVendor(userId);
    return vendor.paymentAccount;
  }

  async getVendorPayouts(userId: string) {
    const vendor = await this.ensureVendor(userId);
    return this.paymentsRepository.findVendorPayouts(vendor.id);
  }

  async createBookingPaymentIntent(
    userId: string,
    bookingId: string,
    dto: CreateBookingPaymentDto,
  ) {
    const existingPayment =
      await this.paymentsRepository.findPaymentByIdempotencyKey(
        dto.idempotencyKey,
      );

    if (existingPayment) {
      return { payment: existingPayment, clientSecret: null };
    }

    const booking = await this.paymentsRepository.findBookingForPayment(
      bookingId,
    );

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.customerId !== userId) {
      throw new ForbiddenException('Booking does not belong to this customer');
    }

    if (booking.status !== 'PAYMENT_PENDING') {
      throw new BadRequestException('Booking is not ready for payment');
    }

    if (booking.payments.some((payment) => payment.status === 'SUCCEEDED')) {
      throw new BadRequestException('Booking is already paid');
    }

    if (
      booking.payments.some((payment) =>
        ['PENDING', 'PROCESSING'].includes(payment.status),
      )
    ) {
      throw new BadRequestException('Booking already has a payment in progress');
    }

    if (!booking.vendor.paymentAccount?.stripeAccountId) {
      throw new BadRequestException('Vendor payment account is not ready');
    }

    const amount = Number(booking.totalAmount);

    if (amount <= 0) {
      throw new BadRequestException('Booking amount must be greater than zero');
    }

    const currency = dto.currency ?? 'USD';
    let payment;

    try {
      payment = await this.paymentsRepository.createPaymentRecord({
        bookingId,
        payerUserId: userId,
        vendorId: booking.vendorId,
        amount,
        currency,
        idempotencyKey: dto.idempotencyKey,
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const duplicate =
          await this.paymentsRepository.findPaymentByIdempotencyKey(
            dto.idempotencyKey,
          );
        return { payment: duplicate, clientSecret: null };
      }

      throw error;
    }

    let paymentResponse: { payment: any; clientSecret: string | null } | null = null;

    try {
      const commission = this.calculateCommission(amount);
      const paymentIntent = await this.stripeClient.createPaymentIntent(
        {
          amount: this.toMinorUnit(amount),
          currency,
          connectedAccountId: booking.vendor.paymentAccount.stripeAccountId,
          applicationFeeAmount: this.toMinorUnit(commission.amount),
          paymentId: payment.id,
          bookingId,
        },
        { idempotencyKey: dto.idempotencyKey },
      );

      await this.paymentsRepository.updatePaymentIntent(
        payment.id,
        paymentIntent.id,
      );

      paymentResponse = {
        payment: {
          ...payment,
          stripePaymentIntentId: paymentIntent.id,
          status: 'PROCESSING',
        },
        clientSecret: paymentIntent.client_secret,
      };
    } catch (error) {
      await this.paymentsRepository.markPaymentStatusById(payment.id, 'FAILED');
      throw error;
    }

    if (!paymentResponse) {
      throw new BadRequestException('Payment could not be initialized');
    }

    await this.notificationsService.notifyPaymentUpdate(
      paymentResponse.payment,
      'Payment started',
      `Payment for booking ${booking.bookingNumber} has started.`,
    );

    return paymentResponse;
  }

  async getPayment(userId: string, paymentId: string) {
    const payment = await this.paymentsRepository.findPaymentById(paymentId);

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.payerUserId === userId) {
      return payment;
    }

    const vendor = await this.paymentsRepository.findVendorByUserId(userId);

    if (!vendor || payment.vendorId !== vendor.id) {
      throw new ForbiddenException('Payment is not visible to this user');
    }

    return payment;
  }

  async createRefund(userId: string, paymentId: string, dto: CreateRefundDto) {
    const payment = await this.paymentsRepository.findPaymentById(paymentId);

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const vendor = await this.ensureVendor(userId);

    if (payment.vendorId !== vendor.id) {
      throw new ForbiddenException('Payment does not belong to this vendor');
    }

    if (payment.status !== 'SUCCEEDED') {
      throw new BadRequestException('Only succeeded payments can be refunded');
    }

    if (!payment.stripePaymentIntentId) {
      throw new BadRequestException('Payment has no Stripe payment intent');
    }

    const amount = dto.amount ?? Number(payment.amount);

    if (amount > Number(payment.amount)) {
      throw new BadRequestException('Refund amount exceeds payment amount');
    }

    const stripeRefund = await this.stripeClient.createRefund(
      {
        paymentIntentId: payment.stripePaymentIntentId,
        amount: this.toMinorUnit(amount),
        reason: this.toStripeRefundReason(dto.reason),
        paymentId: payment.id,
      },
      { idempotencyKey: `refund-${payment.id}-${amount}` },
    );

    const refund = await this.paymentsRepository.createRefundRecord({
      paymentId: payment.id,
      stripeRefundId: stripeRefund.id,
      amount,
      reason: dto.reason,
      status: this.mapStripeRefundStatus(stripeRefund.status),
    });

    await this.notificationsService.notifyPaymentUpdate(
      payment,
      'Refund started',
      `Refund for booking ${payment.booking.bookingNumber} has started.`,
    );

    return refund;
  }

  async processStripeWebhook(rawBody: Buffer, signatureHeader: string) {
    const event = this.stripeClient.verifyWebhookSignature(
      rawBody,
      signatureHeader,
    );

    try {
      await this.paymentsRepository.createWebhookEvent(event.id, event.type);
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const existing = await this.paymentsRepository.findWebhookEvent(event.id);

        if (existing?.status !== 'FAILED') {
          return { received: true, duplicate: true };
        }

        await this.paymentsRepository.markWebhookProcessing(event.id);
      }
      if (error?.code !== 'P2002') {
        throw error;
      }
    }

    try {
      await this.handleStripeEvent(event);
      await this.paymentsRepository.markWebhookProcessed(event.id);
      return { received: true };
    } catch (error: any) {
      await this.paymentsRepository.markWebhookFailed(
        event.id,
        error?.message ?? 'Webhook processing failed',
      );
      throw error;
    }
  }

  private async handleStripeEvent(event: any) {
    const object = event.data?.object;

    switch (event.type) {
      case 'account.updated':
        await this.handleAccountUpdated(object);
        return;
      case 'payment_intent.succeeded':
        await this.handlePaymentSucceeded(object);
        return;
      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentStatus(object, 'FAILED');
        return;
      case 'payment_intent.canceled':
        await this.handlePaymentIntentStatus(object, 'CANCELLED');
        return;
      case 'refund.created':
      case 'refund.updated':
      case 'refund.failed':
      case 'charge.refund.updated':
        await this.handleRefundUpdated(object);
        return;
      case 'charge.refunded':
        return;
      default:
        return;
    }
  }

  private async handleAccountUpdated(account: any) {
    const existing =
      await this.paymentsRepository.findVendorPaymentAccountByStripeId(
        account.id,
      );

    if (!existing) {
      return;
    }

    await this.paymentsRepository.updateVendorPaymentAccountByStripeId(
      account.id,
      {
        onboardingCompleted: Boolean(account.details_submitted),
        chargesEnabled: Boolean(account.charges_enabled),
        payoutsEnabled: Boolean(account.payouts_enabled),
        disabledReason: account.requirements?.disabled_reason ?? null,
      },
    );
  }

  private async handlePaymentSucceeded(paymentIntent: any) {
    const payment =
      await this.paymentsRepository.findPaymentByStripePaymentIntentId(
        paymentIntent.id,
      );

    if (!payment || payment.status === 'SUCCEEDED') {
      return;
    }

    const amount = Number(payment.amount);
    const updatedPayment = await this.paymentsRepository.markPaymentSucceeded(
      paymentIntent.id,
      this.calculateCommission(amount),
    );

    await this.notificationsService.notifyPaymentUpdate(
      updatedPayment,
      'Payment succeeded',
      `Payment for booking ${updatedPayment.booking.bookingNumber} succeeded.`,
      NotificationEventType.PAYMENT_SUCCEEDED,
    );

    await this.notificationsService.notifyVendorPaymentUpdate(
      updatedPayment,
      'Payment received',
      `Payment for booking ${updatedPayment.booking.bookingNumber} succeeded.`,
      NotificationEventType.PAYMENT_SUCCEEDED,
    );
  }

  private async handlePaymentIntentStatus(paymentIntent: any, status: string) {
    const payment =
      await this.paymentsRepository.findPaymentByStripePaymentIntentId(
        paymentIntent.id,
      );

    if (!payment) {
      return;
    }

    const updatedPayment = await this.paymentsRepository.markPaymentStatus(
      paymentIntent.id,
      status,
    );

    await this.notificationsService.notifyPaymentUpdate(
      updatedPayment,
      'Payment update',
      `Payment for booking ${updatedPayment.booking.bookingNumber} is ${status}.`,
      NotificationEventType.PAYMENT_FAILED,
    );
  }

  private async handleRefundUpdated(refund: any) {
    if (refund.status === 'succeeded') {
      await this.paymentsRepository.markRefundSucceeded(
        refund.id,
        refund.payment_intent,
        refund.amount ? refund.amount / 100 : undefined,
      );
      return;
    }

    if (refund.status === 'failed') {
      await this.paymentsRepository.markRefundFailed(refund.id);
    }
  }

  private async ensureVendor(userId: string) {
    const vendor = await this.paymentsRepository.findVendorByUserId(userId);

    if (!vendor) {
      throw new ForbiddenException('Vendor profile is required');
    }

    return vendor;
  }

  private calculateCommission(amount: number) {
    const rate = Number(process.env.PLATFORM_COMMISSION_RATE ?? 0.1);
    const commissionAmount = Number((amount * rate).toFixed(2));

    return {
      rate,
      amount: commissionAmount,
      vendorNetAmount: Number((amount - commissionAmount).toFixed(2)),
    };
  }

  private toMinorUnit(amount: number) {
    return Math.round(amount * 100);
  }

  private toStripeRefundReason(reason?: string) {
    if (
      reason === 'duplicate' ||
      reason === 'fraudulent' ||
      reason === 'requested_by_customer'
    ) {
      return reason;
    }

    return undefined;
  }

  private mapStripeRefundStatus(status: string) {
    if (status === 'succeeded') {
      return 'REFUNDED';
    }

    if (status === 'failed') {
      return 'FAILED';
    }

    if (status === 'canceled') {
      return 'CANCELLED';
    }

    return 'PENDING';
  }
}
