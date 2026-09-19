import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { CreateBookingPaymentDto } from './dto/create-booking-payment.dto';
import { CreateConnectAccountDto } from './dto/create-connect-account.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { CreateVendorSubscriptionDto } from './dto/create-vendor-subscription.dto';
import { PaymentsService } from './payments.service';

const errorExample = (
  statusCode: number,
  message: string | string[],
  error: string,
) => ({ statusCode, message, error });

const paymentAccountExample = {
  id: '7e7f3f6a-f047-49a4-8a01-4bbfd8e8ad1b',
  vendorId: '3f4c4f1e-09d0-4f3c-9b8d-3a4dc3a3f7b2',
  stripeAccountId: 'acct_1QYpK2BiteDropDemo',
  onboardingCompleted: false,
  chargesEnabled: false,
  payoutsEnabled: false,
  disabledReason: 'requirements.past_due',
  updatedAt: '2026-09-19T10:00:00.000Z',
};

const payoutExample = {
  id: '9e8f3f6a-f047-49a4-8a01-4bbfd8e8ad1b',
  vendorId: '3f4c4f1e-09d0-4f3c-9b8d-3a4dc3a3f7b2',
  bookingId: '6c7d3f6a-f047-49a4-8a01-4bbfd8e8ad1b',
  paymentId: '4a1f3f6a-f047-49a4-8a01-4bbfd8e8ad1b',
  stripeTransferId: null,
  amount: '204.00',
  currency: 'USD',
  status: 'PENDING',
  failureReason: null,
  paidAt: null,
  createdAt: '2026-09-19T10:05:00.000Z',
};

const paymentExample = {
  id: '4a1f3f6a-f047-49a4-8a01-4bbfd8e8ad1b',
  bookingId: '6c7d3f6a-f047-49a4-8a01-4bbfd8e8ad1b',
  payerUserId: 'd270a18e-a866-4dc4-ab7c-031b600e0bbf',
  vendorId: '3f4c4f1e-09d0-4f3c-9b8d-3a4dc3a3f7b2',
  stripePaymentIntentId: 'pi_3QYpK2BiteDropDemo',
  stripeCheckoutSessionId: null,
  amount: '240.00',
  currency: 'USD',
  status: 'PROCESSING',
  idempotencyKey: 'booking-6c7d3f6a-payment-1',
  paidAt: null,
  createdAt: '2026-09-19T10:04:00.000Z',
  commission: null,
  payout: null,
  refunds: [],
};

const refundExample = {
  id: '5b2f3f6a-f047-49a4-8a01-4bbfd8e8ad1b',
  paymentId: '4a1f3f6a-f047-49a4-8a01-4bbfd8e8ad1b',
  stripeRefundId: 're_3QYpK2BiteDropDemo',
  amount: '150.00',
  reason: 'Customer cancelled booking in advance per policy',
  status: 'PROCESSING',
  processedAt: null,
};

