import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  type OnModuleInit,
} from '@nestjs/common';
import { and, count, desc, eq, ilike, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import type {
  CreateUserInput,
  ListUsersQuery,
  Paginated,
  UpdateUserInput,
  User,
} from '@clinic/shared';

import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { PasswordService } from '@api/auth/password.service';
import { TokenService } from '@api/auth/token.service';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { users } from '@api/database/schema';

type UserRow = typeof users.$inferSelect;

/** Entity name used in `audit_log.entity` and by `@Audit(...)`. */
export const USERS_ENTITY = 'users';

/** Columns safe to store in the audit trail and to return — never the hash. */
const safeColumns = {
  id: users.id,
  clinicId: users.clinicId,
  name: users.name,
  phone: users.phone,
  email: users.email,
  role: users.role,
  isActive: users.isActive,
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
      filters.push(
        or(ilike(users.name, pattern), ilike(users.phone, pattern), ilike(users.email, pattern)),
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

    return toPaginated(rows.map(toUser), totals?.value ?? 0, query);
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<User> {
    return toUser(await this.findInClinicOrFail(actor.clinicId, id));
  }

  async create(actor: AuthenticatedUser, input: CreateUserInput): Promise<User> {
    await this.assertIdentifiersAreFree(input.phone, input.email ?? null);

    const passwordHash = await this.passwordService.hash(input.password);

    const [row] = await this.db
      .insert(users)
      .values({
        clinicId: actor.clinicId,
        name: input.name,
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

    return toUser(row);
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
        ...(input.name !== undefined && { name: input.name }),
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

    return toUser(row);
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

  /** Shared with the doctors module: a doctor row must point at a real user. */
  async findInClinicOrFail(clinicId: string, id: string): Promise<UserRow> {
    return this.scope.findOneOrFail<UserRow>(users, clinicId, id);
  }

  /**
   * Phone and email are unique system-wide because login resolves them without
   * a clinic hint, so this check deliberately spans clinics.
   */
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

function toUser(row: SafeUserRow): User {
  return {
    id: row.id,
    clinicId: row.clinicId,
    name: row.name,
    phone: row.phone,
    email: row.email,
    role: row.role,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toAuditSnapshot(row: SafeUserRow): Record<string, unknown> {
  return { ...toUser(row) };
}
