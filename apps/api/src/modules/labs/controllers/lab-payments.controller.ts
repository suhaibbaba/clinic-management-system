import { Body, Controller, Get, Header, Param, Patch, Post, Query } from "@nestjs/common";
import {
  AUDIT_ACTION,
  USER_ROLE,
  type LabBalance,
  type LabPayment,
  type LabStatement,
  type Paginated,
} from "@clinic/shared";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { LabDocumentsService } from "@api/modules/labs/services/lab-documents.service";
import { LabLedgerService } from "@api/modules/labs/services/lab-ledger.service";
import { LAB_PAYMENTS_ENTITY } from "@api/modules/labs/constants";
import { LabPaymentsService } from "@api/modules/labs/services/lab-payments.service";
import { AiTool } from "@api/modules/ai/tools/route-tool.decorator";
import {
  LabIdParamDto,
  StatementQueryDto,
  PaginationQueryDto,
  CreateLabPaymentDto,
  IdParamDto,
  ReverseLabPaymentDto,
} from "@api/modules/labs/dto/lab-payments.dto";

@Controller("labs/:labId")
export class LabLedgerController {
  constructor(
    private readonly ledger: LabLedgerService,
    private readonly payments: LabPaymentsService,
    private readonly documents: LabDocumentsService,
  ) {}

  @AiTool({
    group: "labs",
    description: "What the clinic owes one lab: owed, paid, balance, computed from the ledger.",
  })
  @Get("balance")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  balance(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: LabIdParamDto,
  ): Promise<LabBalance> {
    return this.ledger.balanceFor(actor.clinicId, params.labId);
  }

  @AiTool({
    group: "labs",
    description: "One lab's statement over dates: every order owed and payment made, in order.",
  })
  @Get("statement")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  statement(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: LabIdParamDto,
    @Query() query: StatementQueryDto,
  ): Promise<LabStatement> {
    return this.ledger.statementFor(actor.clinicId, params.labId, query);
  }

  @Get("statement.pdf")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  @Header("Content-Type", "application/pdf")
  @Header("Content-Disposition", 'inline; filename="lab-statement.pdf"')
  statementPdf(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: LabIdParamDto,
    @Query() query: StatementQueryDto,
  ): Promise<Buffer> {
    return this.documents.statement(actor, params.labId, query);
  }

  @AiTool({
    group: "labs",
    description:
      "What the clinic paid one lab, newest first; a row with reversesId is a reversal. Use to find the lab payment to reverse.",
  })
  @Get("payments")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  listPayments(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: LabIdParamDto,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<LabPayment>> {
    return this.payments.list(actor, params.labId, query);
  }
}

@Controller("lab-payments")
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

  @Patch(":id/reverse")
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
