import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CommentRequestDto } from './dto/comment-request.dto';
import { CreateCommunityRequestDto } from './dto/create-community-request.dto';
import { CreateVendorOfferDto } from './dto/create-vendor-offer.dto';
import { NewFoodTruckLeadDto } from './dto/new-food-truck-lead.dto';
import { ReactRequestDto } from './dto/react-request.dto';
import { RequestMediaDto } from './dto/request-media.dto';

@Injectable()
export class CommunityRepository {
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
        deletedAt: true,
      },
    });
  }

  findRequestById(requestId: string) {
    return this.prisma.communityRequest.findFirst({
      where: {
        id: requestId,
        deletedAt: null,
      },
      include: {
        targetFoodTruck: {
          select: {
            id: true,
            vendorId: true,
          },
        },
        media: true,
        createdBy: {
          select: {
            id: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });
  }

  listOpenRequests() {
    return this.prisma.communityRequest.findMany({
      where: {
        deletedAt: null,
        status: 'OPEN' as any,
      },
      include: this.requestInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  listMyRequests(userId: string) {
    return this.prisma.communityRequest.findMany({
      where: {
        createdById: userId,
        deletedAt: null,
      },
      include: this.requestInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  listOffersForRequest(
    requestId: string,
    sort: 'LOW_PRICE' | 'HIGH_RATED' | 'RECENT' = 'RECENT',
  ) {
    const orderBy =
      sort === 'LOW_PRICE'
        ? [{ quotedAmount: 'asc' as const }, { createdAt: 'desc' as const }]
        : sort === 'HIGH_RATED'
          ? [
              { foodTruck: { averageRating: 'desc' as const } },
              { createdAt: 'desc' as const },
            ]
          : [{ createdAt: 'desc' as const }];

    return this.prisma.vendorOffer.findMany({
      where: {
        communityRequestId: requestId,
      },
      include: this.offerInclude(),
      orderBy,
    });
  }

  async createRequest(
    userId: string,
    dto: CreateCommunityRequestDto,
    visibility: 'PUBLIC' | 'PRIVATE',
    targetFoodTruckId?: string,
  ) {
    const requestType = (dto.requestType ?? 'EVENT') as NonNullable<
      CreateCommunityRequestDto['requestType']
    >;
    const title = dto.title ?? this.buildRequestTitle(dto);

    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      return this.createRequestWithLocation(
        userId,
        {
          ...dto,
          requestType,
          title,
        },
        visibility,
        targetFoodTruckId,
      );
    }

    return this.prisma.communityRequest.create({
      data: {
        createdById: userId,
        targetFoodTruckId,
        visibility: visibility as any,
        requestType: requestType as any,
        eventType: dto.eventType as any,
        title,
        description: dto.description,
        eventDate: dto.eventDate ? this.toDateOnly(dto.eventDate) : null,
        startTime: dto.startTime ? this.toTimeDate(dto.startTime) : null,
        endTime: dto.endTime ? this.toTimeDate(dto.endTime) : null,
        eventTimezone: dto.eventTimezone,
        guestCount: dto.guestCount,
        budgetMin: dto.budgetMin,
        budgetMax: dto.budgetMax,
        address: dto.address,
        contactPhone: dto.contactPhone,
        preferredCuisines: dto.preferredCuisines as any,
        preferredMenuItems: dto.preferredMenuItems as any,
        allowPublicComments: dto.allowPublicComments ?? true,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        media: dto.media?.length
          ? {
              create: dto.media.map((media) => ({
                mediaUrl: media.mediaUrl,
                mediaType: media.mediaType,
              })),
            }
          : undefined,
      },
      include: this.requestInclude(),
    });
  }

  addRequestMedia(requestId: string, dto: RequestMediaDto) {
    return this.prisma.communityRequestMedia.create({
      data: {
        communityRequestId: requestId,
        mediaUrl: dto.mediaUrl,
        mediaType: dto.mediaType,
      },
    });
  }

  findCommentById(commentId: string) {
    return this.prisma.communityRequestComment.findFirst({
      where: {
        id: commentId,
        deletedAt: null,
      },
      select: {
        id: true,
        communityRequestId: true,
      },
    });
  }

  createComment(requestId: string, userId: string, dto: CommentRequestDto) {
    return this.prisma.communityRequestComment.create({
      data: {
        communityRequestId: requestId,
        userId,
        parentCommentId: dto.parentCommentId,
        content: dto.content,
      },
      include: {
        user: {
          select: {
            id: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });
  }

  reactToRequest(requestId: string, userId: string, dto: ReactRequestDto) {
    return this.prisma.communityRequestReaction.upsert({
      where: {
        communityRequestId_userId: {
          communityRequestId: requestId,
          userId,
        },
      },
      create: {
        communityRequestId: requestId,
        userId,
        reaction: dto.reaction ?? 'LIKE',
      },
      update: {
        reaction: dto.reaction ?? 'LIKE',
      },
    });
  }

  createVendorOffer(vendorId: string, requestId: string, dto: CreateVendorOfferDto) {
    const financials = this.normalizeOfferFinancials(dto);

    return this.prisma.vendorOffer.create({
      data: {
        communityRequestId: requestId,
        vendorId,
        foodTruckId: dto.foodTruckId,
        message: dto.message,
        noteToClient: dto.noteToClient ?? dto.message,
        pricingModel: dto.pricingModel as any,
        selectedMenuItems: dto.selectedMenuItems as any,
        extraCharges: dto.extraCharges as any,
        baseServiceFee: financials.baseServiceFee,
        transportFee: financials.transportFee,
        quotedAmount: financials.quotedAmount,
        serviceFee: financials.serviceFee,
        taxAmount: financials.taxAmount,
        discountAmount: financials.discountAmount,
        paymentPreference: financials.paymentPreference as any,
        depositAmount: financials.depositAmount,
        depositPercent: financials.depositPercent,
        balanceDueAtEvent: financials.balanceDueAtEvent,
        commissionAmount: financials.commissionAmount,
        vendorNetAmount: financials.vendorNetAmount,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      include: this.offerInclude(),
    });
  }

  findOfferById(offerId: string) {
    return this.prisma.vendorOffer.findUnique({
      where: { id: offerId },
      include: {
        communityRequest: {
          select: {
            id: true,
            createdById: true,
            status: true,
            expiresAt: true,
          },
        },
        foodTruck: {
          select: {
            id: true,
            vendorId: true,
          },
        },
      },
    });
  }

  acceptOffer(offerId: string, requestId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.vendorOffer.updateMany({
        where: {
          communityRequestId: requestId,
          id: { not: offerId },
          status: 'PENDING' as any,
        },
        data: { status: 'REJECTED' as any },
      });

      const offer = await tx.vendorOffer.update({
        where: { id: offerId },
        data: { status: 'ACCEPTED' as any },
        include: this.offerInclude(),
      });

      await tx.communityRequest.update({
        where: { id: requestId },
        data: { status: 'MATCHED' as any },
      });

      const existingBooking = await tx.booking.findFirst({
        where: { vendorOfferId: offerId },
        include: {
          vendorOffer: true,
          foodTruck: true,
          vendor: true,
          statusHistory: { orderBy: { createdAt: 'asc' } },
        },
      });

      if (existingBooking) {
        return { offer, booking: existingBooking };
      }

      const bookingNumber = await this.createBookingNumber();
      const startsAt = this.combineRequestDateAndTime(
        offer.communityRequest.eventDate,
        offer.communityRequest.startTime,
      );
      const endsAt = this.combineRequestDateAndTime(
        offer.communityRequest.eventDate,
        offer.communityRequest.endTime,
      );
      const holdExpiresAt = new Date(Date.now() + 30 * 60_000);

      const booking = await tx.booking.create({
        data: {
          bookingNumber,
          customerId: offer.communityRequest.createdById,
          vendorId: offer.vendorId,
          foodTruckId: offer.foodTruckId,
          communityRequestId: offer.communityRequestId,
          vendorOfferId: offer.id,
          bookingType: 'EVENT' as any,
          eventType: offer.communityRequest.eventType as any,
          status: 'PAYMENT_PENDING' as any,
          eventName: offer.communityRequest.title,
          eventDescription: offer.communityRequest.description,
          startsAt,
          endsAt,
          guestCount: offer.communityRequest.guestCount ?? 0,
          address: offer.communityRequest.address ?? '',
          contactPhone: offer.communityRequest.contactPhone,
          budgetAmount: offer.communityRequest.budgetMax ?? offer.communityRequest.budgetMin,
          subtotal: offer.baseServiceFee,
          outsideRadiusFee: offer.transportFee,
          serviceFee: offer.serviceFee,
          taxAmount: offer.taxAmount,
          discountAmount: offer.discountAmount,
          totalAmount: offer.quotedAmount,
          paymentPreference: offer.paymentPreference ?? 'NO_PREFERENCE',
          specialInstructions: offer.communityRequest.description,
          acceptedAt: new Date(),
        },
      });

      await tx.bookingHold.create({
        data: {
          foodTruckId: offer.foodTruckId,
          userId: offer.communityRequest.createdById,
          startsAt,
          endsAt,
          expiresAt: holdExpiresAt,
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          previousStatus: null,
          newStatus: 'PAYMENT_PENDING' as any,
          changedById: offer.communityRequest.createdById,
          reason: 'Customer accepted vendor offer',
        },
      });

      const fullBooking = await tx.booking.findUnique({
        where: { id: booking.id },
        include: {
          vendorOffer: true,
          foodTruck: true,
          vendor: true,
          statusHistory: { orderBy: { createdAt: 'asc' } },
        },
      });

      return { offer, booking: fullBooking };
    });
  }

  rejectOffer(offerId: string) {
    return this.prisma.vendorOffer.update({
      where: { id: offerId },
      data: { status: 'REJECTED' as any },
      include: this.offerInclude(),
    });
  }

  withdrawOffer(offerId: string) {
    return this.prisma.vendorOffer.update({
      where: { id: offerId },
      data: { status: 'WITHDRAWN' as any },
      include: this.offerInclude(),
    });
  }

  createNewFoodTruckLead(dto: NewFoodTruckLeadDto, requestedById?: string) {
    return this.prisma.newFoodTruckRequest.create({
      data: {
        requestedById,
        truckName: dto.truckName,
        ownerName: dto.ownerName,
        ownerEmail: dto.ownerEmail,
        ownerPhone: dto.ownerPhone,
        socialUrl: dto.socialUrl,
        city: dto.city,
        state: dto.state,
        notes: dto.notes,
      },
    });
  }

  private async createRequestWithLocation(
    userId: string,
    dto: CreateCommunityRequestDto,
    visibility: 'PUBLIC' | 'PRIVATE',
    targetFoodTruckId?: string,
  ) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO community_requests (
        id,
        created_by,
        target_food_truck_id,
        visibility,
        request_type,
        title,
        description,
        event_date,
        start_time,
        end_time,
        event_timezone,
        guest_count,
        budget_min,
        budget_max,
        address,
        location,
        preferred_cuisines,
        allow_public_comments,
        expires_at
      )
      VALUES (
        gen_random_uuid(),
        ${userId}::uuid,
        ${targetFoodTruckId ?? null}::uuid,
        ${visibility}::"RequestVisibility",
        ${dto.requestType}::"RequestType",
        ${dto.title},
        ${dto.description ?? null},
        ${dto.eventDate ? this.toDateOnly(dto.eventDate) : null},
        ${dto.startTime ? this.toTimeDate(dto.startTime) : null},
        ${dto.endTime ? this.toTimeDate(dto.endTime) : null},
        ${dto.eventTimezone ?? null},
        ${dto.guestCount ?? null},
        ${dto.budgetMin ?? null},
        ${dto.budgetMax ?? null},
        ${dto.address ?? null},
        ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography,
        ${JSON.stringify(dto.preferredCuisines ?? null)}::jsonb,
        ${dto.allowPublicComments ?? true},
        ${dto.expiresAt ? new Date(dto.expiresAt) : null}
      )
      RETURNING id
    `;

    const requestId = rows[0].id;

    if (dto.media?.length) {
      await this.prisma.communityRequestMedia.createMany({
        data: dto.media.map((media) => ({
          communityRequestId: requestId,
          mediaUrl: media.mediaUrl,
          mediaType: media.mediaType,
        })),
      });
    }

    return this.prisma.communityRequest.findUnique({
      where: { id: requestId },
      include: this.requestInclude(),
    });
  }

  private requestInclude() {
    return {
      media: true,
      targetFoodTruck: {
        select: {
          id: true,
          name: true,
          slug: true,
          profileImageUrl: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          profile: {
            select: {
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      },
      vendorOffers: {
        select: {
          id: true,
          status: true,
          quotedAmount: true,
          foodTruckId: true,
          vendorId: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          comments: true,
          reactions: true,
          vendorOffers: true,
        },
      },
    };
  }

  private offerInclude() {
    return {
      vendor: {
        select: {
          id: true,
          businessName: true,
          logoUrl: true,
          isVerified: true,
        },
      },
      foodTruck: {
        select: {
          id: true,
          name: true,
          slug: true,
          profileImageUrl: true,
          averageRating: true,
        },
      },
      communityRequest: {
        select: {
          id: true,
          title: true,
          status: true,
          createdById: true,
          eventType: true,
          description: true,
          eventDate: true,
          startTime: true,
          endTime: true,
          guestCount: true,
          address: true,
          contactPhone: true,
          budgetMin: true,
          budgetMax: true,
        },
      },
    };
  }

  private normalizeOfferFinancials(dto: CreateVendorOfferDto) {
    const baseServiceFee = dto.baseServiceFee ?? dto.quotedAmount ?? 0;
    const transportFee = dto.transportFee ?? 0;
    const extraChargesTotal = (dto.extraCharges ?? []).reduce(
      (sum, item) => sum + Number(item.amount ?? 0),
      0,
    );
    const serviceFee = dto.serviceFee ?? 0;
    const taxAmount = dto.taxAmount ?? 0;
    const discountAmount = dto.discountAmount ?? 0;
    const quotedAmount =
      dto.quotedAmount ??
      baseServiceFee +
        transportFee +
        extraChargesTotal +
        serviceFee +
        taxAmount -
        discountAmount;
    const paymentPreference = dto.paymentPreference ?? 'NO_PREFERENCE';
    const depositPercent = dto.depositPercent ?? 0;
    const derivedDeposit =
      paymentPreference === 'DEPOSIT_ONLY'
        ? dto.depositAmount ??
          (depositPercent > 0 ? (quotedAmount * depositPercent) / 100 : 0)
        : paymentPreference === 'PREPAID_IN_FULL'
          ? quotedAmount
          : 0;
    const depositAmount = Math.min(quotedAmount, derivedDeposit);
    const balanceDueAtEvent =
      dto.balanceDueAtEvent ??
      (paymentPreference === 'PREPAID_IN_FULL'
        ? 0
        : Math.max(quotedAmount - depositAmount, 0));
    const commissionAmount = Number(
      (
        depositAmount * Number(process.env.PLATFORM_COMMISSION_RATE ?? '0.10')
      ).toFixed(2),
    );
    const vendorNetAmount = Math.max(depositAmount - commissionAmount, 0);

    return {
      baseServiceFee,
      transportFee,
      serviceFee,
      taxAmount,
      discountAmount,
      quotedAmount,
      paymentPreference,
      depositAmount,
      depositPercent,
      balanceDueAtEvent,
      commissionAmount,
      vendorNetAmount,
    };
  }

  private buildRequestTitle(dto: CreateCommunityRequestDto) {
    const eventType = dto.eventType
      ? dto.eventType
          .toLowerCase()
          .split('_')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ')
      : 'Food Truck Request';
    const location = dto.address ? ` - ${dto.address}` : '';
    return `${eventType}${location}`;
  }

  private toDateOnly(value: string): Date {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private toTimeDate(value: string): Date {
    return new Date(`1970-01-01T${value}:00.000Z`);
  }

  private combineRequestDateAndTime(
    eventDate: Date | null,
    timeValue: Date | null,
  ) {
    const baseDate = eventDate ?? new Date();
    const date = new Date(baseDate);

    if (timeValue) {
      date.setUTCHours(
        timeValue.getUTCHours(),
        timeValue.getUTCMinutes(),
        0,
        0,
      );
    } else {
      date.setUTCHours(18, 0, 0, 0);
    }

    return date;
  }

  private async createBookingNumber() {
    const date = new Date();
    const prefix = `BD-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `${prefix}-${suffix}`;
  }
}
