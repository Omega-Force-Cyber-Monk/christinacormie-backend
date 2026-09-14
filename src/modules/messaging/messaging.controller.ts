import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { CreateDirectConversationDto } from './dto/create-direct-conversation.dto';
import { MessagingPaginationDto } from './dto/messaging-query.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagingService } from './messaging.service';

const errorExample = (
  statusCode: number,
  message: string | string[],
  error: string,
) => ({ statusCode, message, error });

const conversationExample = {
  id: '7e7f3f6a-f047-49a4-8a01-4bbfd8e8ad1b',
  type: 'DIRECT',
  title: 'Question about Taco Paradise',
  isClosed: false,
  createdAt: '2026-09-13T10:00:00.000Z',
  lastMessageAt: '2026-09-13T10:02:00.000Z',
  unreadCount: 1,
  messageCount: 3,
  otherParticipant: {
    id: 'participant-id',
    userId: 'vendor-user-id',
    lastReadAt: null,
    isMuted: false,
    user: {
      id: 'vendor-user-id',
      email: 'vendor@example.com',
      displayName: 'Taco Paradise',
      avatarUrl: null,
      vendor: {
        id: 'vendor-id',
        businessName: 'Taco Paradise',
        logoUrl: null,
      },
    },
  },
  participants: [
    {
      id: 'participant-id',
      userId: 'user-id',
      lastReadAt: '2026-09-13T10:01:00.000Z',
      isMuted: false,
      user: {
        id: 'user-id',
        email: 'customer@example.com',
        displayName: 'Alex Rivera',
        avatarUrl: null,
        vendor: null,
      },
    },
  ],
  lastMessage: {
    id: 'message-id',
    conversationId: '7e7f3f6a-f047-49a4-8a01-4bbfd8e8ad1b',
    senderId: 'user-id',
    messageType: 'TEXT',
    content: 'Hi, are you available?',
    attachmentUrl: null,
    createdAt: '2026-09-13T10:02:00.000Z',
    editedAt: null,
  },
};

@ApiTags('Messaging')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @ApiOperation({ summary: 'List my chat conversations' })
  @ApiResponse({
    status: 200,
    description: 'Conversations returned successfully.',
    schema: {
      example: {
        message: 'Conversations retrieved successfully',
        items: [conversationExample],
        total: 1,
        nextOffset: null,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: {
      example: errorExample(
        401,
        'Invalid or expired access token',
        'Unauthorized',
      ),
    },
  })
  @Get('conversations')
  listConversations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MessagingPaginationDto,
  ) {
    return this.messagingService.listConversations(user.sub, query);
  }

  @ApiOperation({
    summary: 'Start or reuse a direct conversation',
    description:
      'Provide exactly one of participantUserId, vendorId, or foodTruckId. Food truck profile message buttons should use foodTruckId.',
  })
  @ApiBody({
    type: CreateDirectConversationDto,
    examples: {
      byFoodTruck: {
        summary: 'Start chat from food truck profile',
        value: {
          foodTruckId: '7e7f3f6a-f047-49a4-8a01-4bbfd8e8ad1b',
          title: 'Question about Taco Paradise',
        },
      },
      byUser: {
        summary: 'Start chat with known user',
        value: {
          participantUserId: '7e7f3f6a-f047-49a4-8a01-4bbfd8e8ad1b',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Conversation created or reused.',
    schema: {
      example: {
        message: 'Conversation created successfully',
        conversation: conversationExample,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid target or self-chat request.',
    schema: {
      example: errorExample(
        400,
        'Provide exactly one of participantUserId, vendorId, or foodTruckId',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Recipient, vendor, or food truck was not found.',
    schema: { example: errorExample(404, 'Food truck not found', 'Not Found') },
  })
  @Post('conversations/direct')
  createDirectConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDirectConversationDto,
  ) {
    return this.messagingService.createDirectConversation(user.sub, dto);
  }

  @ApiOperation({ summary: 'Get one conversation' })
  @ApiResponse({
    status: 200,
    description: 'Conversation returned successfully.',
    schema: {
      example: {
        message: 'Conversation retrieved successfully',
        conversation: conversationExample,
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Authenticated user is not a participant.',
    schema: {
      example: errorExample(
        403,
        'Conversation is not visible to this user',
        'Forbidden',
      ),
    },
  })
  @Get('conversations/:conversationId')
  getConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.messagingService.getConversation(user.sub, conversationId);
  }

  @ApiOperation({ summary: 'List messages in a conversation' })
  @ApiResponse({
    status: 200,
    description: 'Messages returned successfully.',
    schema: {
      example: {
        message: 'Messages retrieved successfully',
        items: [conversationExample.lastMessage],
        total: 1,
        nextOffset: null,
      },
    },
  })
  @Get('conversations/:conversationId/messages')
  listMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query() query: MessagingPaginationDto,
  ) {
    return this.messagingService.listMessages(user.sub, conversationId, query);
  }

  @ApiOperation({ summary: 'Send a message in a conversation' })
  @ApiBody({
    type: SendMessageDto,
    examples: {
      text: {
        value: {
          messageType: 'TEXT',
          content: 'Hi, are you available for this booking?',
        },
      },
      image: {
        value: {
          messageType: 'IMAGE',
          attachmentUrl:
            'https://res.cloudinary.com/demo/image/upload/v1/bitedrop/messages/photo.jpg',
          content: 'Menu reference photo',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Message sent successfully.',
    schema: {
      example: {
        message: 'Message sent successfully',
        item: conversationExample.lastMessage,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Missing content/attachment, closed chat, or invalid message type.',
    schema: {
      example: errorExample(
        400,
        'Text message content is required',
        'Bad Request',
      ),
    },
  })
  @Post('conversations/:conversationId/messages')
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagingService.sendMessage(user.sub, conversationId, dto);
  }

  @ApiOperation({ summary: 'Mark a conversation as read' })
  @ApiResponse({
    status: 200,
    description: 'Conversation read marker updated.',
    schema: { example: { message: 'Conversation marked as read' } },
  })
  @Patch('conversations/:conversationId/read')
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.messagingService.markRead(user.sub, conversationId);
  }
}
