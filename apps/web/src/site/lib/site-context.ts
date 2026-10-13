import type { PublicSite, SiteLanguage } from "@clinic/shared";
import { createContext } from "react";
import type { Translate } from "@web/site/i18n";
import type { SitePageRoute } from "@web/site/route";

export interface SiteContextValue {
  readonly site: PublicSite;
  readonly language: SiteLanguage;
  readonly t: Translate;
  readonly preview: boolean;
  readonly page: SitePageRoute;
  readonly params: URLSearchParams;
  readonly setParams: (changes: Record<string, string | null>) => void;
  readonly href: (path: string, params?: Record<string, string>) => string;
  readonly navigate: (to: string) => void;
}

export const SiteContext = createContext<SiteContextValue | null>(null);
