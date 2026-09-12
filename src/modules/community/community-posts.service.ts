import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CloudinaryService } from '../../infrastructure/cloudinary/cloudinary.service';
import { CommunityService } from './community.service';
import { CommunityRepository } from './community.repository';
import { CreateCommunityRequestDto } from './dto/create-community-request.dto';
import {
  CommunityPostQueryDto,
  UpdateCommunityPostDto,
} from './dto/community-post-query.dto';
import { validateCommunityPost } from './community-validation';

@Injectable()
export class CommunityPostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly community: CommunityService,
    private readonly repository: CommunityRepository,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async create(userId: string, dto: CreateCommunityRequestDto) {
    const post = await this.community.createPublicRequest(userId, dto);
    return {
      message: 'Community post created successfully',
      post: await this.details(userId, post.id),
      rewardStatus: post.rewardStatus,
      ...('rewardMessage' in post ? { rewardMessage: post.rewardMessage } : {}),
    };
  }

  private include(userId: string) {
    return {
      media: true,
      createdBy: {
        select: {
          id: true,
          profile: { select: { displayName: true, avatarUrl: true } },
          userRoles: { select: { role: true } },
          vendor: {
            select: { businessName: true, logoUrl: true, isVerified: true },
          },
        },
      },
      actions: { where: { userId }, select: { type: true } },
      vendorOffers: {
        where: {
          vendor: { userId },
          status: 'PENDING' as const,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { id: true },
      },
      _count: {
        select: {
          comments: { where: { deletedAt: null } },
          reactions: true,
          vendorOffers: true,
          actions: { where: { type: 'INTEREST' as const } },
        },
      },
    } satisfies Prisma.CommunityRequestInclude;
  }

  private async responder(userId: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { userId } });
    return (
      !!vendor &&
      !vendor.deletedAt &&
      vendor.status === 'APPROVED' &&
      vendor.isVerified
    );
  }

  private present(
    post: Prisma.CommunityRequestGetPayload<{
      include: ReturnType<CommunityPostsService['include']>;
    }>,
    userId: string,
    canRespond: boolean,
  ) {
    const { createdBy, actions, vendorOffers, _count, ...data } = post;
    const isOwner = post.createdById === userId;
    const open =
      post.status === 'OPEN' &&
      (!post.expiresAt || post.expiresAt > new Date());
    return {
      ...data,
      author: {
        id: createdBy.id,
        displayName:
          createdBy.profile?.displayName ??
          createdBy.vendor?.businessName ??
          'Member',
        avatarUrl:
          createdBy.profile?.avatarUrl ?? createdBy.vendor?.logoUrl ?? null,
        roles: createdBy.userRoles.map((r) => r.role),
        vendor: createdBy.vendor,
      },
      counts: {
        comments: _count.comments,
        reactions: _count.reactions,
        offers: _count.vendorOffers,
        interestedVendors: _count.actions,
      },
      viewer: {
        isOwner,
        isIgnored: actions.some((a) => a.type === 'IGNORE'),
        isInterested: actions.some((a) => a.type === 'INTEREST'),
      },
      allowedActions: {
        canEdit: isOwner && open && !_count.vendorOffers,
        canDelete: isOwner && open && !_count.vendorOffers,
        canQuote:
          !isOwner &&
          canRespond &&
          open &&
          post.category === 'NEED_TRUCK' &&
          !vendorOffers.length,
        canSendInterest:
          !isOwner &&
          canRespond &&
          open &&
          post.category === 'VENDOR_CALLOUT' &&
          !actions.some((a) => a.type === 'INTEREST'),
      },
    };
  }

  async list(userId: string, query: CommunityPostQueryDto) {
    if ((query.latitude === undefined) !== (query.longitude === undefined))
      throw new BadRequestException(
        'latitude and longitude must be provided together',
      );
    if (query.radiusKm !== undefined && query.latitude === undefined)
      throw new BadRequestException(
        'latitude and longitude are required when radiusKm is provided',
      );
    const where: Prisma.CommunityRequestWhereInput = { deletedAt: null };
    if (query.tab === 'MINE') where.createdById = userId;
    else {
      where.visibility = 'PUBLIC';
      where.status = { in: ['OPEN', 'MATCHED', 'CLOSED'] };
      where.actions = { none: { userId, type: 'IGNORE' } };
    }
    if (query.category) where.category = query.category;
    if (query.tab === 'REQUESTS') {
      where.createdById = { not: userId };
      where.status = 'OPEN';
      where.category = query.category ?? {
        in: ['NEED_TRUCK', 'VENDOR_CALLOUT'],
      };
      if (
        query.category &&
        !['NEED_TRUCK', 'VENDOR_CALLOUT'].includes(query.category)
      )
        throw new BadRequestException(
          'The Requests tab supports only NEED_TRUCK and VENDOR_CALLOUT',
        );
      where.OR = [{ expiresAt: null }, { expiresAt: { gt: new Date() } }];
    }
    let distances: Map<string, number> | undefined;
    if (query.latitude !== undefined && query.longitude !== undefined) {
      const rows = await this.prisma.$queryRaw<
        { id: string; distanceKm: number }[]
      >`SELECT id, ST_Distance(location, ST_SetSRID(ST_MakePoint(${query.longitude}, ${query.latitude}), 4326)::geography) / 1000 AS "distanceKm" FROM community_requests WHERE deleted_at IS NULL AND ST_DWithin(location, ST_SetSRID(ST_MakePoint(${query.longitude}, ${query.latitude}), 4326)::geography, ${(query.radiusKm ?? 40) * 1000})`;
      where.id = { in: rows.map((r) => r.id) };
      distances = new Map(rows.map((r) => [r.id, r.distanceKm]));
    }
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const [posts, total, canRespond] = await Promise.all([
      this.prisma.communityRequest.findMany({
        where,
        include: this.include(userId),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.communityRequest.count({ where }),
      this.responder(userId),
    ]);
    return {
      message: 'Community posts retrieved successfully',
      items: posts.map((p) => ({
        ...this.present(p, userId, canRespond),
        ...(distances ? { distanceKm: distances.get(p.id) } : {}),
      })),
      pagination: {
        total,
        limit,
        offset,
        nextOffset:
          offset + posts.length < total ? offset + posts.length : null,
      },
    };
  }

  async details(userId: string, postId: string) {
    await this.community.getRequestDetails(userId, postId);
    const post = await this.prisma.communityRequest.findFirst({
      where: { id: postId, deletedAt: null },
      include: this.include(userId),
    });
    if (!post) throw new NotFoundException('Community post not found');
    return this.present(post, userId, await this.responder(userId));
  }

  async update(userId: string, postId: string, dto: UpdateCommunityPostDto) {
    await this.repository.ensurePublisher(userId);
    if (!Object.keys(dto).length)
      throw new BadRequestException('Provide at least one field to update');
    for (const [key, value] of Object.entries(dto))
      if (value === null)
        throw new BadRequestException(`${key} cannot be null`);
    await this.prisma.$transaction(async (tx) => {
      const post = await this.lockOwner(tx, userId, postId);
      if (dto.category && dto.category !== post.category)
        throw new BadRequestException(
          'Post category cannot be changed; create a new post for a different category',
        );
      const full = validateCommunityPost({
        category: post.category,
        allowPublicComments: post.allowPublicComments,
        title: post.title,
        description: post.description ?? undefined,
        spotsOpen: post.spotsOpen ?? undefined,
        attendanceMin: post.attendanceMin ?? undefined,
        attendanceMax: post.attendanceMax ?? undefined,
        requestType:
          post.requestType as CreateCommunityRequestDto['requestType'],
        eventType:
          (post.eventType as CreateCommunityRequestDto['eventType']) ??
          undefined,
        eventDate: post.eventDate?.toISOString(),
        startTime: post.startTime?.toISOString().slice(11, 16),
        endTime: post.endTime?.toISOString().slice(11, 16),
        eventTimezone: post.eventTimezone ?? undefined,
        address: post.address ?? undefined,
        contactPhone: post.contactPhone ?? undefined,
        guestCount: post.guestCount ?? undefined,
        budgetMin: post.budgetMin === null ? undefined : Number(post.budgetMin),
        budgetMax: post.budgetMax === null ? undefined : Number(post.budgetMax),
        preferredCuisines:
          (post.preferredCuisines as string[] | null) ?? undefined,
        preferredMenuItems:
          (post.preferredMenuItems as string[] | null) ?? undefined,
        expiresAt: post.expiresAt?.toISOString(),
        ...dto,
      } as CreateCommunityRequestDto);
      const data: Prisma.CommunityRequestUpdateInput = {
        title: full.title,
        description: full.description,
        address: full.address,
        contactPhone: full.contactPhone,
        eventType: full.eventType,
        requestType: full.requestType,
        eventTimezone: full.eventTimezone,
        guestCount: full.guestCount,
        budgetMin: full.budgetMin,
        budgetMax: full.budgetMax,
        spotsOpen: full.spotsOpen,
        attendanceMin: full.attendanceMin,
        attendanceMax: full.attendanceMax,
        allowPublicComments: full.allowPublicComments,
        preferredMenuItems: full.preferredMenuItems,
        preferredCuisines: full.preferredCuisines,
        eventDate: full.eventDate
          ? new Date(full.eventDate.slice(0, 10) + 'T00:00:00Z')
          : undefined,
        startTime: full.startTime
          ? new Date('1970-01-01T' + full.startTime + ':00Z')
          : undefined,
        endTime: full.endTime
          ? new Date('1970-01-01T' + full.endTime + ':00Z')
          : undefined,
        expiresAt: full.expiresAt ? new Date(full.expiresAt) : undefined,
      };
      if (dto.media !== undefined)
        data.media = { deleteMany: {}, create: dto.media };
      await tx.communityRequest.update({ where: { id: postId }, data });
      if (dto.latitude !== undefined && dto.longitude !== undefined)
        await tx.$executeRaw`UPDATE community_requests SET location = ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}),4326)::geography WHERE id = ${postId}::uuid`;
    });
    return {
      message: 'Community post updated successfully',
      post: await this.details(userId, postId),
    };
  }

  private async lockOwner(
    tx: Prisma.TransactionClient,
    userId: string,
    postId: string,
  ) {
    await tx.$queryRaw`SELECT id FROM community_requests WHERE id = ${postId}::uuid FOR UPDATE`;
    const post = await tx.communityRequest.findUnique({
      where: { id: postId },
    });
    if (!post || post.deletedAt)
      throw new NotFoundException('Community post not found');
    if (post.createdById !== userId)
      throw new ForbiddenException(
        'Only the post owner can edit or delete this post',
      );
    if (
      post.status !== 'OPEN' ||
      (post.expiresAt && post.expiresAt <= new Date())
    )
      throw new ConflictException(
        'Only open, unexpired posts can be edited or deleted',
      );
    if (await tx.vendorOffer.count({ where: { communityRequestId: postId } }))
      throw new ConflictException(
        'This request has received quotes and cannot be edited or deleted',
      );
    return post;
  }

  async remove(userId: string, postId: string) {
    await this.repository.ensurePublisher(userId);
    await this.prisma.$transaction(async (tx) => {
      await this.lockOwner(tx, userId, postId);
      await tx.communityRequest.update({
        where: { id: postId },
        data: { deletedAt: new Date() },
      });
    });
    return { message: 'Community post deleted successfully', deleted: true };
  }

  async action(
    userId: string,
    postId: string,
    type: 'INTEREST' | 'IGNORE',
    message?: string,
  ) {
    await this.repository.ensurePublisher(userId);
    await this.community.getRequestDetails(userId, postId);
    if (type === 'INTEREST' && !(await this.responder(userId)))
      throw new ForbiddenException(
        'Only approved and verified vendors can send interest',
      );
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM community_requests WHERE id = ${postId}::uuid FOR UPDATE`;
      const post = await tx.communityRequest.findUnique({
        where: { id: postId },
      });
      if (!post || post.deletedAt)
        throw new NotFoundException('Community post not found');
      if (post.createdById === userId)
        throw new ForbiddenException(
          'You cannot respond to or ignore your own post',
        );
      if (type === 'INTEREST') {
        if (post.category !== 'VENDOR_CALLOUT')
          throw new BadRequestException(
            'Interest can only be sent to Vendor Callout posts',
          );
        if (
          post.status !== 'OPEN' ||
          (post.expiresAt && post.expiresAt <= new Date())
        )
          throw new ConflictException('This callout is closed or expired');
        if (
          await tx.communityPostAction.findUnique({
            where: { postId_userId_type: { postId, userId, type } },
          })
        )
          throw new ConflictException(
            'You have already sent interest to this callout',
          );
      }
      await tx.communityPostAction.upsert({
        where: { postId_userId_type: { postId, userId, type } },
        create: { postId, userId, type, message },
        update: {},
      });
    });
    return {
      message:
        type === 'INTEREST'
          ? 'Your interest was sent to the organizer'
          : 'Post hidden from your Community feed',
    };
  }

  async undoAction(
    userId: string,
    postId: string,
    type: 'INTEREST' | 'IGNORE',
  ) {
    await this.community.getRequestDetails(userId, postId);
    await this.prisma.communityPostAction.deleteMany({
      where: { postId, userId, type },
    });
    return {
      message:
        type === 'INTEREST'
          ? 'Interest withdrawn successfully'
          : 'Post restored to your Community feed',
    };
  }

  async interests(
    userId: string,
    postId: string,
    query: CommunityPostQueryDto,
  ) {
    const post = await this.community.getRequestDetails(userId, postId);
    if (post.createdById !== userId)
      throw new ForbiddenException(
        'Only the organizer can view interest messages',
      );
    if (post.category !== 'VENDOR_CALLOUT')
      throw new BadRequestException('This post is not a Vendor Callout');
    const where = { postId, type: 'INTEREST' as const };
    const [items, total] = await Promise.all([
      this.prisma.communityPostAction.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit ?? 20,
        skip: query.offset ?? 0,
        select: {
          id: true,
          message: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              profile: { select: { displayName: true, avatarUrl: true } },
              vendor: {
                select: {
                  id: true,
                  businessName: true,
                  logoUrl: true,
                  isVerified: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.communityPostAction.count({ where }),
    ]);
    return { message: 'Vendor interests retrieved successfully', items, total };
  }

  async comments(userId: string, postId: string, query: CommunityPostQueryDto) {
    await this.community.getRequestDetails(userId, postId);
    const where = { communityRequestId: postId, deletedAt: null };
    const limit = query.limit ?? 20,
      offset = query.offset ?? 0;
    const [items, total] = await Promise.all([
      this.prisma.communityRequestComment.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: limit,
        skip: offset,
        select: {
          id: true,
          parentCommentId: true,
          content: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              profile: { select: { displayName: true, avatarUrl: true } },
            },
          },
        },
      }),
      this.prisma.communityRequestComment.count({ where }),
    ]);
    return {
      message: 'Comments retrieved successfully',
      items,
      pagination: {
        total,
        limit,
        offset,
        nextOffset:
          offset + items.length < total ? offset + items.length : null,
      },
    };
  }

  async upload(userId: string, files: Express.Multer.File[]) {
    await this.repository.ensurePublisher(userId);
    if (!files?.length)
      throw new BadRequestException(
        'Select at least one JPG, PNG, or PDF file to upload',
      );
    if (files.length > 5)
      throw new BadRequestException('You can upload at most 5 files');
    for (const file of files) {
      const b = file.buffer;
      const valid =
        (file.mimetype === 'image/jpeg' &&
          b?.[0] === 0xff &&
          b?.[1] === 0xd8 &&
          b?.[2] === 0xff) ||
        (file.mimetype === 'image/png' &&
          b
            ?.subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
        (file.mimetype === 'application/pdf' &&
          b?.subarray(0, 5).toString() === '%PDF-');
      if (!valid)
        throw new BadRequestException(
          'Only valid JPG, PNG, or PDF files are accepted',
        );
      if (file.size > 10 * 1024 * 1024)
        throw new BadRequestException(
          'Each attachment must be 10 MB or smaller',
        );
    }
    if (!this.cloudinary.isConfigured())
      throw new ServiceUnavailableException(
        'Community uploads are not configured. Please contact support',
      );
    const media: { mediaUrl: string; mediaType: string }[] = [];
    try {
      for (const file of files) {
        const pdf = file.mimetype === 'application/pdf';
        const uploaded = await this.cloudinary.uploadBuffer(file.buffer, {
          folder: `bitedrop/community/${userId}`,
          resourceType: pdf ? 'raw' : 'image',
          ...(pdf ? { publicId: `${randomUUID()}.pdf` } : {}),
        });
        media.push({
          mediaUrl: uploaded.secure_url,
          mediaType: pdf ? 'PDF' : 'IMAGE',
        });
      }
    } catch {
      throw new ServiceUnavailableException(
        'Community attachment upload failed. Please try again',
      );
    }
    return { message: 'Attachments uploaded successfully', media };
  }
}
