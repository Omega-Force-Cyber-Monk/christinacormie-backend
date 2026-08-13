import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AcceptBookingQuoteDto } from './dto/accept-booking-quote.dto';
import { CreateBookingQuoteDto } from './dto/create-booking-quote.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { VendorBookingDecisionDto } from './dto/vendor-booking-decision.dto';
import { NotificationEventType } from '../notifications/enums/notification-event-type.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { RewardsService } from '../rewards/rewards.service';
import { BookingsRepository } from './bookings.repository';

@Injectable()
export class BookingsService {
  constructor(
    private readonly bookingsRepository: BookingsRepository,
    private readonly notificationsService: NotificationsService,
    private readonly rewardsService: RewardsService,
  ) {}

  async createBookingRequest(userId: string, dto: CreateBookingDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    this.validateBookingWindow(startsAt, endsAt);

    const foodTruck = await this.ensureFoodTruckExists(dto.foodTruckId);

    if (foodTruck.status !== 'ACTIVE') {
      throw new BadRequestException('Food truck is not active');
    }

    if (
      foodTruck.maximumGuestCapacity !== null &&
      dto.guestCount > foodTruck.maximumGuestCapacity
    ) {
      throw new BadRequestException('Guest count exceeds truck capacity');
    }

    const serviceArea = await this.validateServiceArea(dto.foodTruckId, dto);
    await this.ensureNoOverlap(dto.foodTruckId, startsAt, endsAt);

    const booking = await this.bookingsRepository.createBooking(
      userId,
      foodTruck.vendorId,
      dto,
      serviceArea,
    );

    await this.notificationsService.notifyBookingCreated(userId, booking);

    return booking;
  }

  async vendorAcceptBooking(
    userId: string,
    bookingId: string,
    dto: VendorBookingDecisionDto,
  ) {
    const booking = await this.ensureVendorBooking(userId, bookingId);

    if (booking.status !== 'PENDING') {
      throw new BadRequestException('Only pending bookings can be accepted');
    }

    await this.ensureNoOverlap(
      booking.foodTruckId,
      booking.startsAt,
      booking.endsAt!,
    );

    const updatedBooking = await this.bookingsRepository.updateBookingStatus(
      bookingId,
      booking.status,
      'ACCEPTED',
      userId,
      dto.reason,
      { acceptedAt: new Date() },
    );

    await this.notificationsService.notifyCustomerBookingUpdate(
      userId,
      updatedBooking,
      'Booking accepted',
      NotificationEventType.BOOKING_ACCEPTED,
    );

    return updatedBooking;
  }

  async vendorRejectBooking(
    userId: string,
    bookingId: string,
    dto: VendorBookingDecisionDto,
  ) {
    const booking = await this.ensureVendorBooking(userId, bookingId);

    if (!['PENDING', 'ACCEPTED', 'QUOTED'].includes(booking.status)) {
      throw new BadRequestException('Booking cannot be rejected in this status');
    }

    const updatedBooking = await this.bookingsRepository.updateBookingStatus(
      bookingId,
      booking.status,
      'REJECTED',
      userId,
      dto.reason,
      { cancellationReason: dto.reason },
    );

    await this.notificationsService.notifyCustomerBookingUpdate(
      userId,
      updatedBooking,
      'Booking rejected',
      NotificationEventType.BOOKING_REJECTED,
    );

    return updatedBooking;
  }

  async createVendorQuote(
    userId: string,
    bookingId: string,
    dto: CreateBookingQuoteDto,
  ) {
    const booking = await this.ensureVendorBooking(userId, bookingId);
    const vendor = await this.ensureVendor(userId);

    if (!['PENDING', 'ACCEPTED'].includes(booking.status)) {
      throw new BadRequestException('Booking is not ready for a quote');
    }

    if (dto.expiresAt && new Date(dto.expiresAt) <= new Date()) {
      throw new BadRequestException('Quote expiresAt must be in the future');
    }

    const total =
      dto.subtotal +
      (dto.outsideRadiusFee ?? 0) +
      (dto.serviceFee ?? 0) +
      (dto.taxAmount ?? 0) -
      (dto.discountAmount ?? 0);

    if (total < 0) {
      throw new BadRequestException('Quote total cannot be negative');
    }

    await this.ensureNoOverlap(
      booking.foodTruckId,
      booking.startsAt,
      booking.endsAt!,
    );

    const quoteResult = await this.bookingsRepository.createQuote(
      bookingId,
      vendor.id,
      userId,
      booking.status,
      dto,
    );

    await this.notificationsService.notifyCustomerBookingUpdate(
      userId,
      quoteResult.booking,
      'New booking quote',
      NotificationEventType.QUOTE_CREATED,
    );

    return quoteResult;
  }

