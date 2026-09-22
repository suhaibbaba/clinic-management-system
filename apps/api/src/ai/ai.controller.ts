import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import type { FastifyReply } from "fastify";
import {
  AI_ERROR_CODE,
  AI_STREAM_EVENT,
  USER_ROLE,
  aiChatRequestSchema,
  idParamSchema,
  listAiConversationsQuerySchema,
  renameAiConversationSchema,
  type AiConversation,
  type AiMessage,
  type AiStreamEvent,
  type Paginated,
} from "@clinic/shared";
import { createZodDto } from "nestjs-zod";
import { AgentService } from "@api/ai/agent.service";
import { AiBudgetService, AiLimitError } from "@api/ai/ai-budget.service";
import { AiConversationsService } from "@api/ai/ai-conversations.service";
import { Capability } from "@api/common/decorators/capability.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";

class ChatDto extends createZodDto(aiChatRequestSchema) {}
class ListConversationsQueryDto extends createZodDto(listAiConversationsQuerySchema) {}
class RenameConversationDto extends createZodDto(renameAiConversationSchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}

const STAFF = [USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN, USER_ROLE.RECEPTIONIST] as const;

@Controller("ai")
export class AiController {
  private readonly logger = new Logger("Assistant");

  constructor(
    private readonly agent: AgentService,
    private readonly budget: AiBudgetService,
    private readonly conversations: AiConversationsService,
  ) {}

  // Server-sent events over POST, so the question travels in a body rather than a URL somebody's
  // proxy will log. The per-user hourly limit is checked here, before the stream exists: a refusal
  // is an ordinary 429 whose `message` is the code the web resolves its Arabic from.
  @Post("chat")
  @Roles(...STAFF)
  @Capability("ai.chat")
  // The per-user hourly ceiling is the real control; this one only stops a client hammering the
  // route. The guard is named explicitly because none is registered globally.
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async chat(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: ChatDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    // Everything that can answer with a status does so before the socket is hijacked: after that
    // there is no response left to send, and an exception would leave the browser hanging.
    if (body.conversationId) {
      await this.conversations.requireOwn(actor, body.conversationId);
    }

    try {
      await this.budget.assertWithinLimits(actor);
    } catch (error) {
      if (error instanceof AiLimitError) {
        throw new HttpException(error.code, HttpStatus.TOO_MANY_REQUESTS);
      }

      throw error;
    }

    reply.hijack();
    reply.raw.writeHead(HttpStatus.OK, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // nginx buffers a proxied response by default, which holds every token back to the end.
      "x-accel-buffering": "no",
    });

    let running = true;
    let conversationId = body.conversationId;

    // A proxy with a 60 s idle limit would otherwise close a slow tool call mid-turn. A comment
    // line is not a frame, so the page skips it.
    const heartbeat = setInterval(() => reply.raw.write(HEARTBEAT), HEARTBEAT_MS);

    reply.raw.on("close", () => {
      if (running) {
        this.logger.warn(
          `Turn interrupted: the connection closed (conversation ${conversationId ?? "new"})`,
        );
      }
    });

    try {
      for await (const event of this.agent.run(actor, body)) {
        // A browser that walked away stops the loop; what ran up to here is already recorded.
        if (reply.raw.destroyed) {
          return;
        }

        if (event.type === AI_STREAM_EVENT.CONVERSATION) {
          conversationId = event.conversationId;
        }

        reply.raw.write(frame(event));
      }
    } catch (error) {
      // Nothing may escape a hijacked reply: the exception filter has no response to write to, so
      // the turn ends as a frame the page can render instead of a socket that never closes.
      this.logger.error(`The assistant stream failed: ${String(error)}`);
      reply.raw.write(frame({ type: AI_STREAM_EVENT.ERROR, code: AI_ERROR_CODE.FAILED }));
    } finally {
      running = false;
      clearInterval(heartbeat);
    }

    reply.raw.end();
  }

  @Get("conversations")
  @Roles(...STAFF)
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListConversationsQueryDto,
  ): Promise<Paginated<AiConversation>> {
    return this.conversations.list(actor, query);
  }

  @Get("conversations/:id")
  @Roles(...STAFF)
  messages(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<AiMessage[]> {
    return this.conversations.messages(actor, params.id);
  }

  @Patch("conversations/:id")
  @Roles(...STAFF)
  rename(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: RenameConversationDto,
  ): Promise<AiConversation> {
    return this.conversations.rename(actor, params.id, body.title);
  }

  @Delete("conversations/:id")
  @Roles(...STAFF)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.conversations.softDelete(actor, params.id);
  }
}

const frame = (event: AiStreamEvent): string => `data: ${JSON.stringify(event)}\n\n`;

const HEARTBEAT = ": ping\n\n";
const HEARTBEAT_MS = 15_000;
