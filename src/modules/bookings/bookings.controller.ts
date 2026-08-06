import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { AcceptBookingQuoteDto } from './dto/accept-booking-quote.dto';
import { CreateBookingQuoteDto } from './dto/create-booking-quote.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { VendorBookingDecisionDto } from './dto/vendor-booking-decision.dto';
import { BookingsService } from './bookings.service';

@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('api/v1/bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @ApiOperation({ summary: 'Create a new booking request (Customer)' })
  @UseGuards(JwtAuthGuard)
  @Post()
  createBookingRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingsService.createBookingRequest(user.sub, dto);
  }

  @ApiOperation({ summary: 'Accept a booking request (Vendor)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch(':bookingId/accept')
  vendorAcceptBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId') bookingId: string,
    @Body() dto: VendorBookingDecisionDto,
  ) {
    return this.bookingsService.vendorAcceptBooking(user.sub, bookingId, dto);
  }

  @ApiOperation({ summary: 'Reject a booking request (Vendor)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch(':bookingId/reject')
  vendorRejectBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId') bookingId: string,
    @Body() dto: VendorBookingDecisionDto,
  ) {
    return this.bookingsService.vendorRejectBooking(user.sub, bookingId, dto);
  }

  @ApiOperation({ summary: 'Provide a price quote for a booking (Vendor)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post(':bookingId/quotes')
  createVendorQuote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId') bookingId: string,
    @Body() dto: CreateBookingQuoteDto,
  ) {
    return this.bookingsService.createVendorQuote(user.sub, bookingId, dto);
  }

  @ApiOperation({ summary: 'Accept a vendor quote for a booking (Customer)' })
  @UseGuards(JwtAuthGuard)
  @Patch('quotes/:quoteId/accept')
  customerAcceptQuote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('quoteId') quoteId: string,
    @Body() dto: AcceptBookingQuoteDto,
  ) {
    return this.bookingsService.customerAcceptQuote(user.sub, quoteId, dto);
  }
}
