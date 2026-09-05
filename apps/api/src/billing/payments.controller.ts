import { Body, Controller, Delete, Get, Header, Param, Post, Query } from '@nestjs/common';
import {
  AUDIT_ACTION,
  createPaymentSchema,
  idParamSchema,
  listPaymentsQuerySchema,
  reversePaymentSchema,
  USER_ROLE,
  type Paginated,
  type Payment,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { DocumentsService } from '@api/billing/documents.service';
import { PAYMENTS_ENTITY, PaymentsService } from '@api/billing/payments.service';
import { Audit } from '@api/common/decorators/audit.decorator';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';

class CreatePaymentDto extends createZodDto(createPaymentSchema) {}
class ReversePaymentDto extends createZodDto(reversePaymentSchema) {}
class ListPaymentsQueryDto extends createZodDto(listPaymentsQuerySchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}

/**
 * Payments & receipts (ROLES.md billing matrix): admin CRUD, doctor read,
 * receptionist create and read, technician nothing.
 *
 * There is no update route, for any role: an amount that has been receipted is
 * never edited. The matrix's delete cell is `POST :id/reverse` — the only way
 * to unmake a payment is the opposite entry, which leaves both the receipt and
 * its cancellation on the statement (CLAUDE.md architecture decision 2).
 */
@Controller('payments')
@Roles(USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST)
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly documents: DocumentsService,
  ) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListPaymentsQueryDto,
  ): Promise<Paginated<Payment>> {
    return this.payments.list(actor, query);
  }

  @Get(':id')
  findOne(@CurrentUser() actor: AuthenticatedUser, @Param() params: IdParamDto): Promise<Payment> {
    return this.payments.findOne(actor, params.id);
  }

  /** Every payment has a printable receipt, reprintable from the ledger. */
  @Get(':id/receipt')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'inline; filename="receipt.pdf"')
  receipt(@CurrentUser() actor: AuthenticatedUser, @Param() params: IdParamDto): Promise<Buffer> {
    return this.documents.receipt(actor, params.id);
  }

  @Post()
  @Roles(USER_ROLE.RECEPTIONIST)
  @Audit(PAYMENTS_ENTITY, AUDIT_ACTION.CREATE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreatePaymentDto,
  ): Promise<Payment> {
    return this.payments.create(actor, body);
  }

  /**
   * Admin only. Writes the opposite entry and returns it — the original row is
   * left exactly as it was receipted.
   */
  @Post(':id/reverse')
  @Roles(USER_ROLE.ADMIN)
  @Audit(PAYMENTS_ENTITY, AUDIT_ACTION.UPDATE)
  reverse(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: ReversePaymentDto,
  ): Promise<Payment> {
    return this.payments.reverse(actor, params.id, body);
  }

  /** The matrix's delete cell, and the same reversal — nothing is removed. */
  @Delete(':id')
  @Roles(USER_ROLE.ADMIN)
  @Audit(PAYMENTS_ENTITY, AUDIT_ACTION.DELETE)
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: ReversePaymentDto,
  ): Promise<Payment> {
    return this.payments.reverse(actor, params.id, body);
  }
}
