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
} from "@nestjs/common";
import {
  AUDIT_ACTION,
  aiActionsSettingsSchema,
  confirmAiProposalSchema,
  idParamSchema,
  USER_ROLE,
  type AiActionsSettings,
  type AiProposal,
  type AiProposalStatusEvent,
} from "@clinic/shared";
import { createZodDto } from "nestjs-zod";
import { ActionRefusal, AiActionsService } from "@api/ai/actions/ai-actions.service";
import { OutboundError } from "@api/ai/outbound/proposals.service";
import { CLINICS_ENTITY } from "@api/clinics/clinics.service";
import { Audit } from "@api/common/decorators/audit.decorator";
import { Capability } from "@api/common/decorators/capability.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";

class IdParamDto extends createZodDto(idParamSchema) {}
class ConfirmDto extends createZodDto(confirmAiProposalSchema) {}
class ActionsSettingsDto extends createZodDto(aiActionsSettingsSchema) {}

const STAFF = [USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN, USER_ROLE.RECEPTIONIST] as const;

// The card's routes for a proposed action. Whoever asked for it confirms it; the domain permission
// the action borrows is asked again inside, at the click, on top of these.
@Controller("ai")
export class AiActionsController {
  constructor(private readonly actions: AiActionsService) {}

  @Get("actions/settings")
  @Roles(USER_ROLE.ADMIN)
  @Capability("ai-actions.settings")
  settings(@CurrentUser() actor: AuthenticatedUser): Promise<AiActionsSettings> {
    return this.actions.settings(actor.clinicId);
  }

  @Put("actions/settings")
  @Roles(USER_ROLE.ADMIN)
  @Capability("ai-actions.update-settings")
  @Audit(CLINICS_ENTITY, AUDIT_ACTION.UPDATE, { entityIdSource: "clinic" })
  updateSettings(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: ActionsSettingsDto,
  ): Promise<AiActionsSettings> {
    return this.actions.updateSettings(actor, body);
  }

  @Get("actions/:id")
  @Roles(...STAFF)
  @Capability("ai-actions.read")
  get(@CurrentUser() actor: AuthenticatedUser, @Param() params: IdParamDto): Promise<AiProposal> {
    return this.actions.get(actor, params.id);
  }

  @Post("proposals/:id/confirm")
  @Roles(...STAFF)
  @Capability("ai-actions.confirm")
  @HttpCode(HttpStatus.OK)
  confirm(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: ConfirmDto,
  ): Promise<AiProposalStatusEvent> {
    return refusals(this.actions.confirm(actor, params.id, body.typedPhrase));
  }

  @Post("actions/:id/cancel")
  @Roles(...STAFF)
  @Capability("ai-actions.cancel")
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<AiProposalStatusEvent> {
    return refusals(this.actions.cancel(actor, params.id));
  }
}

/** A refusal is the code as `message`, which the web resolves to Arabic like every other error. */
async function refusals<T>(pending: Promise<T>): Promise<T> {
  try {
    return await pending;
  } catch (error) {
    if (error instanceof OutboundError || error instanceof ActionRefusal) {
      throw new HttpException(error.code, error.status);
    }

    throw error;
  }
}
