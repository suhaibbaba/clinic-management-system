import { Controller, Get, Header, Param, Query } from "@nestjs/common";
import {
  USER_ROLE,
  type ListOverdueQuery,
  type OverduePatient,
  type Paginated,
  type PatientBalance,
  type Statement,
  RULE,
} from "@clinic/shared";
import { DocumentsService } from "@api/modules/billing/services/documents.service";
import { LedgerService } from "@api/modules/billing/services/ledger.service";
import { OverdueService } from "@api/modules/billing/services/overdue.service";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { PatientAccessService } from "@api/modules/patients/services/patient-access.service";
import { AiTool } from "@api/modules/ai/tools/route-tool.decorator";
import {
  PatientIdParamDto,
  StatementQueryDto,
  ListOverdueQueryDto,
} from "@api/modules/billing/dto/billing.dto";
import { PermissionsService } from "@api/modules/permissions/services/permissions.service";

@Controller("patients/:patientId")
@Roles(USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST)
export class PatientBillingController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly documents: DocumentsService,
    private readonly patientAccess: PatientAccessService,
    private readonly permissions: PermissionsService,
  ) {}

  @AiTool({
    group: "billing",
    description:
      "One patient's balance: charged, paid, owed, computed from the ledger. Use get_patient_summary for the whole file.",
  })
  @Get("balance")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN, USER_ROLE.RECEPTIONIST)
  async balance(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: PatientIdParamDto,
  ): Promise<PatientBalance> {
    await this.patientAccess.requirePatientId(actor, params.patientId);

    return this.ledger.balanceFor(actor.clinicId, params.patientId);
  }

  @AiTool({
    group: "billing",
    description: "One patient's statement over dates: every charge and payment, in order.",
  })
  @Get("statement")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN, USER_ROLE.RECEPTIONIST)
  async statement(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: PatientIdParamDto,
    @Query() query: StatementQueryDto,
  ): Promise<Statement> {
    await this.patientAccess.requirePatientId(actor, params.patientId);

    return this.ledger.statementFor(actor.clinicId, params.patientId, query, {
      includeDeleted: await this.permissions.can(actor, RULE.DELETED_PAYMENTS),
    });
  }

  @Get("statement.pdf")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN, USER_ROLE.RECEPTIONIST)
  @Header("Content-Type", "application/pdf")
  @Header("Content-Disposition", 'inline; filename="statement.pdf"')
  statementPdf(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: PatientIdParamDto,
    @Query() query: StatementQueryDto,
  ): Promise<Buffer> {
    return this.documents.statement(actor, params.patientId, query);
  }
}

@Controller("billing")
export class BillingController {
  constructor(private readonly overdue: OverdueService) {}

  @AiTool({
    group: "billing",
    description:
      "Patients with an overdue balance, the largest first. Use for who owes; to message them use draft_bulk_message.",
  })
  @Get("overdue")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN, USER_ROLE.RECEPTIONIST)
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListOverdueQueryDto,
  ): Promise<Paginated<OverduePatient>> {
    return this.overdue.list(actor.clinicId, query satisfies ListOverdueQuery);
  }
}
