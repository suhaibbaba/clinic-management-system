import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  AUDIT_ACTION,
  confirmLabAttachmentSchema,
  createLabOrderSchema,
  idParamSchema,
  LAB_ORDER_STATUS,
  listLabOrdersQuerySchema,
  presignLabAttachmentSchema,
  returnLabOrderSchema,
  updateLabOrderSchema,
  USER_ROLE,
  type LabOrderAttachment,
  type LabOrderRow,
  type Paginated,
  type PresignAttachmentUploadResponse,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { Audit } from '@api/common/decorators/audit.decorator';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { LabDocumentsService } from '@api/labs/lab-documents.service';
import { LabOrderAttachmentsService } from '@api/labs/lab-order-attachments.service';
import { LAB_ORDERS_ENTITY, LabOrdersService } from '@api/labs/lab-orders.service';

class CreateLabOrderDto extends createZodDto(createLabOrderSchema) {}
class UpdateLabOrderDto extends createZodDto(updateLabOrderSchema) {}
class ListLabOrdersQueryDto extends createZodDto(listLabOrdersQuerySchema) {}
class ReturnLabOrderDto extends createZodDto(returnLabOrderSchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}

class PresignDto extends createZodDto(presignLabAttachmentSchema) {}
class ConfirmDto extends createZodDto(confirmLabAttachmentSchema) {}

class AttachmentParamsDto extends createZodDto(
  z.object({ id: z.uuid(), attachmentId: z.uuid() }),
) {}

/**
 * Lab orders (ROLES.md labs matrix).
 *
 * Every route here is closed to a receptionist — the matrix gives them nothing
 * in this module, so they are simply never listed and every call is a 403.
 *
 * The transitions are one endpoint per act rather than a `status` field on the
 * update: they are what people *do* — send it, it's ready, it came back, it
 * fits — and naming them that way is what makes both the audit trail and the
 * role table below readable. Who may make each move is settled in the service,
 * against the same table this file is documented from.
 */
@Controller('lab-orders')
export class LabOrdersController {
  constructor(
    private readonly orders: LabOrdersService,
    private readonly attachments: LabOrderAttachmentsService,
    private readonly documents: LabDocumentsService,
  ) {}

  /* -------------------------------- Reads ------------------------------- */

  @Get()
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListLabOrdersQueryDto,
  ): Promise<Paginated<LabOrderRow>> {
    return this.orders.list(actor, query);
  }

  /** The dashboard's alert: what is late, oldest first. */
  @Get('overdue')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  overdue(@CurrentUser() actor: AuthenticatedUser): Promise<LabOrderRow[]> {
    return this.orders.overdue(actor);
  }

  @Get(':id')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<LabOrderRow> {
    return this.orders.findOne(actor, params.id);
  }

  /** The sheet that travels with the work. Patient's first name only. */
  @Get(':id/print')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'inline; filename="lab-order.pdf"')
  print(@CurrentUser() actor: AuthenticatedUser, @Param() params: IdParamDto): Promise<Buffer> {
    return this.documents.orderSheet(actor, params.id);
  }

  /* -------------------------------- Writes ------------------------------ */

  @Post()
  @Roles(USER_ROLE.DOCTOR)
  @Audit(LAB_ORDERS_ENTITY, AUDIT_ACTION.CREATE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateLabOrderDto,
  ): Promise<LabOrderRow> {
    return this.orders.create(actor, body);
  }

  @Patch(':id')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  @Audit(LAB_ORDERS_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateLabOrderDto,
  ): Promise<LabOrderRow> {
    return this.orders.update(actor, params.id, body);
  }

  /* ----------------------------- Transitions ---------------------------- */

  /** Out of the door: the sheet is printed and the clinic now owes for it. */
  @Patch(':id/send')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  @Audit(LAB_ORDERS_ENTITY, AUDIT_ACTION.UPDATE)
  send(@CurrentUser() actor: AuthenticatedUser, @Param() params: IdParamDto): Promise<LabOrderRow> {
    return this.orders.changeStatus(actor, params.id, LAB_ORDER_STATUS.SENT);
  }

  /** The lab says it is finished — the technician is the one they ring. */
  @Patch(':id/ready')
  @Roles(USER_ROLE.TECHNICIAN)
  @Audit(LAB_ORDERS_ENTITY, AUDIT_ACTION.UPDATE)
  ready(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<LabOrderRow> {
    return this.orders.changeStatus(actor, params.id, LAB_ORDER_STATUS.READY);
  }

  /** It is in the building. */
  @Patch(':id/receive')
  @Roles(USER_ROLE.TECHNICIAN)
  @Audit(LAB_ORDERS_ENTITY, AUDIT_ACTION.UPDATE)
  receive(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<LabOrderRow> {
    return this.orders.changeStatus(actor, params.id, LAB_ORDER_STATUS.RECEIVED);
  }

  /** It is in the patient's mouth — which only the doctor can say. */
  @Patch(':id/fit')
  @Roles(USER_ROLE.DOCTOR)
  @Audit(LAB_ORDERS_ENTITY, AUDIT_ACTION.UPDATE)
  fit(@CurrentUser() actor: AuthenticatedUser, @Param() params: IdParamDto): Promise<LabOrderRow> {
    return this.orders.changeStatus(actor, params.id, LAB_ORDER_STATUS.FITTED);
  }

  /** Back to the lab, with the reason that goes to them. */
  @Patch(':id/return')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  @Audit(LAB_ORDERS_ENTITY, AUDIT_ACTION.UPDATE)
  return(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: ReturnLabOrderDto,
  ): Promise<LabOrderRow> {
    return this.orders.changeStatus(actor, params.id, LAB_ORDER_STATUS.RETURNED, body.reason);
  }

  /** Only reachable before the lab has started, which is why it is allowed. */
  @Patch(':id/cancel')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  @Audit(LAB_ORDERS_ENTITY, AUDIT_ACTION.UPDATE)
  cancel(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<LabOrderRow> {
    return this.orders.changeStatus(actor, params.id, LAB_ORDER_STATUS.CANCELLED);
  }

  @Delete(':id')
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(LAB_ORDERS_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.orders.softDelete(actor, params.id);
  }

  /* ---------------------------- Attachments ----------------------------- */

  @Get(':id/attachments')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  listAttachments(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<LabOrderAttachment[]> {
    return this.attachments.list(actor, params.id);
  }

  @Post(':id/attachments/presign')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  presign(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: PresignDto,
  ): Promise<PresignAttachmentUploadResponse> {
    return this.attachments.presign(actor, params.id, body);
  }

  @Post(':id/attachments')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  confirm(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: ConfirmDto,
  ): Promise<LabOrderAttachment> {
    return this.attachments.confirm(actor, params.id, body);
  }

  @Delete(':id/attachments/:attachmentId')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeAttachment(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: AttachmentParamsDto,
  ): Promise<void> {
    await this.attachments.softDelete(actor, params.id, params.attachmentId);
  }
}
