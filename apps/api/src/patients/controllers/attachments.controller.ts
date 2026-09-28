import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import {
  AUDIT_ACTION,
  USER_ROLE,
  type Attachment,
  type Paginated,
  type PresignAttachmentUploadResponse,
} from "@clinic/shared";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { ATTACHMENTS_ENTITY } from "@api/patients/constants";
import { AttachmentsService } from "@api/patients/services/attachments.service";
import {
  PatientIdParamDto,
  ListAttachmentsQueryDto,
  PresignUploadDto,
  ConfirmUploadDto,
  IdParamDto,
} from "@api/patients/dto/attachments.dto";

@Controller("patients/:patientId/attachments")
@Roles(USER_ROLE.DOCTOR, USER_ROLE.VISITING_DOCTOR)
export class PatientAttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: PatientIdParamDto,
    @Query() query: ListAttachmentsQueryDto,
  ): Promise<Paginated<Attachment>> {
    return this.attachments.list(actor, params.patientId, query);
  }

  @Post("presign-upload")
  presignUpload(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: PatientIdParamDto,
    @Body() body: PresignUploadDto,
  ): Promise<PresignAttachmentUploadResponse> {
    return this.attachments.presignUpload(actor, params.patientId, body);
  }

  @Post("confirm")
  @Audit(ATTACHMENTS_ENTITY, AUDIT_ACTION.CREATE, { entityIdSource: "response" })
  confirmUpload(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: PatientIdParamDto,
    @Body() body: ConfirmUploadDto,
  ): Promise<Attachment> {
    return this.attachments.confirmUpload(actor, params.patientId, body);
  }
}

@Controller("attachments")
@Roles(USER_ROLE.DOCTOR, USER_ROLE.VISITING_DOCTOR)
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get(":id")
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<Attachment> {
    return this.attachments.findOne(actor, params.id);
  }

  @Delete(":id")
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(ATTACHMENTS_ENTITY, AUDIT_ACTION.DELETE)
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<void> {
    await this.attachments.softDelete(actor, params.id);
  }
}
