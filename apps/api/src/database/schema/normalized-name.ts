import { sql } from 'drizzle-orm';
import { text } from 'drizzle-orm/pg-core';

export const normalizedName = (expression: string) =>
  text('normalized_name').generatedAlwaysAs(sql.raw(`normalize_arabic(${expression})`));
