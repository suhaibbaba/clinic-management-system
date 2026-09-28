import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  type OnModuleInit,
} from "@nestjs/common";
import { and, count, desc, eq, ilike, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import {
  ALLOWED_USER_PHOTO_MIME_TYPES,
  AUDIT_ACTION,
  joinPersonName,
  USER_ROLE,
  type UserRole,
  MAX_USER_PHOTO_BYTES,
  type ConfirmUserPhotoInput,
  type CreateUserInput,
  type ListUsersQuery,
  type Paginated,
  type PresignUserPhotoInput,
  type PresignUserPhotoResponse,
  type UpdateUserInput,
  type User,
  type PersonNameInput,
} from "@clinic/shared";
import { AuditSnapshotRegistry } from "@api/audit/audit-snapshot.registry";
import { AuditService } from "@api/audit/audit.service";
import { PasswordService } from "@api/auth/password.service";
import { TokenService } from "@api/auth/token.service";
import { arabicNameSearch } from "@api/common/database/arabic-search";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { toLimitOffset, toPaginated } from "@api/common/database/pagination";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database, type DatabaseExecutor } from "@api/database/database.module";
import { users } from "@api/database/schema";
import { StorageService } from "@api/storage/storage.service";

type UserRow = typeof users.$inferSelect;

export const USERS_ENTITY = "users";

const photoCategory = (userId: string): string => `staff/${userId}`;

