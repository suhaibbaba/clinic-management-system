import { normalizeArabic } from "@clinic/shared";
import { sql, type Column, type SQL } from "drizzle-orm";

/** A `%` or `_` typed into the search box is a character, not a wildcard. */
const escapeLike = (value: string): string => value.replaceAll(/[\\%_]/g, (match) => `\\${match}`);

const FUZZY_THRESHOLD = 0.4;

export interface ArabicNameSearch {
  /** Rows the term reaches at all: folded substring, or close enough to be a typo. */
  readonly match: SQL;
  /** 0 for a folded prefix, 1 for a folded substring, 2 for a fuzzy hit — order by this first. */
  readonly rank: SQL;
  /** Tie-break within a band. */
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
