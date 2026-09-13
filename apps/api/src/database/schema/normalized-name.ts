import { sql } from 'drizzle-orm';
import { text } from 'drizzle-orm/pg-core';

// Generated rather than written by the application, so a row inserted by a seed, a migration or
// psql is searchable too. `normalize_arabic()` is created in the same migration and mirrors
// `normalizeArabic()` from `@clinic/shared` — changing one without the other splits the two apart.
export const normalizedName = (expression: string) =>
  text('normalized_name').generatedAlwaysAs(sql.raw(`normalize_arabic(${expression})`));
