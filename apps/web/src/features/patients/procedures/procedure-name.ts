import type { ProcedureCatalogItem } from "@clinic/shared";

/** A catalog entry's name in the reader's language. */
export const procedureName = (
  entry: Pick<ProcedureCatalogItem, "nameAr" | "nameEn">,
  language: string,
): string => (language.startsWith("ar") ? entry.nameAr : entry.nameEn || entry.nameAr);
