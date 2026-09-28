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
import { AUDIT_ACTION, USER_ROLE, type Paginated } from "@clinic/shared";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { PROCEDURE_CATALOG_ENTITY } from "@api/modules/patients/constants";
import { ProcedureCatalogService } from "@api/modules/patients/services/procedure-catalog.service";
import { type CatalogView } from "@api/modules/patients/lib/procedure-catalog";
import { AiTool } from "@api/modules/ai/tools/route-tool.decorator";
import {
  ListCatalogQueryDto,
  IdParamDto,
  CreateCatalogItemDto,
  UpdateCatalogItemDto,
} from "@api/modules/patients/dto/procedure-catalog.dto";

@Controller("procedure-catalog")
export class ProcedureCatalogController {
  constructor(private readonly catalog: ProcedureCatalogService) {}

  @AiTool({
    group: "patients",
    description:
      "The clinic's procedure catalogue with default prices. Use to find a procedureId before recording a treatment.",
  })
  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListCatalogQueryDto,
  ): Promise<Paginated<CatalogView>> {
    return this.catalog.list(actor, query);
  }

  @AiTool({
    group: "patients",
    description: "One catalogue procedure and its price.",
  })
  @Get(":id")
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<CatalogView> {
    return this.catalog.findOne(actor, params.id);
  }

  @AiTool({
    group: "patients",
    description: "Add a procedure to the catalogue with its price. Waits on a card.",
  })
  @Post()
  @Roles(USER_ROLE.ADMIN)
  @Audit(PROCEDURE_CATALOG_ENTITY, AUDIT_ACTION.CREATE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateCatalogItemDto,
  ): Promise<CatalogView> {
    return this.catalog.create(actor, body);
  }

  @AiTool({
    group: "patients",
    description: "Change a catalogue procedure's name or default price. Waits on a card.",
  })
  @Patch(":id")
  @Roles(USER_ROLE.ADMIN)
  @Audit(PROCEDURE_CATALOG_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateCatalogItemDto,
  ): Promise<CatalogView> {
    return this.catalog.update(actor, params.id, body);
  }

  @AiTool({
    group: "patients",
    description: "Retire a catalogue procedure. Waits on a typed confirmation.",
  })
  @Delete(":id")
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(PROCEDURE_CATALOG_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.catalog.softDelete(actor, params.id);
  }
}
