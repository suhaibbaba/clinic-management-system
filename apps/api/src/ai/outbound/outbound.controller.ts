import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import {
  AUDIT_ACTION,
  aiAutomationSettingsSchema,
  idParamSchema,
  listAiOutboundQuerySchema,
  listAiProposalsQuerySchema,
  USER_ROLE,
  type AiAutomationSettings,
  type AiOutboundLogEntry,
  type AiProposal,
  type AiProposalStatusEvent,
  type Paginated,
} from "@clinic/shared";
import { createZodDto } from "nestjs-zod";
import { AutomationService } from "@api/ai/outbound/automation.service";
import { OutboundLogService } from "@api/ai/outbound/outbound-log.service";
import { OutboundError, ProposalsService } from "@api/ai/outbound/proposals.service";
import { CLINICS_ENTITY } from "@api/clinics/clinics.service";
import { Audit } from "@api/common/decorators/audit.decorator";
import { Capability } from "@api/common/decorators/capability.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";

class IdParamDto extends createZodDto(idParamSchema) {}
class ListProposalsQueryDto extends createZodDto(listAiProposalsQuerySchema) {}
class ListOutboundQueryDto extends createZodDto(listAiOutboundQuerySchema) {}
class AutomationSettingsDto extends createZodDto(aiAutomationSettingsSchema) {}

/** Who ships able to send: the front desk. A clinic moves it in its permission matrix. */
const SENDERS = [USER_ROLE.ADMIN, USER_ROLE.RECEPTIONIST] as const;

@Controller("ai")
export class OutboundController {
  constructor(
    private readonly proposals: ProposalsService,
    private readonly automation: AutomationService,
    private readonly log: OutboundLogService,
  ) {}

  @Get("proposals")
  @Roles(...SENDERS)
  @Capability("ai-outbound.list")
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListProposalsQueryDto,
  ): Promise<Paginated<AiProposal>> {
    return this.proposals.list(actor, query);
  }

  @Get("proposals/:id")
  @Roles(...SENDERS)
  @Capability("ai-outbound.read")
  get(@CurrentUser() actor: AuthenticatedUser, @Param() params: IdParamDto): Promise<AiProposal> {
    return this.proposals.get(actor, params.id);
  }

  // The only way anything is sent. The model has no tool for it: a person presses the card.
  @Post("proposals/:id/send")
  @Roles(...SENDERS)
  @Capability("ai-outbound.send")
  @HttpCode(HttpStatus.OK)
  send(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<AiProposalStatusEvent> {
    return refusals(this.proposals.send(actor, params.id));
  }

  @Post("proposals/:id/cancel")
  @Roles(...SENDERS)
  @Capability("ai-outbound.cancel")
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<AiProposalStatusEvent> {
    return refusals(this.proposals.cancel(actor, params.id));
  }

  @Get("automation/settings")
  @Roles(USER_ROLE.ADMIN)
  @Capability("ai-automation.settings")
  settings(@CurrentUser() actor: AuthenticatedUser): Promise<AiAutomationSettings> {
    return this.automation.settings(actor.clinicId);
  }

  @Put("automation/settings")
  @Roles(USER_ROLE.ADMIN)
  @Capability("ai-automation.update-settings")
  @Audit(CLINICS_ENTITY, AUDIT_ACTION.UPDATE, { entityIdSource: "clinic" })
  updateSettings(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: AutomationSettingsDto,
  ): Promise<AiAutomationSettings> {
    return this.automation.updateSettings(actor, body);
  }

  @Get("outbound")
  @Roles(USER_ROLE.ADMIN)
  @Capability("ai-outbound.audit")
  outbound(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListOutboundQueryDto,
  ): Promise<Paginated<AiOutboundLogEntry>> {
    return this.log.list(actor, query);
  }
}

/** A refusal is the code as `message`, which the web resolves to Arabic like every other error. */
async function refusals<T>(pending: Promise<T>): Promise<T> {
  try {
    return await pending;
  } catch (error) {
    if (error instanceof OutboundError) {
      throw new HttpException(error.code, error.status);
    }

    throw error;
  }
}