  async customerAcceptQuote(
    userId: string,
    quoteId: string,
    dto: AcceptBookingQuoteDto,
  ) {
    const quote = await this.bookingsRepository.findQuoteById(quoteId);

    if (!quote) {
      throw new NotFoundException('Booking quote not found');
    }

    if (quote.booking.customerId !== userId) {
      throw new ForbiddenException('Quote does not belong to this customer');
    }

    if (quote.status !== 'PENDING') {
      throw new BadRequestException('Quote is not pending');
    }

    if (quote.expiresAt && quote.expiresAt <= new Date()) {
      throw new BadRequestException('Quote has expired');
    }

    if (quote.booking.status !== 'QUOTED') {
      throw new BadRequestException('Booking is not ready for quote acceptance');
    }

    await this.ensureNoOverlap(
      quote.booking.foodTruckId,
      quote.booking.startsAt,
      quote.booking.endsAt!,
    );

    const booking = await this.bookingsRepository.acceptQuote(quoteId, userId, dto);

    await this.rewardsService.awardPoints(userId, 'BOOKING', booking!.id);
    await this.notificationsService.notifyVendorBookingUpdate(
      userId,
      booking!,
      'Quote accepted',
    );

    return booking;
  }

  private validateBookingWindow(startsAt: Date, endsAt: Date) {
    if (startsAt <= new Date()) {
      throw new BadRequestException('Booking startsAt must be in the future');
    }

    if (startsAt >= endsAt) {
      throw new BadRequestException('startsAt must be before endsAt');
    }
  }

  private async validateServiceArea(foodTruckId: string, dto: CreateBookingDto) {
    const rows = await this.bookingsRepository.checkServiceArea(foodTruckId, dto);
    const serviceArea = rows[0];

    if (!serviceArea) {
      throw new BadRequestException('Food truck has no active service area');
    }

    const distanceKm = Number(serviceArea.distanceKm);
    const radiusKm = Number(serviceArea.radiusKm);
    const outsideRadiusFee = Number(serviceArea.outsideRadiusFee ?? 0);
    const outsideServiceRadius = distanceKm > radiusKm;

    if (outsideServiceRadius && !serviceArea.outsideRadiusAllowed) {
      throw new BadRequestException('Booking address is outside service radius');
    }

    return {
      distanceKm,
      outsideServiceRadius,
      outsideRadiusFee: outsideServiceRadius ? outsideRadiusFee : 0,
    };
  }

  private async ensureNoOverlap(
    foodTruckId: string,
    startsAt: Date,
    endsAt: Date,
  ) {
    const hasOverlap = await this.bookingsRepository.hasOverlap(
      foodTruckId,
      startsAt,
      endsAt,
    );

    if (hasOverlap) {
      throw new ConflictException('Food truck already has a booking or hold in this window');
    }
  }

  private async ensureVendor(userId: string) {
    const vendor = await this.bookingsRepository.findVendorByUserId(userId);

    if (!vendor) {
      throw new ForbiddenException('Vendor profile is required');
    }

    return vendor;
  }

  private async ensureFoodTruckExists(foodTruckId: string) {
    const foodTruck = await this.bookingsRepository.findFoodTruckById(foodTruckId);

    if (!foodTruck || foodTruck.deletedAt) {
      throw new NotFoundException('Food truck not found');
    }

    return foodTruck;
  }

  private async ensureVendorBooking(userId: string, bookingId: string) {
    const vendor = await this.ensureVendor(userId);
    const booking = await this.bookingsRepository.findBookingById(bookingId);

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.vendorId !== vendor.id) {
      throw new ForbiddenException('Booking does not belong to this vendor');
    }

    if (!booking.endsAt) {
      throw new BadRequestException('Booking end time is required');
    }

    return booking;
  }
}
