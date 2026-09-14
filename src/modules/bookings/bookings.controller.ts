import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
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
import { AcceptBookingQuoteDto } from './dto/accept-booking-quote.dto';
import { CreateBookingQuoteDto } from './dto/create-booking-quote.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { VendorBookingDecisionDto } from './dto/vendor-booking-decision.dto';
import { BookingsService } from './bookings.service';

const errorExample = (
  statusCode: number,
  message: string | string[],
  error: string,
) => ({
  statusCode,
  message,
  error,
});

const unauthorizedExample = errorExample(401, 'Unauthorized', 'Unauthorized');
const forbiddenRoleExample = errorExample(
  403,
  'Forbidden resource',
  'Forbidden',
);
const vendorApprovalErrorExample = errorExample(
  403,
  'Vendor account is not approved yet. Please complete onboarding and submit verification documents for admin review.',
  'Forbidden',
);

const bookingExample = {
  id: 'booking-id',
  bookingNumber: 'BD-20260908-AB12CD',
  customerId: 'customer-user-id',
  vendorId: 'vendor-id',
  foodTruckId: 'food-truck-id',
  communityRequestId: null,
  vendorOfferId: null,
  bookingType: 'EVENT',
  eventType: 'BIRTHDAY_PARTY',
  eventName: 'Ava Birthday Celebration',
  eventDescription: 'Outdoor birthday event with taco and drink service',
  startsAt: '2026-09-25T18:00:00.000Z',
  endsAt: '2026-09-25T21:00:00.000Z',
  guestCount: 50,
  address: '100 Congress Ave, Austin, TX 78701',
  contactPhone: '+12025550143',
  distanceFromServiceCenterKm: 4.2,
  outsideServiceRadius: false,
  outsideRadiusFee: 0,
  budgetAmount: 800,
  subtotal: 0,
  serviceFee: 0,
  taxAmount: 0,
  discountAmount: 0,
  totalAmount: 0,
  paymentPreference: 'DEPOSIT_ONLY',
  preferredMenuItemIds: [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
  ],
  customMenuItems: ['Extra spicy chicken tacos', 'Vegetarian platter'],
  referenceImageUrls: [
    'https://res.cloudinary.com/demo/image/upload/v1/bitedrop/bookings/reference-1.jpg',
  ],
  specialInstructions: 'Please arrive 30 minutes early for setup',
  isAdultConfirmed: true,
  termsAccepted: true,
  status: 'PENDING',
  acceptedAt: null,
  cancellationReason: null,
  createdAt: '2026-09-08T06:00:00.000Z',
  updatedAt: '2026-09-08T06:00:00.000Z',
  foodTruck: {
    id: 'food-truck-id',
    name: 'Taco Paradise',
    slug: 'taco-paradise',
    vendorId: 'vendor-id',
    profileImageUrl: 'https://cdn.bitedrop.com/trucks/taco-paradise.jpg',
  },
  vendor: {
    id: 'vendor-id',
    userId: 'vendor-user-id',
    businessName: 'Taco Paradise',
    logoUrl: 'https://cdn.bitedrop.com/vendors/taco-paradise-logo.png',
  },
  communityRequest: null,
  vendorOffer: null,
  quotes: [],
  statusHistory: [
    {
      id: 'history-id',
      bookingId: 'booking-id',
      previousStatus: null,
      newStatus: 'PENDING',
      changedById: 'customer-user-id',
      reason: 'Booking request created',
      createdAt: '2026-09-08T06:00:00.000Z',
    },
  ],
};

