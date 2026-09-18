import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { CreateBookingPaymentDto } from './dto/create-booking-payment.dto';
import { CreateConnectAccountDto } from './dto/create-connect-account.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('api/v1/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiOperation({
    summary: 'Create or continue vendor Stripe Connect onboarding',
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('connect/account')
  getVendorPaymentAccount(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.getVendorPaymentAccount(user.sub);
  }

  @ApiOperation({ summary: 'List payouts for the authenticated vendor' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('payouts/mine')
  getVendorPayouts(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.getVendorPayouts(user.sub);
  }

  @ApiOperation({
    summary: 'Create a Stripe payment intent for booking payment',
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
  @UseGuards(JwtAuthGuard)
  @Get(':paymentId')
  getPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId') paymentId: string,
  ) {
    return this.paymentsService.getPayment(user.sub, paymentId);
  }

  @ApiOperation({ summary: 'Create a refund for a payment (Vendor)' })
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
