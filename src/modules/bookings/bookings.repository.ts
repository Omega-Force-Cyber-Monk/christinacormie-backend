import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AcceptBookingQuoteDto } from './dto/accept-booking-quote.dto';
import { CreateBookingQuoteDto } from './dto/create-booking-quote.dto';
import { CreateBookingDto } from './dto/create-booking.dto';

type ServiceAreaCheck = {
  serviceAreaId: string;
  distanceKm: unknown;
  radiusKm: unknown;
  outsideRadiusAllowed: boolean;
  outsideRadiusFee: unknown;
};

@Injectable()
export class BookingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findVendorByUserId(userId: string) {
    return this.prisma.vendor.findUnique({
      where: { userId },
      select: { id: true },
    });
  }

  findFoodTruckById(foodTruckId: string) {
    return this.prisma.foodTruck.findUnique({
      where: { id: foodTruckId },
      select: {
        id: true,
        vendorId: true,
        status: true,
        maximumGuestCapacity: true,
        deletedAt: true,
      },
    });
  }

  countMenuItemsForFoodTruck(foodTruckId: string, itemIds: string[]) {
    return this.prisma.menuItem.count({
      where: {
        id: { in: itemIds },
        category: {
          menu: {
            foodTruckId,
          },
        },
      },
    });
  }

  findBookingById(bookingId: string) {
    return this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: this.bookingInclude(),
    });
  }

  listCustomerBookings(customerId: string) {
    return this.prisma.booking.findMany({
      where: { customerId },
      include: this.bookingInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  listVendorBookingsByUserId(userId: string) {
    return this.prisma.booking.findMany({
      where: {
        vendor: {
          userId,
        },
      },
      include: this.bookingInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  findQuoteById(quoteId: string) {
    return this.prisma.bookingQuote.findUnique({
      where: { id: quoteId },
      include: {
        booking: true,
      },
    });
  }

  checkServiceArea(foodTruckId: string, dto: CreateBookingDto) {
    return this.prisma.$queryRaw<ServiceAreaCheck[]>`
      SELECT
        id AS "serviceAreaId",
        ROUND(
          (
            ST_Distance(
              center_location,
              ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography
            ) / 1000
          )::numeric,
          2
        ) AS "distanceKm",
        radius_km AS "radiusKm",
        outside_radius_allowed AS "outsideRadiusAllowed",
        outside_radius_fee AS "outsideRadiusFee"
      FROM service_areas
      WHERE food_truck_id = ${foodTruckId}::uuid
        AND is_active = true
      ORDER BY ST_Distance(
        center_location,
        ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography
      ) ASC
      LIMIT 1
    `;
  }

  async hasOverlap(foodTruckId: string, startsAt: Date, endsAt: Date) {
    const [bookingOverlap, holdOverlap] = await this.prisma.$transaction([
      this.prisma.booking.count({
        where: {
          foodTruckId,
          status: { in: ['PAYMENT_PENDING', 'CONFIRMED', 'IN_PROGRESS'] as any },
          startsAt: { lt: endsAt },
          OR: [{ endsAt: null }, { endsAt: { gt: startsAt } }],
        },
      }),
      this.prisma.bookingHold.count({
        where: {
          foodTruckId,
          expiresAt: { gt: new Date() },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
      }),
    ]);

    return bookingOverlap > 0 || holdOverlap > 0;
  }

  async createBooking(
    customerId: string,
    vendorId: string,
    dto: CreateBookingDto,
    serviceArea: {
      distanceKm: number;
      outsideServiceRadius: boolean;
      outsideRadiusFee: number;
    },
  ) {
    const bookingNumber = await this.createBookingNumber();
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO bookings (
        id,
        booking_number,
        customer_id,
        vendor_id,
        food_truck_id,
        community_request_id,
        vendor_offer_id,
        booking_type,
        event_type,
        event_name,
        event_description,
        starts_at,
        ends_at,
        guest_count,
        address,
        contact_phone,
        location,
        distance_from_service_center_km,
        outside_service_radius,
        outside_radius_fee,
        budget_amount,
        subtotal,
        total_amount,
        preferred_menu_item_ids,
        reference_image_urls,
        payment_preference,
        special_instructions
      )
      VALUES (
        gen_random_uuid(),
        ${bookingNumber},
        ${customerId}::uuid,
        ${vendorId}::uuid,
        ${dto.foodTruckId}::uuid,
        ${dto.communityRequestId ?? null}::uuid,
        ${dto.vendorOfferId ?? null}::uuid,
        ${dto.bookingType}::"BookingType",
        ${dto.eventType}::"BookingEventType",
        ${dto.eventName ?? null},
        ${dto.eventDescription ?? null},
        ${startsAt},
        ${endsAt},
        ${dto.guestCount},
        ${dto.address},
        ${dto.contactPhone},
        ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography,
        ${serviceArea.distanceKm},
        ${serviceArea.outsideServiceRadius},
        ${serviceArea.outsideRadiusFee},
        ${dto.budgetAmount ?? null},
        ${dto.subtotal ?? 0},
        ${(dto.subtotal ?? 0) + serviceArea.outsideRadiusFee},
        ${dto.preferredMenuItemIds ? JSON.stringify(dto.preferredMenuItemIds) : null}::jsonb,
        ${dto.referenceImageUrls ? JSON.stringify(dto.referenceImageUrls) : null}::jsonb,
        ${(dto.paymentPreference ?? 'NO_PREFERENCE')}::"BookingPaymentPreference",
        ${dto.specialInstructions ?? null}
      )
      RETURNING id
    `;

    const bookingId = rows[0].id;

    await this.createStatusHistory(
      bookingId,
      null,
      'PENDING',
      customerId,
      'Booking request created',
    );

    return this.findBookingById(bookingId);
  }

  async updateBookingStatus(
    bookingId: string,
    previousStatus: string,
    newStatus: string,
    changedById: string,
    reason?: string,
    data: Record<string, unknown> = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          ...data,
          status: newStatus as any,
        },
        include: this.bookingInclude(),
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          previousStatus: previousStatus as any,
          newStatus: newStatus as any,
          changedById,
          reason,
        },
      });

      return booking;
    });
  }

  async createQuote(
    bookingId: string,
    vendorId: string,
    changedByUserId: string,
    previousStatus: string,
    dto: CreateBookingQuoteDto,
  ) {
    const outsideRadiusFee = dto.outsideRadiusFee ?? 0;
    const serviceFee = dto.serviceFee ?? 0;
    const taxAmount = dto.taxAmount ?? 0;
    const discountAmount = dto.discountAmount ?? 0;
    const totalAmount =
      dto.subtotal + outsideRadiusFee + serviceFee + taxAmount - discountAmount;

    return this.prisma.$transaction(async (tx) => {
      const quote = await tx.bookingQuote.create({
        data: {
          bookingId,
          vendorId,
          subtotal: dto.subtotal,
          outsideRadiusFee,
          serviceFee,
          taxAmount,
          discountAmount,
          totalAmount,
          message: dto.message,
          terms: dto.terms,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        },
      });

      const booking = await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'QUOTED' as any },
        include: this.bookingInclude(),
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          previousStatus: previousStatus as any,
          newStatus: 'QUOTED' as any,
          changedById: changedByUserId,
          reason: 'Vendor quote created',
        },
      });

      return { quote, booking };
    });
  }

  async acceptQuote(
    quoteId: string,
    userId: string,
    dto: AcceptBookingQuoteDto,
  ) {
    const quote = await this.findQuoteById(quoteId);
    const holdExpiresAt = new Date(
      Date.now() + (dto.paymentWindowMinutes ?? 30) * 60_000,
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.bookingQuote.update({
        where: { id: quoteId },
        data: { status: 'ACCEPTED' as any },
      });

      await tx.booking.update({
        where: { id: quote!.bookingId },
        data: {
          status: 'PAYMENT_PENDING' as any,
          subtotal: quote!.subtotal,
          outsideRadiusFee: quote!.outsideRadiusFee,
          serviceFee: quote!.serviceFee,
          taxAmount: quote!.taxAmount,
          discountAmount: quote!.discountAmount,
          totalAmount: quote!.totalAmount,
          acceptedAt: new Date(),
        },
      });

      await tx.bookingHold.create({
        data: {
          foodTruckId: quote!.booking.foodTruckId,
          userId,
          startsAt: quote!.booking.startsAt,
          endsAt: quote!.booking.endsAt!,
          expiresAt: holdExpiresAt,
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: quote!.bookingId,
          previousStatus: quote!.booking.status as any,
          newStatus: 'PAYMENT_PENDING' as any,
          changedById: userId,
          reason: 'Customer accepted quote',
        },
      });

      return tx.booking.findUnique({
        where: { id: quote!.bookingId },
        include: this.bookingInclude(),
      });
    });
  }

  private createStatusHistory(
    bookingId: string,
    previousStatus: string | null,
    newStatus: string,
    changedById: string,
    reason?: string,
  ) {
    return this.prisma.bookingStatusHistory.create({
      data: {
        bookingId,
        previousStatus: previousStatus as any,
        newStatus: newStatus as any,
        changedById,
        reason,
      },
    });
  }

  private async createBookingNumber() {
    const date = new Date();
    const prefix = `BD-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `${prefix}-${suffix}`;
  }

  private bookingInclude() {
    return {
      foodTruck: {
        select: {
          id: true,
          name: true,
          slug: true,
          vendorId: true,
          profileImageUrl: true,
        },
      },
      vendor: {
        select: {
          id: true,
          userId: true,
          businessName: true,
          logoUrl: true,
        },
      },
      communityRequest: {
        select: {
          id: true,
          title: true,
          eventType: true,
          guestCount: true,
          address: true,
          budgetMin: true,
          budgetMax: true,
          contactPhone: true,
          preferredMenuItems: true,
          media: true,
        },
      },
      vendorOffer: true,
      quotes: {
        orderBy: { createdAt: 'desc' as const },
      },
      statusHistory: {
        orderBy: { createdAt: 'asc' as const },
      },
    };
  }
}