const quoteExample = {
  id: 'quote-id',
  bookingId: 'booking-id',
  vendorId: 'vendor-id',
  pricingModel: 'FLAT_FEE',
  selectedMenuItems: ['Burger', 'Caesar Salad Cups'],
  extraCharges: [{ label: 'Staff setup', amount: 50 }],
  baseServiceFee: 1200,
  transportFee: 50,
  subtotal: 1200,
  outsideRadiusFee: 0,
  serviceFee: 0,
  taxAmount: 0,
  discountAmount: 0,
  totalAmount: 1250,
  paymentPreference: 'DEPOSIT_ONLY',
  depositAmount: 250,
  depositPercent: 20,
  balanceDueAtEvent: 1000,
  message: 'Includes full menu service and staff setup',
  noteToClient: 'Please ensure level parking space for the food truck',
  terms: 'Deposit required within 24 hours of acceptance',
  status: 'PENDING',
  expiresAt: '2026-09-24T23:59:59.000Z',
  createdAt: '2026-09-08T06:15:00.000Z',
  updatedAt: '2026-09-08T06:15:00.000Z',
};

const quoteResultExample = {
  quote: quoteExample,
  booking: {
    ...bookingExample,
    status: 'QUOTED',
    quotes: [quoteExample],
  },
};

const bookingRequestSuccessExample = {
  message:
    "Booking request sent! Your booking request has been sent to the vendor. You'll receive a quote within 24 hours.",
  booking: bookingExample,
};

