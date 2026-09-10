import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  type OnModuleInit,
} from '@nestjs/common';
import { and, count, desc, eq, ilike, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import {
  ALLOWED_USER_PHOTO_MIME_TYPES,
  AUDIT_ACTION,
  MAX_USER_PHOTO_BYTES,
  type ConfirmUserPhotoInput,
  type CreateUserInput,
  type ListUsersQuery,
  type Paginated,
  type PresignUserPhotoInput,
  type PresignUserPhotoResponse,
  type UpdateUserInput,
  type User,
} from '@clinic/shared';

import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { AuditService } from '@api/audit/audit.service';
import { PasswordService } from '@api/auth/password.service';
import { TokenService } from '@api/auth/token.service';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { users } from '@api/database/schema';
import { StorageService } from '@api/storage/storage.service';

type UserRow = typeof users.$inferSelect;

export const USERS_ENTITY = 'users';

// One folder per member of staff, so a key can be checked against the clinic that signed for it and
// the person it is of — another user's folder is refused on confirm.
const photoCategory = (userId: string): string => `staff/${userId}`;

/** Columns safe to store in the audit trail and to return — never the hash. */
const safeColumns = {
  id: users.id,
  clinicId: users.clinicId,
  nameAr: users.nameAr,
  nameEn: users.nameEn,
  phone: users.phone,
  email: users.email,
  role: users.role,
  isActive: users.isActive,
  photoKey: users.photoKey,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
    private readonly auditService: AuditService,
    private readonly storage: StorageService,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(USERS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select(safeColumns)
        .from(users)
        .where(this.scope.where(users, clinicId, eq(users.id, id)))
        .limit(1);

      return row ? toAuditSnapshot(row) : null;
    });
  }

  async list(actor: AuthenticatedUser, query: ListUsersQuery): Promise<Paginated<User>> {
    const filters: (SQL | undefined)[] = [];

    if (query.role) {
      filters.push(eq(users.role, query.role));
    }
    if (query.isActive !== undefined) {
      filters.push(eq(users.isActive, query.isActive));
    }
    if (query.search) {
      const pattern = `%${query.search}%`;
      // Either spelling: somebody searching an Arabic interface for "Layla"
      // is searching the name they can see on a printed sheet.
      filters.push(
        or(
          ilike(users.nameAr, pattern),
          ilike(users.nameEn, pattern),
          ilike(users.phone, pattern),
          ilike(users.email, pattern),
        ),
      );
    }

    const where = this.scope.where(users, actor.clinicId, ...filters);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select(safeColumns)
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ value: count() }).from(users).where(where),
    ]);

    return toPaginated(await this.present(rows), totals?.value ?? 0, query);
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<User> {
    return this.presentOne(await this.findInClinicOrFail(actor.clinicId, id));
  }

  async create(actor: AuthenticatedUser, input: CreateUserInput): Promise<User> {
    await this.assertIdentifiersAreFree(input.phone, input.email ?? null);

    const passwordHash = await this.passwordService.hash(input.password);

    const [row] = await this.db
      .insert(users)
      .values({
        clinicId: actor.clinicId,
        nameAr: input.name.ar,
        nameEn: input.name.en,
        phone: input.phone,
        email: input.email ?? null,
        passwordHash,
        role: input.role,
        isActive: input.isActive,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning(safeColumns);

    /* istanbul ignore next -- insert ... returning always yields a row. */
    if (!row) {
      throw new Error('Failed to create user');
    }

    return this.presentOne(row);
  }

  async update(actor: AuthenticatedUser, id: string, input: UpdateUserInput): Promise<User> {
    const existing = await this.findInClinicOrFail(actor.clinicId, id);

    if (input.phone !== undefined || input.email !== undefined) {
      await this.assertIdentifiersAreFree(
        input.phone ?? existing.phone,
        input.email === undefined ? existing.email : (input.email ?? null),
        id,
      );
    }

    // An admin who deactivates or demotes themselves would lock the clinic out
    // of user management, so both are refused.
    if (id === actor.id) {
      if (input.isActive === false) {
        throw new BadRequestException('You cannot deactivate your own account');
      }
      if (input.role !== undefined && input.role !== existing.role) {
        throw new BadRequestException('You cannot change your own role');
      }
    }

    const [row] = await this.db
      .update(users)
      .set({
        ...(input.name !== undefined && { nameAr: input.name.ar, nameEn: input.name.en }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.email !== undefined && { email: input.email ?? null }),
        ...(input.role !== undefined && { role: input.role }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(this.scope.where(users, actor.clinicId, eq(users.id, id)))
      .returning(safeColumns);

    /* istanbul ignore next -- the row was just loaded within this clinic. */
    if (!row) {
      throw new Error('Failed to update user');
    }

    // A deactivated user must not keep a live session.
    if (input.isActive === false) {
      await this.tokenService.revokeAllForUser(id);
    }

    return this.presentOne(row);
  }

  // Every session for that user is revoked, and only the fact is audited — the password has no
  // value that may be stored.
  async resetPassword(actor: AuthenticatedUser, id: string, newPassword: string): Promise<void> {
    const target = await this.findInClinicOrFail(actor.clinicId, id);

    const passwordHash = await this.passwordService.hash(newPassword);

    await this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(users, actor.clinicId, eq(users.id, id)));

    await this.tokenService.revokeAllForUser(id);

    await this.auditService.record({
      clinicId: actor.clinicId,
      userId: actor.id,
      action: AUDIT_ACTION.UPDATE,
      entity: USERS_ENTITY,
      entityId: target.id,
      oldValue: null,
      newValue: { passwordReset: true },
    });
  }

  /** Soft delete — nothing is ever hard-deleted (CLAUDE.md). */
  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.findInClinicOrFail(actor.clinicId, id);

    if (id === actor.id) {
      throw new BadRequestException('You cannot delete your own account');
    }

    await this.db
      .update(users)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(users, actor.clinicId, eq(users.id, id)));

    await this.tokenService.revokeAllForUser(id);
  }

  async presignPhoto(
    actor: AuthenticatedUser,
    id: string,
    input: PresignUserPhotoInput,
  ): Promise<PresignUserPhotoResponse> {
    await this.findInClinicOrFail(actor.clinicId, id);

    const key = this.storage.buildClinicObjectKey({
      clinicId: actor.clinicId,
      category: photoCategory(id),
      filename: input.filename,
    });

    const upload = await this.storage.createUploadUrl(key, input.mime);

    return {
      key: upload.key,
      uploadUrl: upload.uploadUrl,
      expiresAt: upload.expiresAt.toISOString(),
      maxSizeBytes: MAX_USER_PHOTO_BYTES,
    };
  }

  async confirmPhoto(
    actor: AuthenticatedUser,
    id: string,
    input: ConfirmUserPhotoInput,
  ): Promise<User> {
    const existing = await this.findInClinicOrFail(actor.clinicId, id);

    if (!this.storage.isClinicKeyOwnedBy(input.key, actor.clinicId, photoCategory(id))) {
      throw new BadRequestException('This key does not belong to this user');
    }

    const stored = await this.storage.statObject(input.key);

    if (!stored) {
      throw new BadRequestException('No uploaded file found for this key');
    }

    const isImage = ALLOWED_USER_PHOTO_MIME_TYPES.some((mime) => mime === stored.mime);

    if (!isImage || stored.sizeBytes <= 0 || stored.sizeBytes > MAX_USER_PHOTO_BYTES) {
      // Unusable, so it is not left paying for storage.
      await this.storage.deleteObject(input.key);
      throw new BadRequestException(
        isImage ? 'Uploaded file size is outside the allowed range' : 'Unsupported file type',
      );
    }

    const row = await this.setPhotoKey(actor, id, input.key);

    // The one it replaces: a photo is a single current image, not a history,
    // and the old object has nothing left pointing at it.
    if (existing.photoKey && existing.photoKey !== input.key) {
      await this.storage.deleteObject(existing.photoKey);
    }

    return this.presentOne(row);
  }

  async removePhoto(actor: AuthenticatedUser, id: string): Promise<User> {
    const existing = await this.findInClinicOrFail(actor.clinicId, id);
    const row = await this.setPhotoKey(actor, id, null);

    if (existing.photoKey) {
      await this.storage.deleteObject(existing.photoKey);
    }

    return this.presentOne(row);
  }

  /** Shared with the doctors module: a doctor row must point at a real user. */
  async findInClinicOrFail(clinicId: string, id: string): Promise<UserRow> {
    return this.scope.findOneOrFail<UserRow>(users, clinicId, id);
  }

  // The only form a photo ever leaves the API in. Shared with the auth and doctors services, so a
  // face is signed the same way whichever endpoint drew it.
  async signPhoto(key: string | null): Promise<string | null> {
    return key ? (await this.storage.createDownloadUrl(key)).url : null;
  }

  private async setPhotoKey(
    actor: AuthenticatedUser,
    id: string,
    key: string | null,
  ): Promise<SafeUserRow> {
    const [row] = await this.db
      .update(users)
      .set({ photoKey: key, updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(users, actor.clinicId, eq(users.id, id)))
      .returning(safeColumns);

    /* istanbul ignore next -- the row was just loaded within this clinic. */
    if (!row) {
      throw new Error('Failed to update the staff photo');
    }

    return row;
  }

  private async presentOne(row: SafeUserRow): Promise<User> {
    return toUser(row, await this.signPhoto(row.photoKey));
  }

  private async present(rows: readonly SafeUserRow[]): Promise<User[]> {
    return Promise.all(rows.map((row) => this.presentOne(row)));
  }

  // Phone and email are unique system-wide because login resolves them with no clinic hint, so this
  // check deliberately spans clinics.
  private async assertIdentifiersAreFree(
    phone: string,
    email: string | null,
    excludeUserId?: string,
  ): Promise<void> {
    const identifierMatches = email
      ? or(eq(users.phone, phone), eq(sql`lower(${users.email})`, email.toLowerCase()))
      : eq(users.phone, phone);

    const [clash] = await this.db
      .select({ phone: users.phone, email: users.email })
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          identifierMatches,
          excludeUserId ? ne(users.id, excludeUserId) : undefined,
        ),
      )
      .limit(1);

    if (!clash) {
      return;
    }

    throw new ConflictException(
      clash.phone === phone ? 'Phone number is already in use' : 'Email is already in use',
    );
  }
}

type SafeUserRow = Pick<UserRow, keyof typeof safeColumns>;

function toUser(row: SafeUserRow, photoUrl: string | null): User {
  return {
    id: row.id,
    clinicId: row.clinicId,
    name: { ar: row.nameAr, en: row.nameEn },
    phone: row.phone,
    email: row.email,
    role: row.role,
    isActive: row.isActive,
    photoUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// The trail records the stored key, not a signed URL: the URL expires in minutes and would make
// every entry unreadable a day later.
function toAuditSnapshot(row: SafeUserRow): Record<string, unknown> {
  return { ...toUser(row, null), photoKey: row.photoKey };
}
