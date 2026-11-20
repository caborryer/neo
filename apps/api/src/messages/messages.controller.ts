import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import {
  listConversationsQuerySchema,
  listMessagesQuerySchema,
  sendMessageSchema,
  type ListConversationsQuery,
  type ListMessagesQuery,
  type SendMessageInput,
} from '@neo/validation';
import { CurrentUser, Roles } from '../common/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { MessagesService } from './messages.service';

const SEND_LIMIT = { default: { limit: 20, ttl: 60_000 } };

@Controller()
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  /** Badge de no leídos, para ambos roles. */
  @Get('messages/unread-count')
  unread(@CurrentUser() user: AuthenticatedUser) {
    return this.messages.unreadCount(user);
  }

  // ── Usuaria: su propio hilo con la Coach ──

  @Roles(UserRole.USER)
  @Get('messages/thread')
  thread(@CurrentUser() user: AuthenticatedUser) {
    return this.messages.threadInfoForUser(user);
  }

  @Roles(UserRole.USER)
  @Get('messages')
  list(@CurrentUser() user: AuthenticatedUser, @Query(new ZodValidationPipe(listMessagesQuerySchema)) q: ListMessagesQuery) {
    return this.messages.listForUser(user, q);
  }

  @Roles(UserRole.USER)
  @Throttle(SEND_LIMIT)
  @Post('messages')
  send(@CurrentUser() user: AuthenticatedUser, @Body(new ZodValidationPipe(sendMessageSchema)) body: SendMessageInput) {
    return this.messages.sendAsUser(user, body);
  }

  @Roles(UserRole.USER)
  @HttpCode(200)
  @Post('messages/read')
  read(@CurrentUser() user: AuthenticatedUser) {
    return this.messages.markReadForUser(user);
  }

  // ── Coach: conversaciones con cada usuaria ──

  @Roles(UserRole.COACH)
  @Get('coach/conversations')
  conversations(@Query(new ZodValidationPipe(listConversationsQuerySchema)) q: ListConversationsQuery) {
    return this.messages.conversations(q);
  }

  @Roles(UserRole.COACH)
  @Get('coach/conversations/:userId/thread')
  coachThread(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.messages.threadInfoForCoach(userId);
  }

  @Roles(UserRole.COACH)
  @Get('coach/conversations/:userId/messages')
  coachList(
    @CurrentUser() coach: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query(new ZodValidationPipe(listMessagesQuerySchema)) q: ListMessagesQuery,
  ) {
    return this.messages.listForCoach(coach, userId, q);
  }

  @Roles(UserRole.COACH)
  @Throttle(SEND_LIMIT)
  @Post('coach/conversations/:userId/messages')
  coachSend(
    @CurrentUser() coach: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) body: SendMessageInput,
  ) {
    return this.messages.sendAsCoach(coach, userId, body);
  }

  @Roles(UserRole.COACH)
  @HttpCode(200)
  @Post('coach/conversations/:userId/read')
  coachRead(@CurrentUser() coach: AuthenticatedUser, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.messages.markReadForCoach(coach, userId);
  }
}
