import {
  clinicLocale,
  documentLanguage,
  FALLBACK_LANGUAGE,
  LANGUAGE_CODES,
  localized,
  type LanguageCode,
  type LocalizedText,
} from "@clinic/shared";
import { eq, sql, type SQL } from "drizzle-orm";
import { type DatabaseExecutor } from "@api/database/database.module";
import { clinics } from "@api/database/schema";

export interface ClinicLanguage {
  readonly language: LanguageCode;
  readonly languages: readonly LanguageCode[];
}

export async function clinicDocumentLanguage(
  db: DatabaseExecutor,
  clinicId: string,
): Promise<ClinicLanguage> {
  const [row] = await db
    .select({ country: clinics.country, currency: clinics.currency, settings: clinics.settings })
    .from(clinics)
    .where(eq(clinics.id, clinicId))
    .limit(1);
  const source = row ?? {};

  return { language: documentLanguage(source), languages: clinicLocale(source).languages };
}

export const inLanguage = (
  text: LocalizedText | null | undefined,
  { language, languages }: ClinicLanguage,
): string => localized(text, language, languages);

export function localizedSql(column: SQL, { language, languages }: ClinicLanguage): SQL {
  const order = [...new Set([language, ...languages, FALLBACK_LANGUAGE, ...LANGUAGE_CODES])];
  const candidates = order.map((code) => sql`nullif(btrim(${column} ->> ${code}::text), '')`);

  return sql`coalesce(${sql.join(candidates, sql`, `)}, '')`;
}
