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
  convertPlanItemSchema,
  createTreatmentPlanItemSchema,
  createTreatmentPlanSchema,
  idParamSchema,
  listTreatmentPlansQuerySchema,
  updateTreatmentPlanItemSchema,
  updateTreatmentPlanSchema,
  USER_ROLE,
  type Paginated,
  type PerformedProcedure,
  type TreatmentPlan,
  type TreatmentPlanItem,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { Audit } from '@api/common/decorators/audit.decorator';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { PERFORMED_PROCEDURES_ENTITY } from '@api/patients/procedures.service';
import {
  TREATMENT_PLAN_ITEMS_ENTITY,
  TREATMENT_PLANS_ENTITY,
  TreatmentPlansService,
} from '@api/patients/treatment-plans.service';

class CreateTreatmentPlanDto extends createZodDto(createTreatmentPlanSchema) {}
class UpdateTreatmentPlanDto extends createZodDto(updateTreatmentPlanSchema) {}
class CreatePlanItemDto extends createZodDto(createTreatmentPlanItemSchema) {}
class UpdatePlanItemDto extends createZodDto(updateTreatmentPlanItemSchema) {}
class ConvertPlanItemDto extends createZodDto(convertPlanItemSchema) {}
class ListTreatmentPlansQueryDto extends createZodDto(listTreatmentPlansQuerySchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}

/**
 * Treatment plans (ROLES.md patients matrix): admin CRUD, doctor CRU, and
 * nothing for technician or receptionist.
 */
@Controller('treatment-plans')
@Roles(USER_ROLE.DOCTOR)
export class TreatmentPlansController {
  constructor(private readonly plans: TreatmentPlansService) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListTreatmentPlansQueryDto,
  ): Promise<Paginated<TreatmentPlan>> {
    return this.plans.list(actor, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<TreatmentPlan> {
    return this.plans.findOne(actor, params.id);
  }

  @Post()
  @Audit(TREATMENT_PLANS_ENTITY, AUDIT_ACTION.CREATE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateTreatmentPlanDto,
  ): Promise<TreatmentPlan> {
    return this.plans.create(actor, body);
  }

  @Patch(':id')
  @Audit(TREATMENT_PLANS_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateTreatmentPlanDto,
  ): Promise<TreatmentPlan> {
    return this.plans.update(actor, params.id, body);
  }

  @Delete(':id')
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(TREATMENT_PLANS_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.plans.softDelete(actor, params.id);
  }

  @Post(':id/items')
  @Audit(TREATMENT_PLAN_ITEMS_ENTITY, AUDIT_ACTION.CREATE, { entityIdSource: 'response' })
  addItem(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: CreatePlanItemDto,
  ): Promise<TreatmentPlanItem> {
    return this.plans.addItem(actor, params.id, body);
  }
}

/** Plan items are addressed on their own so a client never has to know the plan. */
@Controller('plan-items')
@Roles(USER_ROLE.DOCTOR)
export class PlanItemsController {
  constructor(private readonly plans: TreatmentPlansService) {}

  @Patch(':id')
  @Audit(TREATMENT_PLAN_ITEMS_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdatePlanItemDto,
  ): Promise<TreatmentPlanItem> {
    return this.plans.updateItem(actor, params.id, body);
  }

  @Delete(':id')
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(TREATMENT_PLAN_ITEMS_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.plans.softDeleteItem(actor, params.id);
  }

  /**
   * Turns the quote into work actually carried out.
   *
   * The row this writes is a performed procedure, not the plan item, so the
   * audit entry is keyed by the response id rather than by `:id`.
   */
  @Post(':id/convert')
  @Audit(PERFORMED_PROCEDURES_ENTITY, AUDIT_ACTION.CREATE, { entityIdSource: 'response' })
  convert(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: ConvertPlanItemDto,
  ): Promise<PerformedProcedure> {
    return this.plans.convertItem(actor, params.id, body);
  }
}
