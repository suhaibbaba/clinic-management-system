import {
  TRANSLATION_LANGUAGES,
  type DeleteTranslationOverrideInput,
  type TranslationBundle,
  type TranslationLanguage,
  type TranslationOverride,
  type SaveTranslationOverridesInput,
  type UpsertTranslationOverrideInput,
} from "@clinic/shared";
import { Inject, Injectable } from "@nestjs/common";
import { eq, isNull } from "drizzle-orm";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database, type DatabaseExecutor } from "@api/database/database.module";
import { translationOverrides } from "@api/database/schema/translations";

export const TRANSLATION_OVERRIDES_ENTITY = "translation_overrides";

@Injectable()
export class TranslationsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
  ) {}

  async list(user: AuthenticatedUser): Promise<TranslationOverride[]> {
    const rows = await this.db
      .select({
        language: translationOverrides.language,
        key: translationOverrides.key,
        value: translationOverrides.value,
        updatedAt: translationOverrides.updatedAt,
      })
      .from(translationOverrides)
      .where(this.scope.where(translationOverrides, user.clinicId));

    return rows.map((row) => ({
      language: row.language as TranslationLanguage,
      key: row.key,
      value: row.value,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  /** Nested the way i18next takes a resource bundle, so the client merges it without walking it. */
  async bundle(user: AuthenticatedUser): Promise<TranslationBundle> {
    const rows = await this.list(user);
    const bundle = Object.fromEntries(
      TRANSLATION_LANGUAGES.map((language) => [language, {}]),
    ) as TranslationBundle;

    for (const row of rows) {
      nest(bundle[row.language], row.key, row.value);
    }

    return bundle;
  }

  async upsert(
    user: AuthenticatedUser,
    input: UpsertTranslationOverrideInput,
    executor: DatabaseExecutor = this.db,
  ): Promise<TranslationOverride> {
    const [row] = await executor
      .insert(translationOverrides)
      .values({
        clinicId: user.clinicId,
        language: input.language,
        key: input.key,
        value: input.value,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .onConflictDoUpdate({
        target: [
          translationOverrides.clinicId,
          translationOverrides.language,
          translationOverrides.key,
        ],
        targetWhere: isNull(translationOverrides.deletedAt),
        set: { value: input.value, updatedBy: user.id, updatedAt: new Date() },
      })
      .returning({
        language: translationOverrides.language,
        key: translationOverrides.key,
        value: translationOverrides.value,
        updatedAt: translationOverrides.updatedAt,
      });

    return {
      language: row!.language as TranslationLanguage,
      key: row!.key,
      value: row!.value,
      updatedAt: row!.updatedAt.toISOString(),
    };
  }

  // One transaction: a footer that saved four of six rows would leave a screen nobody can reason
  // about, and an empty string means "back to the default" rather than a blank label.
  async save(user: AuthenticatedUser, input: SaveTranslationOverridesInput): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const item of input.items) {
        if (item.value.trim() === "") {
          await this.reset(user, { language: item.language, key: item.key }, tx);
        } else {
          await this.upsert(user, { ...item, value: item.value.trim() }, tx);
        }
      }
    });
  }

  /** Resetting a key to the shipped default is removing the row, never writing the default in. */
  async reset(
    user: AuthenticatedUser,
    input: DeleteTranslationOverrideInput,
    executor: DatabaseExecutor = this.db,
  ): Promise<void> {
    await executor
      .update(translationOverrides)
      .set({ deletedAt: new Date(), updatedBy: user.id })
      .where(
        this.scope.where(
          translationOverrides,
          user.clinicId,
          eq(translationOverrides.language, input.language),
          eq(translationOverrides.key, input.key),
        ),
      );
  }
}

// The key is validated against a strict pattern before it reaches here, so no segment can be
// `__proto__` or `constructor`.
function nest(target: Record<string, unknown>, key: string, value: string): void {
  const parts = key.split(".");
  let node = target;

  for (const part of parts.slice(0, -1)) {
    const next = node[part];
    if (typeof next !== "object" || next === null) {
      node[part] = {};
    }
    node = node[part] as Record<string, unknown>;
  }

  node[parts[parts.length - 1]!] = value;
}
