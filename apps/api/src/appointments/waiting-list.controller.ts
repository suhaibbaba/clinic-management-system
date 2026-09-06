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
} from '@nestjs/common';
import {
  AUDIT_ACTION,
  createWaitingListEntrySchema,
  idParamSchema,
  listWaitingListQuerySchema,
  promoteWaitingListEntrySchema,
  updateWaitingListEntrySchema,
  USER_ROLE,
  type Paginated,
  type WaitingListEntry,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { WAITING_LIST_ENTITY, WaitingListService } from '@api/appointments/waiting-list.service';
import { Audit } from '@api/common/decorators/audit.decorator';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';

class CreateWaitingListEntryDto extends createZodDto(createWaitingListEntrySchema) {}
class UpdateWaitingListEntryDto extends createZodDto(updateWaitingListEntrySchema) {}
class PromoteWaitingListEntryDto extends createZodDto(promoteWaitingListEntrySchema) {}
class ListWaitingListQueryDto extends createZodDto(listWaitingListQuerySchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}

/**
 * The waiting list (ROLES.md appointments matrix): `CRUD` for admin and
 * receptionist, `R` for a doctor, nothing for a technician.
 *
 * A doctor reads it because they need to know who is waiting; adding and
 * promoting is the front desk's job, which is why the write routes name only
 * the receptionist (admin passes every role check).
 */
@Controller('waiting-list')
@Roles(USER_ROLE.RECEPTIONIST, USER_ROLE.DOCTOR)
export class WaitingListController {
  constructor(private readonly waitingList: WaitingListService) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListWaitingListQueryDto,
  ): Promise<Paginated<WaitingListEntry>> {
    return this.waitingList.list(actor, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<WaitingListEntry> {
    return this.waitingList.findOne(actor, params.id);
  }

  @Post()
  @Roles(USER_ROLE.RECEPTIONIST)
  @Audit(WAITING_LIST_ENTITY, AUDIT_ACTION.CREATE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateWaitingListEntryDto,
  ): Promise<WaitingListEntry> {
    return this.waitingList.create(actor, body);
  }

  @Patch(':id')
  @Roles(USER_ROLE.RECEPTIONIST)
  @Audit(WAITING_LIST_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateWaitingListEntryDto,
  ): Promise<WaitingListEntry> {
    return this.waitingList.update(actor, params.id, body);
  }

  /** Books the waiting patient into a slot and closes the entry. */
  @Post(':id/promote')
  @Roles(USER_ROLE.RECEPTIONIST)
  @Audit(WAITING_LIST_ENTITY, AUDIT_ACTION.UPDATE)
  promote(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: PromoteWaitingListEntryDto,
  ): Promise<WaitingListEntry> {
    return this.waitingList.promote(actor, params.id, body);
  }

  /** Closes an entry without booking it — the patient gave up, or was seen. */
  @Patch(':id/resolve')
  @Roles(USER_ROLE.RECEPTIONIST)
  @Audit(WAITING_LIST_ENTITY, AUDIT_ACTION.UPDATE)
  resolve(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<WaitingListEntry> {
    return this.waitingList.resolve(actor, params.id);
  }

  @Delete(':id')
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