const vendorSubscriptionExample = {
  vendor: {
    id: '3f4c4f1e-09d0-4f3c-9b8d-3a4dc3a3f7b2',
    selectedPlan: 'STARTER',
    subscriptionStatus: 'INCOMPLETE',
    stripeCustomerId: 'cus_1QYpK2BiteDropDemo',
    stripeSubscriptionId: 'sub_1QYpK2BiteDropDemo',
    trialStartedAt: '2026-09-19T10:00:00.000Z',
    trialEndsAt: '2026-12-18T10:00:00.000Z',
    subscriptionCurrentPeriodEnd: '2026-12-18T10:00:00.000Z',
    isFoundingMember: true,
    foundingDiscountEndsAt: '2027-09-19T10:00:00.000Z',
    lockedCommissionRate: '0.120',
  },
  stripe: {
    publishableKey: 'pk_test_...',
    customerId: 'cus_1QYpK2BiteDropDemo',
    customerEphemeralKeySecret: 'ek_test_...',
    subscriptionId: 'sub_1QYpK2BiteDropDemo',
    clientSecret: 'seti_1QYpK2BiteDropDemo_secret_abc123',
    clientSecretType: 'setup_intent',
  },
};

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('api/v1/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiOperation({
    summary: 'Create or continue vendor Stripe Connect onboarding',
  })
  @ApiResponse({
    status: 201,
    description: 'Stripe Connect onboarding link created successfully.',
    schema: {
      example: {
        paymentAccount: paymentAccountExample,
        onboardingUrl:
          'https://connect.stripe.com/setup/s/acct_1QYpK2BiteDropDemo/abc123',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Stripe Connect URLs are missing or validation failed.',
    schema: {
      example: errorExample(
        400,
        'Stripe Connect refresh/return URLs are not configured',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Vendor account is not approved/verified.',
    schema: {
      example: errorExample(
        403,
        'Vendor account is not approved yet. Please complete onboarding and submit verification documents for admin review.',
        'Forbidden',
      ),
    },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('connect/accounts')
  createConnectAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateConnectAccountDto,
  ) {
    return this.paymentsService.createConnectAccount(user.sub, dto);
  }

  @ApiOperation({ summary: 'Get vendor Stripe payment account details' })
  @ApiResponse({
    status: 200,
    description: 'Vendor payment account returned successfully.',
    schema: { example: paymentAccountExample },
  })
  @ApiResponse({
    status: 200,
    description: 'Vendor has not created a Stripe payment account yet.',
    schema: { example: null },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('connect/account')
  getVendorPaymentAccount(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.getVendorPaymentAccount(user.sub);
  }

  @ApiOperation({ summary: 'List payouts for the authenticated vendor' })
  @ApiResponse({
    status: 200,
    description: 'Vendor payouts returned successfully.',
    schema: { example: [payoutExample] },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('payouts/mine')
  getVendorPayouts(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.getVendorPayouts(user.sub);
  }

  @ApiOperation({
    summary:
      'Create native Stripe subscription intent for vendor paid plan',
    description:
      'Use this for in-app/native card payment. It creates or reuses a Stripe customer, creates a Stripe subscription with the configured paid-plan price, and returns PaymentSheet-ready secrets. It does not return a hosted Stripe Checkout link.',
  })
  @ApiResponse({
    status: 201,
    description: 'Vendor subscription intent created successfully.',
    schema: { example: vendorSubscriptionExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Plan is invalid/free or Stripe plan price is missing.',
    schema: {
      example: errorExample(
        400,
        'Stripe price id is not configured for STARTER plan',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Vendor profile does not exist.',
    schema: {
      example: errorExample(403, 'Vendor profile is required', 'Forbidden'),
    },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('vendors/me/subscription-intent')
  createVendorSubscriptionIntent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVendorSubscriptionDto,
  ) {
    return this.paymentsService.createVendorSubscriptionIntent(user.sub, dto);
  }

  @ApiOperation({
    summary: 'Create a Stripe payment intent for booking payment',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment intent created successfully.',
    schema: {
      example: {
        payment: paymentExample,
        clientSecret:
          'pi_3QYpK2BiteDropDemo_secret_8sJd9f0BiteDropDemo',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Idempotency key was reused; existing payment returned.',
    schema: {
      example: {
        payment: paymentExample,
        clientSecret: null,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Booking is not payment-ready or vendor payout setup is not ready.',
    schema: {
      example: errorExample(
        400,
        'Vendor payout setup is not ready. The vendor must complete Stripe onboarding and enable payouts before customer payment can be accepted.',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Booking does not belong to the authenticated customer.',
    schema: {
      example: errorExample(
        403,
        'Booking does not belong to this customer',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Booking was not found.',
    schema: { example: errorExample(404, 'Booking not found', 'Not Found') },
  })
  @UseGuards(JwtAuthGuard)
  @Post('bookings/:bookingId/payment-intent')
  createBookingPaymentIntent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId') bookingId: string,
    @Body() dto: CreateBookingPaymentDto,
  ) {
    return this.paymentsService.createBookingPaymentIntent(
      user.sub,
      bookingId,
      dto,
    );
  }

  @ApiOperation({ summary: 'Get booking payment details' })
  @ApiResponse({
    status: 200,
    description: 'Payment details returned successfully.',
    schema: {
      example: {
        ...paymentExample,
        status: 'SUCCEEDED',
        paidAt: '2026-09-19T10:06:00.000Z',
        commission: {
          id: '8d3f3f6a-f047-49a4-8a01-4bbfd8e8ad1b',
          paymentId: paymentExample.id,
          bookingId: paymentExample.bookingId,
          vendorId: paymentExample.vendorId,
          grossAmount: '240.00',
          commissionRate: '0.150',
          commissionAmount: '36.00',
          vendorNetAmount: '204.00',
          createdAt: '2026-09-19T10:06:00.000Z',
        },
        payout: payoutExample,
        refunds: [],
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Payment is not visible to current user.',
    schema: {
      example: errorExample(
        403,
        'Payment is not visible to this user',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Payment was not found.',
    schema: { example: errorExample(404, 'Payment not found', 'Not Found') },
  })
  @UseGuards(JwtAuthGuard)
  @Get(':paymentId')
  getPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId') paymentId: string,
  ) {
    return this.paymentsService.getPayment(user.sub, paymentId);
  }

  @ApiOperation({ summary: 'Create a refund for a payment (Vendor)' })
  @ApiResponse({
    status: 201,
    description: 'Refund started successfully.',
    schema: { example: refundExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Payment cannot be refunded.',
    schema: {
      example: errorExample(
        400,
        'Only succeeded payments can be refunded',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Payment does not belong to current vendor.',
    schema: {
      example: errorExample(
        403,
        'Payment does not belong to this vendor',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Payment was not found.',
    schema: { example: errorExample(404, 'Payment not found', 'Not Found') },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post(':paymentId/refunds')
  createRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId') paymentId: string,
    @Body() dto: CreateRefundDto,
  ) {
    return this.paymentsService.createRefund(user.sub, paymentId, dto);
  }
}
