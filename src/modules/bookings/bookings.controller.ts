import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
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

  @ApiOperation({ summary: 'List bookings/orders for the authenticated customer' })
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  listMyBookings(@CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.listMyBookings(user.sub);
  }

  @ApiOperation({ summary: 'List bookings/orders for the authenticated vendor' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('vendor/mine')
  listVendorBookings(@CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.listVendorBookings(user.sub);
  }

  @ApiOperation({ summary: 'Get booking/order details for the authenticated customer or vendor' })
  @UseGuards(JwtAuthGuard)
  @Get(':bookingId')
  getBookingDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId') bookingId: string,
  ) {
    return this.bookingsService.getBookingDetails(user.sub, bookingId);
  }

  @ApiOperation({
    summary: 'Create a new booking request (Customer)',
    description:
      'Creates an event-style booking request with event type, contact phone, optional budget, preferred menu items, optional reference images, and payment preference.',
  })
  @ApiBody({
    type: CreateBookingDto,
    examples: {
      bookingFlow: {
        summary: 'Booking flow payload matching the current frontend steps',
        value: {
          foodTruckId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          bookingType: 'EVENT',
          eventType: 'BIRTHDAY_PARTY',
          eventName: 'Ava Birthday Celebration',
          eventDescription: 'Outdoor birthday event with taco and drink service',
          startsAt: '2026-08-25T18:00:00.000Z',
          endsAt: '2026-08-25T21:00:00.000Z',
          guestCount: 50,
          address: '100 Congress Ave, Austin, TX 78701',
          contactPhone: '+12025550143',
          latitude: 30.2672,
          longitude: -97.7431,
          budgetAmount: 800,
          preferredMenuItemIds: [
            '11111111-1111-4111-8111-111111111111',
            '22222222-2222-4222-8222-222222222222',
          ],
          referenceImageUrls: [
            'https://res.cloudinary.com/demo/image/upload/v1/bitedrop/bookings/reference-1.jpg',
          ],
          paymentPreference: 'DEPOSIT_ONLY',
          specialInstructions: 'Please arrive 30 minutes early for setup',
        },
      },
    },
  })
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
