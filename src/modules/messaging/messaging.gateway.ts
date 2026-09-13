import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagingRealtimeService } from './messaging-realtime.service';
import { MessagingService } from './messaging.service';

type AuthenticatedSocket = Socket & {
  data: Socket['data'] & { user?: AuthenticatedUser };
};

@WebSocketGateway({
  namespace: '/messaging',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class MessagingGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagingGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly messagingService: MessagingService,
    private readonly realtimeService: MessagingRealtimeService,
  ) {}

  afterInit(server: Server) {
    this.realtimeService.bindServer(server);
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.getToken(client);
      if (!token) {
        throw new WsException('Access token is required');
      }

      client.data.user = await this.jwtService.verifyAsync<AuthenticatedUser>(
        token,
        { secret: process.env.JWT_ACCESS_SECRET },
      );
      await client.join(this.userRoom(client.data.user.sub));
    } catch {
      client.emit('error', { message: 'Invalid or expired access token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.data.user?.sub) {
      this.logger.debug(
        `Messaging socket disconnected: ${client.data.user.sub}`,
      );
    }
  }

  @SubscribeMessage('conversation:join')
  async joinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId?: string },
  ) {
    const user = this.requireUser(client);
    if (!body?.conversationId) {
      throw new WsException('conversationId is required');
    }

    const result = await this.messagingService.getConversation(
      user.sub,
      body.conversationId,
    );
    await client.join(this.conversationRoom(body.conversationId));

    return {
      event: 'conversation:joined',
      data: result,
    };
  }

  @SubscribeMessage('conversation:leave')
  async leaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId?: string },
  ) {
    if (!body?.conversationId) {
      throw new WsException('conversationId is required');
    }

    await client.leave(this.conversationRoom(body.conversationId));
    return {
      event: 'conversation:left',
      data: { conversationId: body.conversationId },
    };
  }

  @SubscribeMessage('message:send')
  async sendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    body: SendMessageDto & { conversationId?: string },
  ) {
    const user = this.requireUser(client);
    if (!body?.conversationId) {
      throw new WsException('conversationId is required');
    }

    const result = await this.messagingService.sendMessage(
      user.sub,
      body.conversationId,
      body,
    );

    return {
      event: 'message:sent',
      data: result,
    };
  }

  @SubscribeMessage('conversation:read')
  async markRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId?: string },
  ) {
    const user = this.requireUser(client);
    if (!body?.conversationId) {
      throw new WsException('conversationId is required');
    }

    const result = await this.messagingService.markRead(
      user.sub,
      body.conversationId,
    );

    return {
      event: 'conversation:read',
      data: result,
    };
  }

  private requireUser(client: AuthenticatedSocket) {
    if (!client.data.user) {
      throw new WsException('Socket is not authenticated');
    }

    return client.data.user;
  }

  private getToken(client: Socket) {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim();
    }

    const header = client.handshake.headers.authorization;
    if (typeof header !== 'string') {
      return undefined;
    }

    const [type, token] = header.split(' ');
    return type === 'Bearer' ? token : undefined;
  }

  private conversationRoom(conversationId: string) {
    return `conversation:${conversationId}`;
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }
}
