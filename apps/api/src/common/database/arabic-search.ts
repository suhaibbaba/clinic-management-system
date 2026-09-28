import { normalizeArabic } from "@clinic/shared";
import { sql, type Column, type SQL } from "drizzle-orm";

const escapeLike = (value: string): string => value.replaceAll(/[\\%_]/g, (match) => `\\${match}`);

const FUZZY_THRESHOLD = 0.4;

export interface ArabicNameSearch {
  readonly match: SQL;
  readonly rank: SQL;
  readonly closeness: SQL;
}

export function arabicNameSearch(column: Column, search: string): ArabicNameSearch | null {
  const term = normalizeArabic(search);

  if (term === "") {
    return null;
  }

  const prefix = `${escapeLike(term)}%`;
  const contains = `%${escapeLike(term)}%`;

  return {
    match: sql`(${column} like ${contains}
                or word_similarity(${term}::text, ${column}) >= ${FUZZY_THRESHOLD})`,
    rank: sql`case
                when ${column} like ${prefix} then 0
                when ${column} like ${contains} then 1
                else 2
              end`,
    closeness: sql`word_similarity(${term}::text, ${column}) desc`,
  };
}
