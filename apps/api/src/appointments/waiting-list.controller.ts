import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  AUDIT_ACTION,
  createWaitingListEntrySchema,
  declineWaitingListEntrySchema,
  idParamSchema,
  listWaitingListQuerySchema,
  promoteWaitingListEntrySchema,
  updateWaitingListEntrySchema,
  USER_ROLE,
  type Paginated,
  type WaitingListEntry,
} from "@clinic/shared";
import { createZodDto } from "nestjs-zod";
import { WAITING_LIST_ENTITY, WaitingListService } from "@api/appointments/waiting-list.service";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { AiTool } from "@api/ai/tools/route-tool.decorator";

class CreateWaitingListEntryDto extends createZodDto(createWaitingListEntrySchema) {}
class UpdateWaitingListEntryDto extends createZodDto(updateWaitingListEntrySchema) {}
class PromoteWaitingListEntryDto extends createZodDto(promoteWaitingListEntrySchema) {}
class DeclineWaitingListEntryDto extends createZodDto(declineWaitingListEntrySchema) {}
class ListWaitingListQueryDto extends createZodDto(listWaitingListQuerySchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}

// ROLES.md: CRUD for admin and receptionist, R for a doctor, nothing for a technician — adding and
// promoting is the front desk's job.
@Controller("waiting-list")
@Roles(USER_ROLE.RECEPTIONIST, USER_ROLE.DOCTOR)
export class WaitingListController {
  constructor(private readonly waitingList: WaitingListService) {}

  @AiTool({
    group: "appointments",
    description:
      "The waiting list: patients waiting for a slot, filtered as the query allows. Use to see who could take a freed time. Returns a page of entries.",
  })
  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListWaitingListQueryDto,
  ): Promise<Paginated<WaitingListEntry>> {
    return this.waitingList.list(actor, query);
  }

  @AiTool({
    group: "appointments",
    description:
      "One waiting-list entry by id. Returns the entry with its patient and what they wait for.",
  })
  @Get(":id")
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<WaitingListEntry> {
    return this.waitingList.findOne(actor, params.id);
  }

  @AiTool({
    group: "appointments",
    description:
      "Put a patient on the waiting list for a doctor or any doctor, with what they are waiting for. Not a booking — use create_appointment for that. Waits on a card.",
  })
  @Post()
  @Roles(USER_ROLE.RECEPTIONIST)
  @Audit(WAITING_LIST_ENTITY, AUDIT_ACTION.CREATE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateWaitingListEntryDto,
  ): Promise<WaitingListEntry> {
    return this.waitingList.create(actor, body);
  }

  @AiTool({
    group: "appointments",
    description: "Change a waiting-list entry's preferences or note. Waits on a card.",
  })
  @Patch(":id")
  @Roles(USER_ROLE.RECEPTIONIST)
  @Audit(WAITING_LIST_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateWaitingListEntryDto,
  ): Promise<WaitingListEntry> {
    return this.waitingList.update(actor, params.id, body);
  }

  @AiTool({
    group: "appointments",
    description:
      "Book a waiting-list entry into a real appointment at a free time. Check the time with find_available_slots first. Waits on a card.",
  })
  @Post(":id/promote")
  @Roles(USER_ROLE.RECEPTIONIST)
  @Audit(WAITING_LIST_ENTITY, AUDIT_ACTION.UPDATE)
  promote(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: PromoteWaitingListEntryDto,
  ): Promise<WaitingListEntry> {
    return this.waitingList.promote(actor, params.id, body);
  }

  /** Rang back, nothing decided — the one action that leaves the entry in the queue. */
  @AiTool({
    group: "appointments",
    description: "Record that a waiting-list patient was contacted. Waits on a card.",
  })
  @Patch(":id/contacted")
  @Roles(USER_ROLE.RECEPTIONIST)
  @Audit(WAITING_LIST_ENTITY, AUDIT_ACTION.UPDATE)
  markContacted(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<WaitingListEntry> {
    return this.waitingList.markContacted(actor, params.id);
  }

  @AiTool({
    group: "appointments",
    description: "Record that a waiting-list patient declined the time offered. Waits on a card.",
  })
  @Patch(":id/decline")
  @Roles(USER_ROLE.RECEPTIONIST)
  @Audit(WAITING_LIST_ENTITY, AUDIT_ACTION.UPDATE)
  decline(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: DeclineWaitingListEntryDto,
  ): Promise<WaitingListEntry> {
    return this.waitingList.decline(actor, params.id, body);
  }

  @AiTool({
    group: "appointments",
    description: "Take an entry off the waiting list. Waits on a typed confirmation.",
  })
  @Delete(":id")
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(WAITING_LIST_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.waitingList.softDelete(actor, params.id);
  }
}
