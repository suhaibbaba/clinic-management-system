import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  type LabOrderAttachment,
  type PresignAttachmentUploadResponse,
} from '@clinic/shared';
import { and, asc, eq, isNull } from 'drizzle-orm';

import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { labOrderAttachments } from '@api/database/schema';
import { LabOrdersService } from '@api/labs/lab-orders.service';
import { StorageService } from '@api/storage/storage.service';

type AttachmentRow = typeof labOrderAttachments.$inferSelect;

// The key is built from the clinic and order, never taken from the client, and never leaves. It
// lives under the patient's prefix — it is a picture of their mouth.
@Injectable()
export class LabOrderAttachmentsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly orders: LabOrdersService,
    private readonly storage: StorageService,
  ) {}

  async list(actor: AuthenticatedUser, orderId: string): Promise<LabOrderAttachment[]> {
    await this.orders.requireRow(actor.clinicId, orderId);

    const rows = await this.db
      .select()
      .from(labOrderAttachments)
      .where(
        and(eq(labOrderAttachments.labOrderId, orderId), isNull(labOrderAttachments.deletedAt)),
      )
      .orderBy(asc(labOrderAttachments.createdAt));

    return Promise.all(rows.map((row) => this.withUrl(row)));
  }

  async presign(
    actor: AuthenticatedUser,
    orderId: string,
    input: { filename: string; mime: string },
  ): Promise<PresignAttachmentUploadResponse> {
    const order = await this.orders.requireRow(actor.clinicId, orderId);

    if (!isAllowedMime(input.mime)) {
      throw new BadRequestException('Unsupported file type');
    }

    const key = this.storage.buildPatientObjectKey({
      clinicId: actor.clinicId,
      patientId: order.patientId,
      category: `lab-orders/${orderId}`,
      filename: input.filename,
    });

    const upload = await this.storage.createUploadUrl(key, input.mime);

    return {
      key: upload.key,
      uploadUrl: upload.uploadUrl,
      expiresAt: upload.expiresAt.toISOString(),
      maxSizeBytes: MAX_ATTACHMENT_BYTES,
    };
  }

  // Size and type come back from storage, so a client cannot understate a file it has already put
  // there; anything outside the limits is deleted.
  async confirm(
    actor: AuthenticatedUser,
    orderId: string,
    input: { key: string; filename: string },
  ): Promise<LabOrderAttachment> {
    const order = await this.orders.requireRow(actor.clinicId, orderId);

    if (!this.storage.isKeyOwnedBy(input.key, actor.clinicId, order.patientId)) {
      throw new BadRequestException('This key does not belong to this order');
    }

    const [existing] = await this.db
      .select({ id: labOrderAttachments.id })
      .from(labOrderAttachments)
      .where(eq(labOrderAttachments.r2Key, input.key))
      .limit(1);

    if (existing) {
      throw new ConflictException('This upload has already been confirmed');
    }

    const stored = await this.storage.statObject(input.key);
    if (!stored) {
      throw new BadRequestException('No uploaded file found for this key');
    }

    if (
      !isAllowedMime(stored.mime) ||
      stored.sizeBytes <= 0 ||
      stored.sizeBytes > MAX_ATTACHMENT_BYTES
    ) {
      await this.storage.deleteObject(input.key);
      throw new BadRequestException(
        isAllowedMime(stored.mime)
          ? 'Uploaded file size is outside the allowed range'
          : 'Unsupported file type',
      );
    }

    const [row] = await this.db
      .insert(labOrderAttachments)
      .values({
        labOrderId: orderId,
        r2Key: input.key,
        filename: input.filename,
        mime: stored.mime,
        sizeBytes: stored.sizeBytes,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    /* istanbul ignore next -- insert ... returning always yields a row. */
    if (!row) {
      throw new Error('Failed to record the attachment');
    }

    return this.withUrl(row);
  }

  async softDelete(actor: AuthenticatedUser, orderId: string, id: string): Promise<void> {
    await this.orders.requireRow(actor.clinicId, orderId);

    await this.db
      .update(labOrderAttachments)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
      .where(and(eq(labOrderAttachments.id, id), eq(labOrderAttachments.labOrderId, orderId)));
  }

  /** The key stays server-side; what goes out is a URL that expires. */
  private async withUrl(row: AttachmentRow): Promise<LabOrderAttachment> {
    const download = await this.storage.createDownloadUrl(row.r2Key, row.filename);

    return {
      id: row.id,
      labOrderId: row.labOrderId,
      filename: row.filename,
      mime: row.mime,
      sizeBytes: row.sizeBytes,
      createdAt: row.createdAt.toISOString(),
      url: download.url,
    };
  }
}

const isAllowedMime = (mime: string | undefined): mime is string =>
  mime !== undefined && (ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(mime);
