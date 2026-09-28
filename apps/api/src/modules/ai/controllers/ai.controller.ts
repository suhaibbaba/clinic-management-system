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
import { type FastifyReply } from "fastify";
import {
  AI_ERROR_CODE,
  AI_STREAM_EVENT,
  type AiConversation,
  type AiMessage,
  type Paginated,
} from "@clinic/shared";
import { AgentService } from "@api/modules/ai/services/agent.service";
import { AiBudgetService } from "@api/modules/ai/services/ai-budget.service";
import { AiLimitError } from "@api/modules/ai/lib/ai-budget";
import { AiConversationsService } from "@api/modules/ai/services/ai-conversations.service";
import { Capability } from "@api/common/decorators/capability.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { STAFF, HEARTBEAT, HEARTBEAT_MS } from "@api/modules/ai/constants";
import {
  ChatDto,
  ListConversationsQueryDto,
  IdParamDto,
  RenameConversationDto,
} from "@api/modules/ai/dto/ai.dto";
import { frame } from "@api/modules/ai/lib/ai";

@Controller("ai")
export class AiController {
  private readonly logger = new Logger("Assistant");

  constructor(
    private readonly agent: AgentService,
    private readonly budget: AiBudgetService,
    private readonly conversations: AiConversationsService,
  ) {}

  @Post("chat")
  @Roles(...STAFF)
  @Capability("ai.chat")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async chat(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: ChatDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
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
      "x-accel-buffering": "no",
    });

    let running = true;
    let conversationId = body.conversationId;

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
        if (reply.raw.destroyed) {
          return;
        }

        if (event.type === AI_STREAM_EVENT.CONVERSATION) {
          conversationId = event.conversationId;
        }

        reply.raw.write(frame(event));
      }
    } catch (error) {
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
