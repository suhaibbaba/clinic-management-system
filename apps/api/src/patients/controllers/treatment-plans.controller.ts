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
  USER_ROLE,
  type Paginated,
  type PerformedProcedure,
  type TreatmentPlan,
  type TreatmentPlanItem,
  AI_RISK_TIER,
} from "@clinic/shared";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { PERFORMED_PROCEDURES_ENTITY } from "@api/patients/constants";
import { TREATMENT_PLAN_ITEMS_ENTITY, TREATMENT_PLANS_ENTITY } from "@api/patients/constants";
import { TreatmentPlansService } from "@api/patients/services/treatment-plans.service";
import { AiTool } from "@api/ai/tools/route-tool.decorator";
import {
  ListTreatmentPlansQueryDto,
  IdParamDto,
  CreateTreatmentPlanDto,
  UpdateTreatmentPlanDto,
  CreatePlanItemDto,
  UpdatePlanItemDto,
  ConvertPlanItemDto,
} from "@api/patients/dto/treatment-plans.dto";

@Controller("treatment-plans")
@Roles(USER_ROLE.DOCTOR, USER_ROLE.VISITING_DOCTOR)
export class TreatmentPlansController {
  constructor(private readonly plans: TreatmentPlansService) {}

  @AiTool({
    group: "patients",
    description: "Treatment plans, filtered by patient or status. Clinical.",
  })
  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListTreatmentPlansQueryDto,
  ): Promise<Paginated<TreatmentPlan>> {
    return this.plans.list(actor, query);
  }

  @AiTool({
    group: "patients",
    description: "One treatment plan with its items and totals. Clinical.",
  })
  @Get(":id")
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<TreatmentPlan> {
    return this.plans.findOne(actor, params.id);
  }

  @AiTool({
    group: "patients",
    description: "Start a treatment plan for a patient. Waits on a card.",
  })
  @Post()
  @Audit(TREATMENT_PLANS_ENTITY, AUDIT_ACTION.CREATE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateTreatmentPlanDto,
  ): Promise<TreatmentPlan> {
    return this.plans.create(actor, body);
  }

  @AiTool({
    group: "patients",
    description: "Change a treatment plan's title, status or notes. Waits on a card.",
  })
  @Patch(":id")
  @Audit(TREATMENT_PLANS_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateTreatmentPlanDto,
  ): Promise<TreatmentPlan> {
    return this.plans.update(actor, params.id, body);
  }

  @AiTool({
    group: "patients",
    description: "Archive a treatment plan. Waits on a typed confirmation.",
  })
  @Delete(":id")
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(TREATMENT_PLANS_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.plans.softDelete(actor, params.id);
  }

  @AiTool({
    group: "patients",
    description: "Add a planned procedure to a treatment plan. Waits on a card.",
  })
  @Post(":id/items")
  @Audit(TREATMENT_PLAN_ITEMS_ENTITY, AUDIT_ACTION.CREATE, { entityIdSource: "response" })
  addItem(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: CreatePlanItemDto,
  ): Promise<TreatmentPlanItem> {
    return this.plans.addItem(actor, params.id, body);
  }
}

@Controller("plan-items")
@Roles(USER_ROLE.DOCTOR, USER_ROLE.VISITING_DOCTOR)
export class PlanItemsController {
  constructor(private readonly plans: TreatmentPlansService) {}

  @AiTool({
    group: "patients",
    description: "Change a planned item — its tooth, price or order. Waits on a card.",
  })
  @Patch(":id")
  @Audit(TREATMENT_PLAN_ITEMS_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdatePlanItemDto,
  ): Promise<TreatmentPlanItem> {
    return this.plans.updateItem(actor, params.id, body);
  }

  @AiTool({
    group: "patients",
    description: "Remove a planned item from its plan. Waits on a typed confirmation.",
  })
  @Delete(":id")
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(TREATMENT_PLAN_ITEMS_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.plans.softDeleteItem(actor, params.id);
  }

  @AiTool({
    group: "patients",
    description:
      "Turn a planned item into a performed treatment, with its charge. Waits on a typed confirmation.",
    risk: AI_RISK_TIER.TYPED,
  })
  @Post(":id/convert")
  @Audit(PERFORMED_PROCEDURES_ENTITY, AUDIT_ACTION.CREATE, { entityIdSource: "response" })
  convert(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: ConvertPlanItemDto,
  ): Promise<PerformedProcedure> {
    return this.plans.convertItem(actor, params.id, body);
  }
}
