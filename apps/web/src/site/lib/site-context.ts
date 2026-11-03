import type { PublicSite, SiteDocument, SiteLanguage, SitePreviewEdit } from "@clinic/shared";
import { createContext } from "react";
import type { Translate } from "@web/site/i18n";
import type { SitePageRoute } from "@web/site/route";

export interface SiteContextValue {
  readonly site: PublicSite;
  readonly siteDocument: SiteDocument;
  readonly language: SiteLanguage;
  readonly languages: readonly SiteLanguage[];
  readonly t: Translate;
  readonly preview: boolean;
  readonly edit: SitePreviewEdit | null;
  readonly page: SitePageRoute;
  readonly params: URLSearchParams;
  readonly setParams: (changes: Record<string, string | null>) => void;
  readonly href: (path: string, params?: Record<string, string>) => string;
  readonly navigate: (to: string) => void;
}

export const SiteContext = createContext<SiteContextValue | null>(null);
