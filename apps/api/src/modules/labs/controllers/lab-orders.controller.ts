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
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { SendDocumentDto } from "@api/modules/notifications/dto/document-delivery.dto";
import { DocumentDeliveryService } from "@api/modules/notifications/services/document-delivery.service";
import {
  AUDIT_ACTION,
  LAB_ORDER_STATUS,
  USER_ROLE,
  type LabOrderAttachment,
  type LabOrderRow,
  type Paginated,
  type PresignAttachmentUploadResponse,
  type LabOrderStageCounts,
} from "@clinic/shared";
import { Audit } from "@api/common/decorators/audit.decorator";
import { Capability } from "@api/common/decorators/capability.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { LabDocumentsService } from "@api/modules/labs/services/lab-documents.service";
import { LabOrderAttachmentsService } from "@api/modules/labs/services/lab-order-attachments.service";
import { LAB_ORDERS_ENTITY } from "@api/common/constants/audit-entities";
import { LabOrdersService } from "@api/modules/labs/services/lab-orders.service";
import { AiTool } from "@api/modules/ai/tools/route-tool.decorator";
import {
  ListLabOrdersQueryDto,
  StageCountsQueryDto,
  IdParamDto,
  CreateLabOrderDto,
  UpdateLabOrderDto,
  ReturnLabOrderDto,
  CancelLabOrderDto,
  PresignDto,
  ConfirmDto,
  AttachmentParamsDto,
} from "@api/modules/labs/dto/lab-orders.dto";

@Controller("lab-orders")
export class LabOrdersController {
  constructor(
    private readonly orders: LabOrdersService,
    private readonly attachments: LabOrderAttachmentsService,
    private readonly documents: LabDocumentsService,
    private readonly delivery: DocumentDeliveryService,
  ) {}

  @AiTool({
    group: "labs",
    description:
      "Lab orders, filtered by status, patient, lab, doctor or a search. Use to find the order to move along. For overdue ones use get_overdue_lab_orders.",
  })
  @Get()
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListLabOrdersQueryDto,
  ): Promise<Paginated<LabOrderRow>> {
    return this.orders.list(actor, query);
  }

  @Get("stages")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  stages(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: StageCountsQueryDto,
  ): Promise<LabOrderStageCounts> {
    return this.orders.stageCounts(actor, query);
  }

  @Get("overdue")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  overdue(@CurrentUser() actor: AuthenticatedUser): Promise<LabOrderRow[]> {
    return this.orders.overdue(actor);
  }

  @AiTool({
    group: "labs",
    description: "One lab order in full: work type, teeth, shade, dates, price, status.",
  })
  @Get(":id")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<LabOrderRow> {
    return this.orders.findOne(actor, params.id);
  }

  @Get(":id/print")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  @Header("Content-Type", "application/pdf")
  @Header("Content-Disposition", 'inline; filename="lab-order.pdf"')
  print(@CurrentUser() actor: AuthenticatedUser, @Param() params: IdParamDto): Promise<Buffer> {
    return this.documents.orderSheet(actor, params.id);
  }

  @Post(":id/print/whatsapp")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async sendSheet(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: SendDocumentDto,
  ): Promise<void> {
    await this.delivery.send({
      clinicId: actor.clinicId,
      to: body.to,
      kind: "labOrder",
      pdf: await this.documents.orderSheet(actor, params.id),
    });
  }

  @AiTool({
    group: "labs",
    description:
      "Order work from a lab for a patient: lab, work type, teeth (FDI), shade, instructions as dictated. Its steps afterwards are set_lab_order_status. Waits on a card.",
  })
  @Post()
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  @Audit(LAB_ORDERS_ENTITY, AUDIT_ACTION.CREATE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateLabOrderDto,
  ): Promise<LabOrderRow> {
    return this.orders.create(actor, body);
  }

  @AiTool({
    group: "labs",
    description: "Correct a lab order's details before it is sent. Waits on a card.",
  })
  @Patch(":id")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  @Audit(LAB_ORDERS_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateLabOrderDto,
  ): Promise<LabOrderRow> {
    return this.orders.update(actor, params.id, body);
  }

  @Patch(":id/send")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  @Audit(LAB_ORDERS_ENTITY, AUDIT_ACTION.UPDATE)
  send(@CurrentUser() actor: AuthenticatedUser, @Param() params: IdParamDto): Promise<LabOrderRow> {
    return this.orders.changeStatus(actor, params.id, LAB_ORDER_STATUS.SENT);
  }

  @Patch(":id/ready")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  @Audit(LAB_ORDERS_ENTITY, AUDIT_ACTION.UPDATE)
  ready(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<LabOrderRow> {
    return this.orders.changeStatus(actor, params.id, LAB_ORDER_STATUS.READY);
  }

  @Patch(":id/receive")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  @Audit(LAB_ORDERS_ENTITY, AUDIT_ACTION.UPDATE)
  receive(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<LabOrderRow> {
    return this.orders.changeStatus(actor, params.id, LAB_ORDER_STATUS.RECEIVED);
  }

  @Patch(":id/fit")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  @Audit(LAB_ORDERS_ENTITY, AUDIT_ACTION.UPDATE)
  fit(@CurrentUser() actor: AuthenticatedUser, @Param() params: IdParamDto): Promise<LabOrderRow> {
    return this.orders.changeStatus(actor, params.id, LAB_ORDER_STATUS.FITTED);
  }

  @Patch(":id/return")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  @Audit(LAB_ORDERS_ENTITY, AUDIT_ACTION.UPDATE)
  return(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: ReturnLabOrderDto,
  ): Promise<LabOrderRow> {
    return this.orders.changeStatus(actor, params.id, LAB_ORDER_STATUS.RETURNED, body);
  }

  @Patch(":id/cancel")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  @Audit(LAB_ORDERS_ENTITY, AUDIT_ACTION.UPDATE)
  cancel(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: CancelLabOrderDto,
  ): Promise<LabOrderRow> {
    return this.orders.changeStatus(actor, params.id, LAB_ORDER_STATUS.CANCELLED, body);
  }

  @AiTool({
    group: "labs",
    description: "Archive a lab order recorded by mistake. Waits on a typed confirmation.",
  })
  @Delete(":id")
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(LAB_ORDERS_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.orders.softDelete(actor, params.id);
  }

  @Get(":id/attachments")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  listAttachments(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<LabOrderAttachment[]> {
    return this.attachments.list(actor, params.id);
  }

  @Post(":id/attachments/presign")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  presign(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: PresignDto,
  ): Promise<PresignAttachmentUploadResponse> {
    return this.attachments.presign(actor, params.id, body);
  }

  @Post(":id/attachments")
  @Capability("lab-orders.confirmAttachment")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  confirm(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: ConfirmDto,
  ): Promise<LabOrderAttachment> {
    return this.attachments.confirm(actor, params.id, body);
  }

  @Delete(":id/attachments/:attachmentId")
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeAttachment(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: AttachmentParamsDto,
  ): Promise<void> {
    await this.attachments.softDelete(actor, params.id, params.attachmentId);
  }
}
