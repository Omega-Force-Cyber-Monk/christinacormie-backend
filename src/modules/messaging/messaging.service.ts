import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateDirectConversationDto } from './dto/create-direct-conversation.dto';
import { MessagingPaginationDto } from './dto/messaging-query.dto';
import {
  MessagingMessageTypeDto,
  SendMessageDto,
} from './dto/send-message.dto';
import { MessagingRealtimeService } from './messaging-realtime.service';
import {
  RecipientAccountType,
  RecipientSearchDto,
} from './dto/recipient-search.dto';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);
  private readonly messageNotificationCooldownMinutes = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly realtimeService: MessagingRealtimeService,
  ) {}

  async listConversations(userId: string, query: MessagingPaginationDto) {
    const limit = Math.min(query.limit ?? 20, 50);
    const offset = query.offset ?? 0;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where: {
          participants: { some: { userId } },
          NOT: {
            directStatus: 'REQUESTED',
            requestedRecipientId: userId,
          },
        },
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
        include: this.conversationInclude(),
      }),
      this.prisma.conversation.count({
        where: {
          participants: { some: { userId } },
          NOT: {
            directStatus: 'REQUESTED',
            requestedRecipientId: userId,
          },
        },
      }),
    ]);

    const conversations = await Promise.all(
      items.map((conversation) =>
        this.presentConversation(conversation, userId),
      ),
    );

    return {
      message: 'Conversations retrieved successfully',
      items: conversations,
      total,
      nextOffset: offset + conversations.length < total ? offset + limit : null,
    };
  }

  async searchRecipients(userId: string, query: RecipientSearchDto) {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const search = query.search?.trim();
    const where: any = {
      id: { not: userId },
      deletedAt: null,
      status: 'ACTIVE',
      blocksInitiated: { none: { blockedUserId: userId } },
      blocksReceived: { none: { blockerUserId: userId } },
      ...(query.type === RecipientAccountType.VENDOR
        ? { vendor: { isNot: null } }
        : query.type === RecipientAccountType.CUSTOMER
          ? { vendor: { is: null } }
          : {}),
      ...(search
        ? {
            OR: [
              {
                profile: {
                  displayName: { contains: search, mode: 'insensitive' },
                },
              },
              {
                profile: {
                  firstName: { contains: search, mode: 'insensitive' },
                },
              },
              {
                profile: {
                  lastName: { contains: search, mode: 'insensitive' },
                },
              },
              {
                vendor: {
                  businessName: { contains: search, mode: 'insensitive' },
                },
              },
              {
                vendor: {
                  foodTrucks: {
                    some: { name: { contains: search, mode: 'insensitive' } },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        select: this.recipientSelect(),
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: users.map((user) => {
        const presented = this.presentUser(user);
        if (!presented) return null;
        const { email: _email, ...publicRecipient } = presented;
        return publicRecipient;
      }),
      total,
      nextOffset: offset + users.length < total ? offset + limit : null,
    };
  }

  async listMessageRequests(userId: string, query: MessagingPaginationDto) {
    const limit = Math.min(query.limit ?? 20, 50);
    const offset = query.offset ?? 0;
    const where = {
      type: 'DIRECT' as const,
      directStatus: 'REQUESTED' as const,
      requestedRecipientId: userId,
      participants: { some: { userId } },
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: this.conversationInclude(),
      }),
      this.prisma.conversation.count({ where }),
    ]);
    return {
      items: await Promise.all(
        items.map((item) => this.presentConversation(item, userId)),
      ),
      total,
      nextOffset: offset + items.length < total ? offset + limit : null,
    };
  }

  async getConversation(userId: string, conversationId: string) {
    await this.ensureParticipant(userId, conversationId);

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: this.conversationInclude(),
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return {
      message: 'Conversation retrieved successfully',
      conversation: await this.presentConversation(conversation, userId),
    };
  }

  async createDirectConversation(
    userId: string,
    dto: CreateDirectConversationDto,
  ) {
    const targetUserId = await this.resolveDirectParticipant(dto);

    if (targetUserId === userId) {
      throw new BadRequestException(
        'You cannot start a conversation with yourself',
      );
    }

    await this.ensureUserCanChat(userId);
    await this.ensureUserCanChat(targetUserId, 'Chat recipient not found');
    await this.ensureNotBlocked(userId, targetUserId);

    const existing = await this.findExistingDirectConversation(
      userId,
      targetUserId,
    );

    if (existing) {
      return {
        message: 'Conversation already exists',
        conversation: await this.presentConversation(existing, userId),
      };
    }

    const recipientFollowsSender = await this.prisma.userFollow.findUnique({
      where: {
        followerUserId_followedUserId: {
          followerUserId: targetUserId,
          followedUserId: userId,
        },
      },
      select: { id: true },
    });
    const isRequest = !recipientFollowsSender;
    const conversation = await this.prisma.conversation.create({
      data: {
        type: 'DIRECT',
        createdById: userId,
        title: dto.title?.trim() || null,
        directStatus: isRequest ? 'REQUESTED' : 'ACTIVE',
        requestedRecipientId: isRequest ? targetUserId : null,
        acceptedAt: isRequest ? null : new Date(),
        participants: {
          create: [{ userId }, { userId: targetUserId }],
        },
      },
      include: this.conversationInclude(),
    });

    return {
      message: 'Conversation created successfully',
      conversation: await this.presentConversation(conversation, userId),
    };
  }

  async resolveMessageRequest(
    userId: string,
    conversationId: string,
    status: 'ACTIVE' | 'DECLINED',
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        type: 'DIRECT',
        directStatus: 'REQUESTED',
        requestedRecipientId: userId,
        participants: { some: { userId } },
      },
      select: { id: true },
    });
    if (!conversation) throw new NotFoundException('Message request not found');
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        directStatus: status,
        acceptedAt: status === 'ACTIVE' ? new Date() : null,
      },
    });
    return { conversationId, status };
  }

  async listMessages(
    userId: string,
    conversationId: string,
    query: MessagingPaginationDto,
  ) {
    await this.ensureParticipant(userId, conversationId);

    const limit = Math.min(query.limit ?? 30, 100);
    const offset = query.offset ?? 0;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where: { conversationId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: this.messageInclude(),
      }),
      this.prisma.message.count({
        where: { conversationId, deletedAt: null },
      }),
    ]);

    return {
      message: 'Messages retrieved successfully',
      items: items.map((item) => this.presentMessage(item)),
      total,
      nextOffset: offset + items.length < total ? offset + limit : null,
    };
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    dto: SendMessageDto,
  ) {
    const conversation = await this.ensureParticipant(userId, conversationId);
    const otherParticipant =
      await this.prisma.conversationParticipant.findFirst({
        where: { conversationId, userId: { not: userId } },
        select: { userId: true },
      });
    if (otherParticipant) {
      await this.ensureNotBlocked(userId, otherParticipant.userId);
    }

    if (conversation.isClosed) {
      throw new BadRequestException('This conversation is closed');
    }

    if (conversation.directStatus === 'DECLINED') {
      throw new ForbiddenException('This message request was declined');
    }

    if (conversation.directStatus === 'REQUESTED') {
      if (conversation.requestedRecipientId === userId) {
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { directStatus: 'ACTIVE', acceptedAt: new Date() },
        });
      } else {
        const existingCount = await this.prisma.message.count({
          where: { conversationId, senderId: userId, deletedAt: null },
        });
        if (existingCount > 0) {
          throw new ForbiddenException(
            'Wait for the recipient to accept your request',
          );
        }
        if (
          dto.attachmentUrl ||
          dto.messageType === MessagingMessageTypeDto.IMAGE ||
          dto.messageType === MessagingMessageTypeDto.FILE
        ) {
          throw new ForbiddenException(
            'Attachments require an accepted conversation',
          );
        }
      }
    }

    const messageType = dto.messageType ?? MessagingMessageTypeDto.TEXT;
    const content = dto.content?.trim();

    if (!content && !dto.attachmentUrl) {
      throw new BadRequestException(
        'Message content or attachmentUrl is required',
      );
    }

    if (messageType === MessagingMessageTypeDto.TEXT && !content) {
      throw new BadRequestException('Text message content is required');
    }

    if (
      [MessagingMessageTypeDto.IMAGE, MessagingMessageTypeDto.FILE].includes(
        messageType,
      ) &&
      !dto.attachmentUrl
    ) {
      throw new BadRequestException(
        'attachmentUrl is required for image or file messages',
      );
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          senderId: userId,
          messageType,
          content: content ?? null,
          attachmentUrl: dto.attachmentUrl,
        },
        include: this.messageInclude(),
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: created.createdAt },
      });

      await tx.conversationParticipant.updateMany({
        where: { conversationId, userId },
        data: { lastReadAt: created.createdAt },
      });

      return created;
    });

    const presentedMessage = this.presentMessage(message);
    this.realtimeService.emitNewMessage(conversationId, presentedMessage);
    await this.notifyOtherParticipants(conversationId, userId, message);

    return {
      message: 'Message sent successfully',
      item: presentedMessage,
    };
  }

  async markRead(userId: string, conversationId: string) {
    await this.ensureParticipant(userId, conversationId);

    const readAt = new Date();
    await this.prisma.conversationParticipant.updateMany({
      where: { conversationId, userId },
      data: { lastReadAt: readAt },
    });

    this.realtimeService.emitConversationRead(conversationId, {
      conversationId,
      userId,
      readAt: readAt.toISOString(),
    });

    return { message: 'Conversation marked as read' };
  }

  private async resolveDirectParticipant(dto: CreateDirectConversationDto) {
    const suppliedTargets = [
      dto.participantUserId,
      dto.vendorId,
      dto.foodTruckId,
    ].filter(Boolean);

    if (suppliedTargets.length !== 1) {
      throw new BadRequestException(
        'Provide exactly one of participantUserId, vendorId, or foodTruckId',
      );
    }

    if (dto.participantUserId) {
      return dto.participantUserId;
    }

    if (dto.vendorId) {
      const vendor = await this.prisma.vendor.findFirst({
        where: { id: dto.vendorId, deletedAt: null },
        select: { userId: true },
      });

      if (!vendor) {
        throw new NotFoundException('Vendor not found');
      }

      return vendor.userId;
    }

    const foodTruck = await this.prisma.foodTruck.findFirst({
      where: { id: dto.foodTruckId, deletedAt: null },
      select: { vendor: { select: { userId: true } } },
    });

    if (!foodTruck) {
      throw new NotFoundException('Food truck not found');
    }

    return foodTruck.vendor.userId;
  }

  private async findExistingDirectConversation(
    userId: string,
    targetUserId: string,
  ) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        type: 'DIRECT',
        participants: { some: { userId } },
        AND: [{ participants: { some: { userId: targetUserId } } }],
      },
      include: this.conversationInclude(),
    });

    return (
      conversations.find(
        (conversation) =>
          conversation.participants.length === 2 &&
          conversation.participants.some((item) => item.userId === userId) &&
          conversation.participants.some(
            (item) => item.userId === targetUserId,
          ),
      ) ?? null
    );
  }

  private async ensureParticipant(userId: string, conversationId: string) {
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { userId, conversationId },
      select: {
        id: true,
        conversation: {
          select: {
            id: true,
            type: true,
            isClosed: true,
            directStatus: true,
            requestedRecipientId: true,
          },
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException('Conversation is not visible to this user');
    }

    return participant.conversation;
  }

  private async ensureNotBlocked(firstUserId: string, secondUserId: string) {
    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerUserId: firstUserId, blockedUserId: secondUserId },
          { blockerUserId: secondUserId, blockedUserId: firstUserId },
        ],
      },
      select: { id: true },
    });
    if (block)
      throw new ForbiddenException(
        'Messaging is not available for this account',
      );
  }

  private async ensureUserCanChat(
    userId: string,
    notFoundMessage = 'User not found',
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, status: true },
    });

    if (!user) {
      throw new NotFoundException(notFoundMessage);
    }

    if (['SUSPENDED', 'DEACTIVATED', 'BLOCKED'].includes(user.status)) {
      throw new ForbiddenException('User account cannot use messaging');
    }
  }

  private async notifyOtherParticipants(
    conversationId: string,
    senderId: string,
    message: { id: string; content: string | null; messageType: string },
  ) {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { not: senderId }, isMuted: false },
      select: { userId: true },
    });

    for (const participant of participants) {
      try {
        await this.notificationsService.notify({
          userId: participant.userId,
          actorUserId: senderId,
          type: 'MESSAGE',
          title: 'New message',
          message: message.content ?? 'You received a new message.',
          conversationId,
          actionUrl: `/api/v1/messaging/conversations/${conversationId}`,
          metadata: {
            eventType: 'MESSAGE_CREATED',
            conversationId,
            messageId: message.id,
            messageType: message.messageType,
          },
          pushPreferenceKey: 'messageAlerts',
          pushData: {
            eventType: 'MESSAGE_CREATED',
            conversationId,
            messageId: message.id,
          },
          dedupe: {
            windowMinutes: this.messageNotificationCooldownMinutes,
            metadata: {
              eventType: 'MESSAGE_CREATED',
              conversationId,
            },
          },
        });
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : 'Unknown notification error';
        this.logger.warn(`Failed to notify message recipient: ${detail}`);
      }
    }
  }

  private conversationInclude() {
    return {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  displayName: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                },
              },
              vendor: {
                select: {
                  id: true,
                  businessName: true,
                  logoUrl: true,
                  foodTrucks: {
                    where: { deletedAt: null },
                    take: 1,
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                      profileImageUrl: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        include: this.messageInclude(),
      },
      _count: {
        select: {
          messages: { where: { deletedAt: null } },
        },
      },
    };
  }

  private messageInclude() {
    return {
      sender: {
        select: {
          id: true,
          email: true,
          profile: {
            select: {
              displayName: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          vendor: {
            select: {
              id: true,
              businessName: true,
              logoUrl: true,
              foodTrucks: {
                where: { deletedAt: null },
                take: 1,
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  profileImageUrl: true,
                },
              },
            },
          },
        },
      },
    };
  }

  private async presentConversation(conversation: any, currentUserId: string) {
    const currentParticipant = conversation.participants.find(
      (participant: any) => participant.userId === currentUserId,
    );
    const lastReadAt = currentParticipant?.lastReadAt ?? null;
    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId: conversation.id,
        deletedAt: null,
        senderId: { not: currentUserId },
        ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
      },
    });

    const participants = conversation.participants.map((participant: any) => ({
      id: participant.id,
      userId: participant.userId,
      lastReadAt: participant.lastReadAt,
      isMuted: participant.isMuted,
      user: this.presentUser(participant.user),
    }));
    const otherParticipant =
      participants.find(
        (participant: any) => participant.userId !== currentUserId,
      ) ?? null;

    return {
      id: conversation.id,
      type: conversation.type,
      title: conversation.title,
      isClosed: conversation.isClosed,
      directStatus: conversation.directStatus,
      requestedRecipientId: conversation.requestedRecipientId,
      acceptedAt: conversation.acceptedAt,
      createdAt: conversation.createdAt,
      lastMessageAt: conversation.lastMessageAt,
      unreadCount,
      messageCount: conversation._count?.messages ?? 0,
      otherParticipant,
      participants,
      lastMessage: conversation.messages?.[0]
        ? this.presentMessage(conversation.messages[0])
        : null,
    };
  }

  private presentMessage(message: any) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      messageType: message.messageType,
      content: message.content,
      attachmentUrl: message.attachmentUrl,
      createdAt: message.createdAt,
      editedAt: message.editedAt,
      sender: this.presentUser(message.sender),
    };
  }

  private presentUser(user: any) {
    if (!user) {
      return null;
    }

    const truck = user.vendor?.foodTrucks?.[0];
    return {
      id: user.id,
      email: user.email,
      accountType: user.vendor ? 'VENDOR' : 'CUSTOMER',
      displayName:
        truck?.name ??
        user.vendor?.businessName ??
        user.profile?.displayName ??
        [user.profile?.firstName, user.profile?.lastName]
          .filter(Boolean)
          .join(' ') ??
        null,
      avatarUrl:
        truck?.profileImageUrl ??
        user.vendor?.logoUrl ??
        user.profile?.avatarUrl ??
        null,
      vendor: user.vendor
        ? {
            id: user.vendor.id,
            businessName: user.vendor.businessName,
            logoUrl: user.vendor.logoUrl,
            foodTruck: truck ?? null,
          }
        : null,
    };
  }

  private recipientSelect() {
    return {
      id: true,
      email: true,
      profile: {
        select: {
          displayName: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
      vendor: {
        select: {
          id: true,
          businessName: true,
          logoUrl: true,
          foodTrucks: {
            where: { deletedAt: null },
            take: 1,
            select: { id: true, name: true, slug: true, profileImageUrl: true },
          },
        },
      },
    };
  }
}
