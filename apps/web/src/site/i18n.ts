import type { SiteLanguage } from "@clinic/shared";
import ar from "@web/site/locales/ar.json";
import en from "@web/site/locales/en.json";

type Dictionary = { readonly [key: string]: string | Dictionary };

const DICTIONARIES: Record<SiteLanguage, Dictionary> = { ar, en };

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function translator(language: SiteLanguage): Translate {
  return (key, vars) => {
    const value = key
      .split(".")
      .reduce<string | Dictionary | undefined>(
        (node, part) => (typeof node === "object" ? node[part] : undefined),
        DICTIONARIES[language],
      );

    if (typeof value !== "string") {
      return key;
    }

    return vars
      ? value.replaceAll(/\{\{(\w+)\}\}/g, (match, name: string) =>
          name in vars ? String(vars[name]) : match,
        )
      : value;
  };
}
