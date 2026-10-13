import type { PublicSite } from "@clinic/shared";

export const imageOf = (site: PublicSite, key: string | null | undefined): string | undefined =>
  key ? site.images[key] : undefined;
