import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findVendorByUserId(userId: string) {
    return this.prisma.vendor.findUnique({
      where: { userId },
      include: { paymentAccount: true },
    });
  }

  findVendorPaymentAccount(vendorId: string) {
    return this.prisma.vendorPaymentAccount.findUnique({
      where: { vendorId },
    });
  }

  findVendorPayouts(vendorId: string) {
    return this.prisma.payout.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findVendorPaymentAccountByStripeId(stripeAccountId: string) {
    return this.prisma.vendorPaymentAccount.findUnique({
      where: { stripeAccountId },
    });
  }

  upsertVendorPaymentAccount(
    vendorId: string,
    stripeAccountId: string,
    values: {
      onboardingCompleted?: boolean;
      chargesEnabled?: boolean;
      payoutsEnabled?: boolean;
      disabledReason?: string | null;
    } = {},
  ) {
    return this.prisma.vendorPaymentAccount.upsert({
      where: { vendorId },
      create: {
        vendorId,
        stripeAccountId,
        onboardingCompleted: values.onboardingCompleted ?? false,
        chargesEnabled: values.chargesEnabled ?? false,
        payoutsEnabled: values.payoutsEnabled ?? false,
        disabledReason: values.disabledReason,
      },
      update: {
        stripeAccountId,
        ...values,
        updatedAt: new Date(),
      },
    });
  }

  updateVendorPaymentAccountByStripeId(
    stripeAccountId: string,
    values: {
      onboardingCompleted?: boolean;
      chargesEnabled?: boolean;
      payoutsEnabled?: boolean;
      disabledReason?: string | null;
    },
  ) {
    return this.prisma.vendorPaymentAccount.update({
      where: { stripeAccountId },
      data: {
        ...values,
        updatedAt: new Date(),
      },
    });
  }

  findBookingForPayment(bookingId: string) {
    return this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        vendor: {
          include: { paymentAccount: true },
        },
        payments: {
          where: {
            status: { in: ['PENDING', 'PROCESSING', 'SUCCEEDED'] as any },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  findPaymentById(paymentId: string) {
    return this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: true,
        vendor: {
          select: {
            id: true,
            userId: true,
          },
        },
        commission: true,
        refunds: true,
      },
    });
  }

  findPaymentByIdempotencyKey(idempotencyKey: string) {
    return this.prisma.payment.findUnique({
      where: { idempotencyKey },
      include: {
        booking: true,
        vendor: {
          select: {
            id: true,
            userId: true,
          },
        },
        commission: true,
        refunds: true,
      },
    });
  }

  findPaymentByStripePaymentIntentId(stripePaymentIntentId: string) {
    return this.prisma.payment.findUnique({
      where: { stripePaymentIntentId },
      include: {
        booking: true,
        vendor: {
          select: {
            id: true,
            userId: true,
          },
        },
        commission: true,
        refunds: true,
      },
    });
  }

  createPaymentRecord(data: {
    bookingId: string;
    payerUserId: string;
    vendorId: string;
    amount: number;
    currency: string;
    idempotencyKey: string;
  }) {
    return this.prisma.payment.create({
      data: {
        bookingId: data.bookingId,
        payerUserId: data.payerUserId,
        vendorId: data.vendorId,
        amount: data.amount,
        currency: data.currency.toUpperCase(),
        idempotencyKey: data.idempotencyKey,
        status: 'PENDING' as any,
      },
      include: {
        booking: true,
      },
    });
  }

  updatePaymentIntent(
    paymentId: string,
    stripePaymentIntentId: string,
    status = 'PROCESSING',
  ) {
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        stripePaymentIntentId,
        status: status as any,
      },
      include: {
        booking: true,
        vendor: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });
  }

  markPaymentSucceeded(
    stripePaymentIntentId: string,
    commission: {
      rate: number;
      amount: number;
      vendorNetAmount: number;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.update({
        where: { stripePaymentIntentId },
        data: {
          status: 'SUCCEEDED' as any,
          paidAt: new Date(),
        },
        include: {
          booking: true,
          vendor: {
            select: {
              id: true,
              userId: true,
            },
          },
        },
      });

      await tx.booking.update({
        where: { id: payment.bookingId },
        data: {
          status: 'CONFIRMED' as any,
          confirmedAt: new Date(),
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: payment.bookingId,
          previousStatus: payment.booking.status as any,
          newStatus: 'CONFIRMED' as any,
          reason: 'Payment succeeded',
        },
      });

      await tx.commission.upsert({
        where: { paymentId: payment.id },
        create: {
          paymentId: payment.id,
          bookingId: payment.bookingId,
          vendorId: payment.vendorId,
          grossAmount: payment.amount,
          commissionRate: commission.rate,
          commissionAmount: commission.amount,
          vendorNetAmount: commission.vendorNetAmount,
        },
        update: {},
      });

      await tx.payout.create({
        data: {
          vendorId: payment.vendorId,
          amount: commission.vendorNetAmount,
          currency: payment.currency,
          status: 'PENDING' as any,
        },
      });

      return payment;
    });
  }

  markPaymentStatus(stripePaymentIntentId: string, status: string) {
    return this.prisma.payment.update({
      where: { stripePaymentIntentId },
      data: { status: status as any },
      include: {
        booking: true,
        vendor: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });
  }

  markPaymentStatusById(paymentId: string, status: string) {
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: status as any },
    });
  }

  createRefundRecord(data: {
    paymentId: string;
    stripeRefundId?: string;
    amount: number;
    reason?: string;
    status: string;
  }) {
    return this.prisma.refund.create({
      data: {
        paymentId: data.paymentId,
        stripeRefundId: data.stripeRefundId,
        amount: data.amount,
        reason: data.reason,
        status: data.status as any,
      },
    });
  }

  async markRefundSucceeded(
    stripeRefundId: string,
    paymentIntentId?: string,
    refundedAmount?: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const refund = await tx.refund.update({
        where: { stripeRefundId },
        data: {
          status: 'REFUNDED' as any,
          processedAt: new Date(),
        },
      });

      if (paymentIntentId) {
        const payment = await tx.payment.findUnique({
          where: { stripePaymentIntentId: paymentIntentId },
        });

        if (payment) {
          const isPartial =
            refundedAmount !== undefined && refundedAmount < Number(payment.amount);

          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: (isPartial ? 'PARTIALLY_REFUNDED' : 'REFUNDED') as any,
            },
          });
        }
      }

      return refund;
    });
  }

  markRefundFailed(stripeRefundId: string) {
    return this.prisma.refund.update({
      where: { stripeRefundId },
      data: { status: 'FAILED' as any },
    });
  }

  createWebhookEvent(stripeEventId: string, eventType: string) {
    return (this.prisma as any).stripeWebhookEvent.create({
      data: {
        stripeEventId,
        eventType,
      },
    });
  }

  findWebhookEvent(stripeEventId: string) {
    return (this.prisma as any).stripeWebhookEvent.findUnique({
      where: { stripeEventId },
    });
  }

  markWebhookProcessing(stripeEventId: string) {
    return (this.prisma as any).stripeWebhookEvent.update({
      where: { stripeEventId },
      data: {
        status: 'PROCESSING',
        error: null,
      },
    });
  }

  markWebhookProcessed(stripeEventId: string) {
    return (this.prisma as any).stripeWebhookEvent.update({
      where: { stripeEventId },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    });
  }

  markWebhookFailed(stripeEventId: string, error: string) {
    return (this.prisma as any).stripeWebhookEvent.update({
      where: { stripeEventId },
      data: {
        status: 'FAILED',
        error,
        processedAt: new Date(),
      },
    });
  }
}
