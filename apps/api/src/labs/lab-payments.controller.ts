import { Body, Controller, Get, Header, Param, Patch, Post, Query } from '@nestjs/common';
import {
  AUDIT_ACTION,
  createLabPaymentSchema,
  idParamSchema,
  paginationQuerySchema,
  reverseLabPaymentSchema,
  statementQuerySchema,
  USER_ROLE,
  type LabBalance,
  type LabPayment,
  type LabStatement,
  type Paginated,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { Audit } from '@api/common/decorators/audit.decorator';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { LabDocumentsService } from '@api/labs/lab-documents.service';
import { LabLedgerService } from '@api/labs/lab-ledger.service';
import { LAB_PAYMENTS_ENTITY, LabPaymentsService } from '@api/labs/lab-payments.service';

class CreateLabPaymentDto extends createZodDto(createLabPaymentSchema) {}
class ReverseLabPaymentDto extends createZodDto(reverseLabPaymentSchema) {}
class StatementQueryDto extends createZodDto(statementQuerySchema) {}
class PaginationQueryDto extends createZodDto(paginationQuerySchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}
class LabIdParamDto extends createZodDto(z.object({ labId: z.uuid() })) {}

/**
 * The lab ledger: what the clinic owes, what it has paid, and the statement
 * the two sides settle against.
 *
 * ROLES.md: balances and statements are read by admin, doctor and technician;
 * payments are created by technician and admin; **reversal is admin-only**,
 * because it is the one operation that makes money appear to come back.
 * A receptionist appears nowhere in the labs matrix and so appears nowhere
 * here.
 *
 * The balance rule — an order counts from `sent` and stops counting only if
 * cancelled — lives in `LabLedgerService`, and every number below comes from
 * it rather than from a second copy of the arithmetic.
 */
@Controller('labs/:labId')
export class LabLedgerController {
  constructor(
    private readonly ledger: LabLedgerService,
    private readonly payments: LabPaymentsService,
    private readonly documents: LabDocumentsService,
  ) {}

  @Get('balance')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  balance(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: LabIdParamDto,
  ): Promise<LabBalance> {
    return this.ledger.balanceFor(actor.clinicId, params.labId);
  }

  @Get('statement')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  statement(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: LabIdParamDto,
    @Query() query: StatementQueryDto,
  ): Promise<LabStatement> {
    return this.ledger.statementFor(actor.clinicId, params.labId, query);
  }

  @Get('statement.pdf')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'inline; filename="lab-statement.pdf"')
  statementPdf(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: LabIdParamDto,
    @Query() query: StatementQueryDto,
  ): Promise<Buffer> {
    return this.documents.statement(actor, params.labId, query);
  }

  @Get('payments')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  listPayments(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: LabIdParamDto,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<LabPayment>> {
    return this.payments.list(actor, params.labId, query);
  }
}

/**
 * Writing to the lab ledger, kept on its own path so the role rules read as
 * one list rather than being scattered through the lab's other routes.
 */
@Controller('lab-payments')
export class LabPaymentsController {
  constructor(private readonly payments: LabPaymentsService) {}

  @Post()
  @Roles(USER_ROLE.TECHNICIAN)
  @Audit(LAB_PAYMENTS_ENTITY, AUDIT_ACTION.CREATE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateLabPaymentDto,
  ): Promise<LabPayment> {
    return this.payments.create(actor, body);
  }

  /**
   * Admin only, and it writes the opposite entry rather than touching the
   * original — the ledger is append-only (CLAUDE.md).
   */
  @Patch(':id/reverse')
  @Roles(USER_ROLE.ADMIN)
  @Audit(LAB_PAYMENTS_ENTITY, AUDIT_ACTION.UPDATE)
  reverse(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: ReverseLabPaymentDto,
  ): Promise<LabPayment> {
    return this.payments.reverse(actor, params.id, body);
  }
}
