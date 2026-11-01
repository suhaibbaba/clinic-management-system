import type { SiteLanguage } from "@clinic/shared";
import { Flag } from "@clinic/ui/components/flag";
import { useCallback, useRef, useState, type JSX } from "react";
import { SiteIcon } from "@web/site/components/site-icon";
import { SITE_PARAM } from "@web/site/constants";
import { useDismiss } from "@web/site/hooks/use-dismiss";
import { useSite } from "@web/site/hooks/use-site";
import { languageFlag, languageLabel } from "@web/site/lib/language";

export function SiteLanguageMenu(): JSX.Element | null {
  const { site, language, languages, t, setParams } = useSite();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useDismiss(open, close, root, trigger);

  if (languages.length < 2) {
    return null;
  }

  const choose = (next: SiteLanguage): void => {
    setOpen(false);
    setParams({ [SITE_PARAM.LANGUAGE]: next === site.clinic.locale.primaryLanguage ? null : next });
  };

  return (
    <div ref={root} data-testid="site-language" className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        data-part="trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="site-language-menu"
        aria-label={t("nav.language")}
        onClick={() => setOpen((value) => !value)}
        className="pill-text inline-flex min-h-(--control-h-sm) cursor-pointer items-center gap-2 rounded-pill px-2.5 text-meta font-medium text-ink-inverse/90 hover:bg-ink-inverse/10"
      >
        <Flag
          country={languageFlag(language, site.clinic.country)}
          className="ring-ink-inverse/30"
        />
        <span>{languageLabel(language)}</span>
        <SiteIcon name="chevron-down" className="size-3.5" />
      </button>

      {open && (
        <ul
          id="site-language-menu"
          role="menu"
          aria-label={t("nav.language")}
          data-part="menu"
          className="absolute end-0 top-full z-40 mt-1.5 flex w-44 flex-col gap-0.5 rounded-panel border border-line bg-surface p-1.5 text-ink shadow-float"
        >
          {languages.map((option) => (
            <li key={option} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={option === language}
                lang={option}
                data-part={`option-${option}`}
                onClick={() => choose(option)}
                className="flex min-h-(--control-h) w-full cursor-pointer items-center gap-2.5 rounded-control px-2.5 text-start text-label font-medium hover:bg-primary-50 aria-checked:bg-primary-50 aria-checked:text-primary-800"
              >
                <Flag country={languageFlag(option, site.clinic.country)} />
                <span className="flex-1">{languageLabel(option)}</span>
                {option === language && (
                  <SiteIcon name="check" className="size-4 text-primary-600" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
