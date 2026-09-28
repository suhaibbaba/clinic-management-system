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
import { AUDIT_ACTION, USER_ROLE, type LookupBundle, type LookupOption } from "@clinic/shared";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { LOOKUP_OPTIONS_ENTITY } from "@api/common/constants/audit-entities";
import { LookupsService } from "@api/modules/lookups/services/lookups.service";
import {
  ListLookupsQueryDto,
  CreateLookupDto,
  ReorderLookupsDto,
  IdParamDto,
  UpdateLookupDto,
} from "@api/modules/lookups/dto/lookups.dto";

@Controller("lookups")
export class LookupsController {
  constructor(private readonly lookups: LookupsService) {}

  @Get()
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN, USER_ROLE.RECEPTIONIST)
  bundle(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListLookupsQueryDto,
  ): Promise<LookupBundle> {
    return this.lookups.bundle(actor, query);
  }

  @Post()
  @Roles(USER_ROLE.ADMIN)
  @Audit(LOOKUP_OPTIONS_ENTITY, AUDIT_ACTION.CREATE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateLookupDto,
  ): Promise<LookupOption> {
    return this.lookups.create(actor, body);
  }

  @Patch("reorder")
  @Roles(USER_ROLE.ADMIN)
  @Audit(LOOKUP_OPTIONS_ENTITY, AUDIT_ACTION.UPDATE)
  reorder(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: ReorderLookupsDto,
  ): Promise<LookupOption[]> {
    return this.lookups.reorder(actor, body);
  }

  @Patch(":id")
  @Roles(USER_ROLE.ADMIN)
  @Audit(LOOKUP_OPTIONS_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateLookupDto,
  ): Promise<LookupOption> {
    return this.lookups.update(actor, params.id, body);
  }

  @Delete(":id")
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(LOOKUP_OPTIONS_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.lookups.remove(actor, params.id);
  }
}
