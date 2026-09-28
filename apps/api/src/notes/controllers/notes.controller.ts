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
import { AUDIT_ACTION, USER_ROLE, type ClinicNote, type Paginated } from "@clinic/shared";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { CLINIC_NOTES_ENTITY } from "@api/notes/constants";
import { NotesService } from "@api/notes/services/notes.service";
import {
  ListNotesQueryDto,
  CreateNoteDto,
  IdParamDto,
  UpdateNoteDto,
} from "@api/notes/dto/notes.dto";

@Controller("notes")
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN, USER_ROLE.RECEPTIONIST)
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListNotesQueryDto,
  ): Promise<Paginated<ClinicNote>> {
    return this.notes.list(actor, query);
  }

  @Post()
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN, USER_ROLE.RECEPTIONIST)
  @Audit(CLINIC_NOTES_ENTITY, AUDIT_ACTION.CREATE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateNoteDto,
  ): Promise<ClinicNote> {
    return this.notes.create(actor, body);
  }

  @Patch(":id")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN, USER_ROLE.RECEPTIONIST)
  @Audit(CLINIC_NOTES_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateNoteDto,
  ): Promise<ClinicNote> {
    return this.notes.update(actor, params.id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN, USER_ROLE.RECEPTIONIST)
  @Audit(CLINIC_NOTES_ENTITY, AUDIT_ACTION.DELETE)
  remove(@CurrentUser() actor: AuthenticatedUser, @Param() params: IdParamDto): Promise<void> {
    return this.notes.remove(actor, params.id);
  }
}
