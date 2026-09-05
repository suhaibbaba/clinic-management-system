import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import {
  listOverdueQuerySchema,
  patientIdParamSchema,
  statementQuerySchema,
  USER_ROLE,
  type ListOverdueQuery,
  type OverduePatient,
  type Paginated,
  type PatientBalance,
  type Statement,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { DocumentsService } from '@api/billing/documents.service';
import { LedgerService } from '@api/billing/ledger.service';
import { OverdueService } from '@api/billing/overdue.service';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { PatientAccessService } from '@api/patients/patient-access.service';

class PatientIdParamDto extends createZodDto(patientIdParamSchema) {}
class StatementQueryDto extends createZodDto(statementQuerySchema) {}
class ListOverdueQueryDto extends createZodDto(listOverdueQuerySchema) {}

/**
 * A patient's money: balance and statement (ROLES.md billing matrix — admin,
 * doctor and receptionist read; technician never, because "technician responses
 * must never include financial patient data").
 *
 * A statement carries the procedure's catalog name and nothing else, so a
 * receptionist reading one still never sees a diagnosis or a visit note.
 */
@Controller('patients/:patientId')
@Roles(USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST)
export class PatientBillingController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly documents: DocumentsService,
    private readonly patientAccess: PatientAccessService,
  ) {}

  @Get('balance')
  async balance(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: PatientIdParamDto,
  ): Promise<PatientBalance> {
    await this.patientAccess.requirePatientId(actor, params.patientId);

    return this.ledger.balanceFor(actor.clinicId, params.patientId);
  }

  @Get('statement')
  async statement(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: PatientIdParamDto,
    @Query() query: StatementQueryDto,
  ): Promise<Statement> {
    await this.patientAccess.requirePatientId(actor, params.patientId);

    return this.ledger.statementFor(actor.clinicId, params.patientId, query);
  }

  @Get('statement.pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'inline; filename="statement.pdf"')
  statementPdf(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: PatientIdParamDto,
    @Query() query: StatementQueryDto,
  ): Promise<Buffer> {
    return this.documents.statement(actor, params.patientId, query);
  }
}

/** Overdue balances (ROLES.md: admin and receptionist read; nobody else). */
@Controller('billing')
export class BillingController {
  constructor(private readonly overdue: OverdueService) {}

  @Get('overdue')
  @Roles(USER_ROLE.RECEPTIONIST)
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListOverdueQueryDto,
  ): Promise<Paginated<OverduePatient>> {
    return this.overdue.list(actor.clinicId, query satisfies ListOverdueQuery);
  }
}
