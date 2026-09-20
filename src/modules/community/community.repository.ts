import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CommentRequestDto } from './dto/comment-request.dto';
import { CreateCommunityRequestDto } from './dto/create-community-request.dto';
import { CreateVendorOfferDto } from './dto/create-vendor-offer.dto';
import { NewFoodTruckLeadDto } from './dto/new-food-truck-lead.dto';
import { ReactRequestDto } from './dto/react-request.dto';
import { RequestMediaDto } from './dto/request-media.dto';
import { calculateQuote } from '../bookings/quote-financials';
import { communityEventWindow } from './community-event-window';

@Injectable()
export class CommunityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ensurePublisher(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: true, vendor: true },
    });
    if (!user || user.deletedAt || user.status !== 'ACTIVE')
      throw new ForbiddenException(
        'An active account is required to publish or manage Community posts',
      );
    const roles = user.userRoles.map((item) => item.role);
    if (!roles.includes('CUSTOMER') && !roles.includes('VENDOR'))
      throw new ForbiddenException(
        'Only customers and vendors can publish Community posts',
      );
    if (
      roles.includes('VENDOR') &&
      (!user.vendor ||
        user.vendor.deletedAt ||
        user.vendor.status !== 'APPROVED' ||
        !user.vendor.isVerified)
    ) {
      throw new ForbiddenException(
        'Vendor account must be approved and verified before publishing Community posts',
      );
    }
    return user;
  }

  findVendorByUserId(userId: string) {
    return this.prisma.vendor.findUnique({
      where: { userId },
      select: {
        id: true,
        status: true,
        isVerified: true,
        selectedPlan: true,
        subscriptionStatus: true,
        lockedCommissionRate: true,
        activeSubscriptionTier: {
          select: {
            code: true,
            name: true,
            monthlyPriceCents: true,
            bookingEnabled: true,
            maxStaffAccounts: true,
            maxIncludedTrucks: true,
            analyticsLevel: true,
            normalCommissionRate: true,
          },
        },
      },
    });
  }

  findFoodTruckById(foodTruckId: string) {
    return this.prisma.foodTruck.findUnique({
      where: { id: foodTruckId },
      select: {
        id: true,
        vendorId: true,
        status: true,
        deletedAt: true,
        vendor: {
          select: {
            status: true,
            isVerified: true,
            deletedAt: true,
          },
        },
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
        visibility: 'PUBLIC',
        category: 'NEED_TRUCK',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { ...this.requestInclude(), vendorOffers: false },
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
    vendorId?: string,
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
        vendorId,
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
    const title =
      dto.title ||
      (dto.category && dto.category !== 'NEED_TRUCK'
        ? dto.category.replaceAll('_', ' ')
        : this.buildRequestTitle(dto));

    return this.prisma.$transaction(async (tx) => {
      const post = await tx.communityRequest.create({
        data: {
          category: dto.category ?? 'NEED_TRUCK',
          spotsOpen: dto.spotsOpen,
          attendanceMin: dto.attendanceMin,
          attendanceMax: dto.attendanceMax,
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
      if (dto.latitude !== undefined && dto.longitude !== undefined) {
        await tx.$executeRaw`UPDATE community_requests SET location = ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography WHERE id = ${post.id}::uuid`;
      }
      return post;
    });
  }

  addRequestMedia(requestId: string, dto: RequestMediaDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM community_requests WHERE id = ${requestId}::uuid FOR UPDATE`;
      const post = await tx.communityRequest.findUnique({
        where: { id: requestId },
      });
      if (!post || post.deletedAt || post.status !== 'OPEN')
        throw new ConflictException('This post is no longer open for changes');
      if (
        (await tx.communityRequestMedia.count({
          where: { communityRequestId: requestId },
        })) >= 5
      )
        throw new BadRequestException(
          'A Community post can contain at most 5 attachments',
        );
      return tx.communityRequestMedia.create({
        data: {
          communityRequestId: requestId,
          mediaUrl: dto.mediaUrl,
          mediaType: dto.mediaType,
        },
      });
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

  createVendorOffer(
    vendorId: string,
    requestId: string,
    dto: CreateVendorOfferDto,
    commissionRate?: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM community_requests WHERE id = ${requestId}::uuid FOR UPDATE`;
      const request = await tx.communityRequest.findUnique({
        where: { id: requestId },
      });
      if (
        !request ||
        request.deletedAt ||
        request.status !== 'OPEN' ||
        (request.expiresAt && request.expiresAt <= new Date())
      )
        throw new ConflictException(
          'This request is no longer open for quotes',
        );
      const financials = calculateQuote(dto, request.guestCount, commissionRate);
      if (
        await tx.vendorOffer.findFirst({
          where: {
            communityRequestId: requestId,
            vendorId,
            foodTruckId: dto.foodTruckId,
            status: 'PENDING',
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        })
      )
        throw new ConflictException(
          'You already have an active quote for this request. Withdraw it before sending a revised quote',
        );
      return tx.vendorOffer.create({
        data: {
          pricePerPerson: dto.pricePerPerson,
          communityRequestId: requestId,
          vendorId,
          foodTruckId: dto.foodTruckId,
          message: dto.message,
          noteToClient: dto.noteToClient ?? dto.message,
          pricingModel: financials.pricingModel as any,
          selectedMenuItems: dto.selectedMenuItems?.map((item) =>
            item.trim(),
          ) as any,
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
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM community_requests WHERE id = ${requestId}::uuid FOR UPDATE`;
        const current = await tx.vendorOffer.findUnique({
          where: { id: offerId },
          include: { communityRequest: true },
        });
        if (
          !current ||
          current.status !== 'PENDING' ||
          current.communityRequest.deletedAt ||
          current.communityRequest.status !== 'OPEN'
        )
          throw new ConflictException(
            'This quote or request is no longer available for acceptance',
          );
        if (
          (current.expiresAt && current.expiresAt <= new Date()) ||
          (current.communityRequest.expiresAt &&
            current.communityRequest.expiresAt <= new Date())
        )
          throw new ConflictException('This quote or request has expired');
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
        const { startsAt, endsAt } = communityEventWindow(
          offer.communityRequest.eventDate,
          offer.communityRequest.startTime,
          offer.communityRequest.endTime,
          offer.communityRequest.eventTimezone,
        );
        await tx.$queryRaw`SELECT id FROM food_trucks WHERE id = ${offer.foodTruckId}::uuid FOR UPDATE`;
        const overlap = await tx.booking.findFirst({
          where: {
            foodTruckId: offer.foodTruckId,
            status: { in: ['PAYMENT_PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
            startsAt: { lt: endsAt },
            OR: [{ endsAt: null }, { endsAt: { gt: startsAt } }],
          },
        });
        const hold = await tx.bookingHold.findFirst({
          where: {
            foodTruckId: offer.foodTruckId,
            expiresAt: { gt: new Date() },
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
        });
        if (overlap || hold)
          throw new ConflictException(
            'Food truck is already booked or reserved during this event',
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
            budgetAmount:
              offer.communityRequest.budgetMax ??
              offer.communityRequest.budgetMin,
            subtotal: offer.baseServiceFee,
            outsideRadiusFee: offer.transportFee,
            serviceFee: offer.serviceFee,
            taxAmount: offer.taxAmount,
            discountAmount: offer.discountAmount,
            totalAmount: offer.quotedAmount,
            paymentPreference: offer.paymentPreference ?? 'NO_PREFERENCE',
            specialInstructions: offer.communityRequest.description,
            customMenuItems: offer.selectedMenuItems ?? undefined,
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
      },
      {
        maxWait: 10000,
        timeout: 20000,
      },
    );
  }

  rejectOffer(offerId: string) {
    return this.changePendingOffer(offerId, 'REJECTED');
  }

  withdrawOffer(offerId: string) {
    return this.changePendingOffer(offerId, 'WITHDRAWN');
  }

  private async changePendingOffer(
    offerId: string,
    status: 'REJECTED' | 'WITHDRAWN',
  ) {
    return this.prisma.$transaction(async (tx) => {
      const offer = await tx.vendorOffer.findUnique({ where: { id: offerId } });
      if (!offer) throw new ConflictException('Quote is no longer available');
      await tx.$queryRaw`SELECT id FROM community_requests WHERE id = ${offer.communityRequestId}::uuid FOR UPDATE`;
      const result = await tx.vendorOffer.updateMany({
        where: { id: offerId, status: 'PENDING' },
        data: { status },
      });
      if (!result.count)
        throw new ConflictException(
          'Only pending quotes can be rejected or withdrawn',
        );
      return tx.vendorOffer.findUnique({
        where: { id: offerId },
        include: this.offerInclude(),
      });
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
          eventTimezone: true,
          guestCount: true,
          address: true,
          contactPhone: true,
          budgetMin: true,
          budgetMax: true,
        },
      },
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

  private async createBookingNumber() {
    const date = new Date();
    const prefix = `BD-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `${prefix}-${suffix}`;
  }
}
