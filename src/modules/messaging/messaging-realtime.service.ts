import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class MessagingRealtimeService {
  private server?: Server;

  bindServer(server: Server) {
    this.server = server;
  }

  emitNewMessage(conversationId: string, message: unknown) {
    this.server
      ?.to(this.conversationRoom(conversationId))
      .emit('message:new', message);
  }

  emitConversationRead(conversationId: string, payload: unknown) {
    this.server
      ?.to(this.conversationRoom(conversationId))
      .emit('conversation:read', payload);
  }

  private conversationRoom(conversationId: string) {
    return `conversation:${conversationId}`;
  }
}
