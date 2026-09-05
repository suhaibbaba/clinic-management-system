import { randomUUID } from 'node:crypto';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '@api/config/env.schema';

export interface SignedUpload {
  readonly key: string;
  readonly uploadUrl: string;
  readonly expiresAt: Date;
}

export interface SignedDownload {
  readonly url: string;
  readonly expiresAt: Date;
}

export interface StoredObject {
  readonly sizeBytes: number;
  readonly mime: string | undefined;
}

/**
 * S3-compatible object storage — Cloudflare R2 in production, MinIO in the dev
 * stack (CLAUDE.md files & images).
 *
 * Bytes never touch the API: clients PUT straight to a presigned URL and read
 * through a short-lived signed GET. Nothing is ever public, and the bucket is
 * addressed only through keys this service builds.
 */
@Injectable()
export class StorageService implements OnApplicationShutdown {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.bucket = config.get('STORAGE_BUCKET', { infer: true });
    this.client = new S3Client({
      endpoint: config.get('STORAGE_ENDPOINT', { infer: true }),
      region: config.get('STORAGE_REGION', { infer: true }),
      forcePathStyle: config.get('STORAGE_FORCE_PATH_STYLE', { infer: true }),
      credentials: {
        accessKeyId: config.get('STORAGE_ACCESS_KEY_ID', { infer: true }),
        secretAccessKey: config.get('STORAGE_SECRET_ACCESS_KEY', { infer: true }),
      },
    });
  }

  onApplicationShutdown(): void {
    this.client.destroy();
  }

  /**
   * `clinic/{clinicId}/patients/{patientId}/{category}/{uuid}-{filename}`.
   *
   * The clinic prefix keeps one tenant's objects inseparable from its id, so a
   * key from another clinic cannot be confirmed against this one. The random
   * component makes keys unguessable and collision-free.
   */
  buildPatientObjectKey(input: {
    clinicId: string;
    patientId: string;
    category: string;
    filename: string;
  }): string {
    const safeName = sanitiseFilename(input.filename);
    return `clinic/${input.clinicId}/patients/${input.patientId}/${input.category}/${randomUUID()}-${safeName}`;
  }

  /** True when the key belongs to this clinic and patient. */
  isKeyOwnedBy(key: string, clinicId: string, patientId: string): boolean {
    return key.startsWith(`clinic/${clinicId}/patients/${patientId}/`);
  }

  async createUploadUrl(key: string, mime: string): Promise<SignedUpload> {
    const ttl = this.config.get('STORAGE_UPLOAD_URL_TTL_SECONDS', { infer: true });

    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: mime }),
      { expiresIn: ttl },
    );

    return { key, uploadUrl, expiresAt: new Date(Date.now() + ttl * 1000) };
  }

  async createDownloadUrl(key: string, filename?: string): Promise<SignedDownload> {
    const ttl = this.config.get('STORAGE_DOWNLOAD_URL_TTL_SECONDS', { infer: true });

    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ...(filename && {
          ResponseContentDisposition: `inline; filename="${sanitiseFilename(filename)}"`,
        }),
      }),
      { expiresIn: ttl },
    );

    return { url, expiresAt: new Date(Date.now() + ttl * 1000) };
  }

  /**
   * Reads back what was actually stored. The confirm step uses this rather than
   * trusting the size and content type a client claims.
   */
  async statObject(key: string): Promise<StoredObject | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );

      return { sizeBytes: result.ContentLength ?? 0, mime: result.ContentType };
    } catch (error: unknown) {
      if (isNotFound(error)) {
        return null;
      }

      throw error;
    }
  }

  /**
   * Removes an orphaned object — one uploaded but never confirmed, or confirmed
   * with contents the API rejected. Never called for a live attachment: those
   * are soft-deleted, so the object outlives the row.
   */
  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error: unknown) {
      // Cleanup is best effort; a leftover object must not fail the request.
      this.logger.warn(`Failed to delete orphaned object ${key}: ${String(error)}`);
    }
  }
}

/** Strips anything that could escape the key prefix or confuse a header. */
function sanitiseFilename(filename: string): string {
  return (
    filename
      .replace(/[\\/\r\n"]/g, '')
      .replace(/\s+/g, '_')
      .slice(-120) || 'file'
  );
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return candidate.name === 'NotFound' || candidate.$metadata?.httpStatusCode === 404;
}