@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('api/v1/bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @ApiOperation({
    summary: 'List bookings/orders for the authenticated customer',
  })
  @ApiResponse({
    status: 200,
    description: 'Authenticated customer bookings returned successfully.',
    schema: { example: [bookingExample] },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  listMyBookings(@CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.listMyBookings(user.sub);
  }

  @ApiOperation({
    summary: 'List bookings/orders for the authenticated vendor',
  })
  @ApiResponse({
    status: 200,
    description: 'Authenticated vendor bookings returned successfully.',
    schema: { example: [bookingExample] },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description:
      'User is not a vendor, vendor profile is missing, or vendor is not approved/verified.',
    schema: { example: vendorApprovalErrorExample },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.VENDOR_STAFF)
  @Get('vendor/mine')
  listVendorBookings(@CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.listVendorBookings(user.sub);
  }

  @ApiOperation({
    summary:
      'Get booking/order details for the authenticated customer or vendor',
  })
  @ApiResponse({
    status: 200,
    description:
      'Booking details returned for the customer owner or assigned vendor.',
    schema: { example: bookingExample },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Booking exists but is not visible to the authenticated user.',
    schema: {
      example: errorExample(
        403,
        'Booking is not visible to this user',
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
      'Creates an event-style booking request with event type, UI-friendly eventDate/eventTime, contact phone, optional budget, preferred menu items, optional reference images, and payment preference.',
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
          eventDescription:
            'Outdoor birthday event with taco and drink service',
          eventDate: '2026-08-25',
          eventTime: '18:00',
          endTime: '21:00',
          eventTimezone: 'America/Chicago',
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
          customMenuItems: ['Extra spicy chicken tacos', 'Vegetarian platter'],
          referenceImageUrls: [
            'https://res.cloudinary.com/demo/image/upload/v1/bitedrop/bookings/reference-1.jpg',
          ],
          paymentPreference: 'DEPOSIT_ONLY',
          specialInstructions: 'Please arrive 30 minutes early for setup',
          isAdultConfirmed: true,
          termsAccepted: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Booking request created successfully.',
    schema: { example: bookingRequestSuccessExample },
  })
  @ApiResponse({
    status: 400,
    description:
      'Request body validation failed, required confirmations missing, invalid event date/time or timezone, truck unavailable, capacity exceeded, invalid menu items, custom menu items invalid, or service area issue.',
    schema: {
      example: errorExample(
        400,
        'You must agree to the BiteDrop Terms and Conditions',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Food truck vendor is not approved/verified.',
    schema: {
      example: errorExample(
        403,
        'Food truck is not available for booking',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Food truck was not found.',
    schema: { example: errorExample(404, 'Food truck not found', 'Not Found') },
  })
  @ApiResponse({
    status: 409,
    description: 'Food truck already has another booking or hold in this time.',
    schema: {
      example: errorExample(
        409,
        'Food truck already has a booking or hold in this window',
        'Conflict',
      ),
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
  @ApiResponse({
    status: 200,
    description: 'Booking accepted successfully by vendor.',
    schema: {
      example: {
        ...bookingExample,
        status: 'ACCEPTED',
        acceptedAt: '2026-09-08T06:20:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Booking is not pending, booking end time is missing, or request body validation failed.',
    schema: {
      example: errorExample(
        400,
        'Only pending bookings can be accepted',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description:
      'User is not a vendor, vendor is not approved, or booking belongs to another vendor.',
    schema: {
      example: errorExample(
        403,
        'Booking does not belong to this vendor',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Booking was not found.',
    schema: { example: errorExample(404, 'Booking not found', 'Not Found') },
  })
  @ApiResponse({
    status: 409,
    description: 'Food truck already has another booking or hold in this time.',
    schema: {
      example: errorExample(
        409,
        'Food truck already has a booking or hold in this window',
        'Conflict',
      ),
    },
  })
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
  @ApiResponse({
    status: 200,
    description: 'Booking rejected successfully by vendor.',
    schema: {
      example: {
        ...bookingExample,
        status: 'REJECTED',
        cancellationReason: 'Truck is unavailable for requested time',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Booking cannot be rejected in its current status or request body validation failed.',
    schema: {
      example: errorExample(
        400,
        'Booking cannot be rejected in this status',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description:
      'User is not a vendor, vendor is not approved, or booking belongs to another vendor.',
    schema: {
      example: errorExample(
        403,
        'Booking does not belong to this vendor',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Booking was not found.',
    schema: { example: errorExample(404, 'Booking not found', 'Not Found') },
  })
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
  @ApiResponse({
    status: 201,
    description:
      'Vendor quote created successfully and booking moved to QUOTED.',
    schema: { example: quoteResultExample },
  })
  @ApiResponse({
    status: 400,
    description:
      'Booking is not quote-ready, quote expiry is invalid, total is negative, deposit is too low, or body validation failed.',
    schema: {
      example: errorExample(
        400,
        'Deposit amount must be at least 20% of the total quote amount ($250.00)',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description:
      'User is not a vendor, vendor is not approved, or booking belongs to another vendor.',
    schema: {
      example: errorExample(
        403,
        'Booking does not belong to this vendor',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Booking was not found.',
    schema: { example: errorExample(404, 'Booking not found', 'Not Found') },
  })
  @ApiResponse({
    status: 409,
    description: 'Food truck already has another booking or hold in this time.',
    schema: {
      example: errorExample(
        409,
        'Food truck already has a booking or hold in this window',
        'Conflict',
      ),
    },
  })
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
  @ApiResponse({
    status: 200,
    description:
      'Customer accepted quote successfully. Booking moved to PAYMENT_PENDING.',
    schema: {
      example: {
        ...bookingExample,
        status: 'PAYMENT_PENDING',
        subtotal: 1200,
        outsideRadiusFee: 0,
        totalAmount: 1250,
        acceptedAt: '2026-09-08T06:30:00.000Z',
        quotes: [{ ...quoteExample, status: 'ACCEPTED' }],
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Quote is not pending, quote expired, booking is not ready, payment window invalid, or booking end time issue.',
    schema: {
      example: errorExample(400, 'Quote has expired', 'Bad Request'),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Quote belongs to another customer.',
    schema: {
      example: errorExample(
        403,
        'Quote does not belong to this customer',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Booking quote was not found.',
    schema: {
      example: errorExample(404, 'Booking quote not found', 'Not Found'),
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Food truck already has another booking or hold in this time.',
    schema: {
      example: errorExample(
        409,
        'Food truck already has a booking or hold in this window',
        'Conflict',
      ),
    },
  })
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
