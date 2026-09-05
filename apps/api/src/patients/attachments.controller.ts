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
} from '@nestjs/common';
import {
  AUDIT_ACTION,
  confirmAttachmentUploadSchema,
  idParamSchema,
  listAttachmentsQuerySchema,
  patientIdParamSchema,
  presignAttachmentUploadSchema,
  USER_ROLE,
  type Attachment,
  type Paginated,
  type PresignAttachmentUploadResponse,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { Audit } from '@api/common/decorators/audit.decorator';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { ATTACHMENTS_ENTITY, AttachmentsService } from '@api/patients/attachments.service';

class PresignUploadDto extends createZodDto(presignAttachmentUploadSchema) {}
class ConfirmUploadDto extends createZodDto(confirmAttachmentUploadSchema) {}
class ListAttachmentsQueryDto extends createZodDto(listAttachmentsQuerySchema) {}
class PatientIdParamDto extends createZodDto(patientIdParamSchema) {}
class IdParamDto extends createZodDto(idParamSchema) {}

/**
 * Attachments / X-rays (ROLES.md patients matrix): admin CRUD, doctor CRU,
 * technician lab-linked only, receptionist nothing — a receptionist response
 * must never carry an attachment key or URL, which is why the role is not on
 * either controller here.
 *
 * Uploads are two steps so bytes never pass through the API: presign, PUT
 * straight to storage, then confirm.
 */
@Controller('patients/:patientId/attachments')
@Roles(USER_ROLE.DOCTOR)
export class PatientAttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  /** Metadata only — a signed URL is minted per file on the single read. */
  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: PatientIdParamDto,
    @Query() query: ListAttachmentsQueryDto,
  ): Promise<Paginated<Attachment>> {
    return this.attachments.list(actor, params.patientId, query);
  }

  /** Step 1: a short-lived PUT URL under a key the API alone decides. */
  @Post('presign-upload')
  presignUpload(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: PatientIdParamDto,
    @Body() body: PresignUploadDto,
  ): Promise<PresignAttachmentUploadResponse> {
    return this.attachments.presignUpload(actor, params.patientId, body);
  }

  /** Step 2: record the metadata once the object is really in the bucket. */
  @Post('confirm')
  @Audit(ATTACHMENTS_ENTITY, AUDIT_ACTION.CREATE, { entityIdSource: 'response' })
  confirmUpload(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: PatientIdParamDto,
    @Body() body: ConfirmUploadDto,
  ): Promise<Attachment> {
    return this.attachments.confirmUpload(actor, params.patientId, body);
  }
}

@Controller('attachments')
@Roles(USER_ROLE.DOCTOR)
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  /** Returns the metadata plus a signed URL that expires with the storage TTL. */
  @Get(':id')
  findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<Attachment> {
    return this.attachments.findOne(actor, params.id);
  }

  @Delete(':id')
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
