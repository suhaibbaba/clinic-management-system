import { SITE_LANGUAGES, type SiteLanguage } from "@clinic/shared";
import { useEffect, useRef, useState, type JSX } from "react";
import { cx } from "@web/booking/ui";
import { SiteIcon } from "@web/site/components/site-icon";
import { SITE_LANGUAGE_LABELS, SITE_PARAM } from "@web/site/constants";
import { useSite } from "@web/site/hooks/use-site";

export function LanguageMenu(): JSX.Element {
  const { language, t, setParams } = useSite();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const onPointer = (event: PointerEvent): void => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const choose = (next: SiteLanguage): void => {
    setOpen(false);
    setParams({ [SITE_PARAM.LANGUAGE]: next === "ar" ? null : next });
  };

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        data-testid="site-language"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="site-language-list"
        aria-label={t("nav.language")}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-(--control-h) cursor-pointer items-center gap-2 rounded-pill px-3 text-label font-medium text-ink-inverse hover:bg-ink-inverse/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-inverse"
      >
        <SiteIcon name="globe" className="size-4 text-primary-300" />
        <span lang={language}>{SITE_LANGUAGE_LABELS[language]}</span>
        <SiteIcon
          name="chevron-down"
          className={cx("size-4 transition-transform", open && "rotate-180")}
        />
      </button>
      <ul
        id="site-language-list"
        data-testid="site-language-list"
        className={cx(
          "absolute end-0 top-full z-40 mt-1 min-w-36 rounded-panel bg-surface p-1 text-ink shadow-float",
          !open && "hidden",
        )}
      >
        {SITE_LANGUAGES.map((option) => (
          <li key={option}>
            <button
              type="button"
              lang={option}
              data-testid={`site-language-${option}`}
              aria-current={option === language}
              onClick={() => choose(option)}
              className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-control px-3 py-2 text-label font-medium hover:bg-primary-50 aria-[current=true]:text-primary-800"
            >
              {SITE_LANGUAGE_LABELS[option]}
              {option === language && <SiteIcon name="check" className="size-4" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