const safeColumns = {
  id: users.id,
  clinicId: users.clinicId,
  nameAr: users.nameAr,
  nameEn: users.nameEn,
  firstNameAr: users.firstNameAr,
  lastNameAr: users.lastNameAr,
  firstNameEn: users.firstNameEn,
  lastNameEn: users.lastNameEn,
  phone: users.phone,
  email: users.email,
  role: users.role,
  isActive: users.isActive,
  activated: sql<boolean>`${users.passwordHash} is not null`.as("activated"),
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
    const byName = query.search ? arabicNameSearch(users.normalizedName, query.search) : null;

    if (query.search) {
      const pattern = `%${query.search}%`;
      filters.push(or(byName?.match, ilike(users.phone, pattern), ilike(users.email, pattern)));
    }

    const where = this.scope.where(users, actor.clinicId, ...filters);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select(safeColumns)
        .from(users)
        .where(where)
        .orderBy(...(byName ? [byName.rank, byName.closeness] : []), desc(users.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ value: count() }).from(users).where(where),
    ]);

    return toPaginated(await this.present(rows), totals?.value ?? 0, query);
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<User> {
    const row = await this.findInClinicOrFail(actor.clinicId, id);

    return this.presentOne({ ...row, activated: row.passwordHash !== null });
  }

  async create(actor: AuthenticatedUser, input: CreateUserInput): Promise<User> {
    assertNotDoctorRole(input.role);

    return this.presentOne(await this.insertUser(this.db, actor, input));
  }

  async insertUser(
    executor: DatabaseExecutor,
    actor: AuthenticatedUser,
    input: CreateUserInput,
  ): Promise<SafeUserRow> {
    await this.assertIdentifiersAreFree(input.phone, input.email ?? null, undefined, executor);

    const passwordHash = input.password ? await this.passwordService.hash(input.password) : null;

    const [row] = await executor
      .insert(users)
      .values({
        clinicId: actor.clinicId,
        ...staffNameColumns(input.firstName, input.lastName),
        phone: input.phone,
        email: input.email ?? null,
        passwordHash,
        role: input.role,
        isActive: input.isActive,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning(safeColumns);

    if (!row) {
      throw new Error("Failed to create user");
    }

    return row;
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

    if (input.role !== undefined && input.role !== existing.role) {
      assertNotDoctorRole(input.role);
    }

    if (id === actor.id) {
      if (input.isActive === false) {
        throw new BadRequestException("You cannot deactivate your own account");
      }
      if (input.role !== undefined && input.role !== existing.role) {
        throw new BadRequestException("You cannot change your own role");
      }
    }

    const [row] = await this.db
      .update(users)
      .set({
        ...((input.firstName !== undefined || input.lastName !== undefined) &&
          staffNameColumns(
            input.firstName ?? { ar: existing.firstNameAr, en: existing.firstNameEn },
            input.lastName ?? { ar: existing.lastNameAr, en: existing.lastNameEn },
          )),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.email !== undefined && { email: input.email ?? null }),
        ...(input.role !== undefined && { role: input.role }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(this.scope.where(users, actor.clinicId, eq(users.id, id)))
      .returning(safeColumns);

    if (!row) {
      throw new Error("Failed to update user");
    }

    if (input.isActive === false) {
      await this.tokenService.revokeAllForUser(id);
    }

    return this.presentOne(row);
  }

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

  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.findInClinicOrFail(actor.clinicId, id);

    if (id === actor.id) {
      throw new BadRequestException("You cannot delete your own account");
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
      throw new BadRequestException("This key does not belong to this user");
    }

    const stored = await this.storage.statObject(input.key);

    if (!stored) {
      throw new BadRequestException("No uploaded file found for this key");
    }

    const isImage = ALLOWED_USER_PHOTO_MIME_TYPES.some((mime) => mime === stored.mime);

    if (!isImage || stored.sizeBytes <= 0 || stored.sizeBytes > MAX_USER_PHOTO_BYTES) {
      await this.storage.deleteObject(input.key);
      throw new BadRequestException(
        isImage ? "Uploaded file size is outside the allowed range" : "Unsupported file type",
      );
    }

    const row = await this.setPhotoKey(actor, id, input.key);

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

  async findInClinicOrFail(clinicId: string, id: string): Promise<UserRow> {
    return this.scope.findOneOrFail<UserRow>(users, clinicId, id);
  }

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

    if (!row) {
      throw new Error("Failed to update the staff photo");
    }

    return row;
  }

  private async presentOne(row: SafeUserRow): Promise<User> {
    return toUser(row, await this.signPhoto(row.photoKey));
  }

  private async present(rows: readonly SafeUserRow[]): Promise<User[]> {
    return Promise.all(rows.map((row) => this.presentOne(row)));
  }

  private async assertIdentifiersAreFree(
    phone: string,
    email: string | null,
    excludeUserId?: string,
    executor: DatabaseExecutor = this.db,
  ): Promise<void> {
    const identifierMatches = email
      ? or(eq(users.phone, phone), eq(sql`lower(${users.email})`, email.toLowerCase()))
      : eq(users.phone, phone);

    const [clash] = await executor
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
      clash.phone === phone ? "Phone number is already in use" : "Email is already in use",
    );
  }
}

export type SafeUserRow = Pick<UserRow, Exclude<keyof typeof safeColumns, "activated">> & {
  activated: boolean;
};

export function staffNameColumns(
  firstName: PersonNameInput,
  lastName: PersonNameInput,
): Pick<
  UserRow,
  "firstNameAr" | "lastNameAr" | "firstNameEn" | "lastNameEn" | "nameAr" | "nameEn"
> {
  const full = joinPersonName(firstName, lastName);

  return {
    firstNameAr: firstName.ar,
    lastNameAr: lastName.ar,
    firstNameEn: firstName.en,
    lastNameEn: lastName.en,
    nameAr: full.ar,
    nameEn: full.en,
  };
}

function assertNotDoctorRole(role: UserRole): void {
  if (role === USER_ROLE.DOCTOR || role === USER_ROLE.VISITING_DOCTOR) {
    throw new BadRequestException("Create a doctor from the doctors screen, which makes both rows");
  }
}

function toUser(row: SafeUserRow, photoUrl: string | null): User {
  return {
    id: row.id,
    clinicId: row.clinicId,
    name: { ar: row.nameAr, en: row.nameEn },
    firstName: { ar: row.firstNameAr, en: row.firstNameEn },
    lastName: { ar: row.lastNameAr, en: row.lastNameEn },
    phone: row.phone,
    email: row.email,
    activated: row.activated,
    role: row.role,
    isActive: row.isActive,
    photoUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toAuditSnapshot(row: SafeUserRow): Record<string, unknown> {
  return { ...toUser(row, null), photoKey: row.photoKey };
}
