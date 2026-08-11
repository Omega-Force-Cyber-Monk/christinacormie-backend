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

  async createRequest(
    userId: string,
    dto: CreateCommunityRequestDto,
    visibility: 'PUBLIC' | 'PRIVATE',
    targetFoodTruckId?: string,
  ) {
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      return this.createRequestWithLocation(
        userId,
        dto,
        visibility,
        targetFoodTruckId,
      );
    }

    return this.prisma.communityRequest.create({
      data: {
        createdById: userId,
        targetFoodTruckId,
        visibility: visibility as any,
        requestType: dto.requestType as any,
        title: dto.title,
        description: dto.description,
        eventDate: dto.eventDate ? this.toDateOnly(dto.eventDate) : null,
        startTime: dto.startTime ? this.toTimeDate(dto.startTime) : null,
        endTime: dto.endTime ? this.toTimeDate(dto.endTime) : null,
        eventTimezone: dto.eventTimezone,
        guestCount: dto.guestCount,
        budgetMin: dto.budgetMin,
        budgetMax: dto.budgetMax,
        address: dto.address,
        preferredCuisines: dto.preferredCuisines as any,
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
    return this.prisma.vendorOffer.create({
      data: {
        communityRequestId: requestId,
        vendorId,
        foodTruckId: dto.foodTruckId,
        message: dto.message,
        quotedAmount: dto.quotedAmount,
        serviceFee: dto.serviceFee ?? 0,
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

      return offer;
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
        },
      },
      communityRequest: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    };
  }

  private toDateOnly(value: string): Date {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private toTimeDate(value: string): Date {
    return new Date(`1970-01-01T${value}:00.000Z`);
  }
}
