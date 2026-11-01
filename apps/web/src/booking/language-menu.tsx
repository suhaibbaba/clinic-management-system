import { languageDefinition } from "@clinic/shared";
import type { JSX } from "react";
import { t } from "@web/booking/i18n";
import { cx } from "@web/booking/ui";
import type { BookingLanguage } from "@web/booking/use-booking-language";

export function LanguageMenu({
  language,
  className,
}: {
  readonly language: BookingLanguage | undefined;
  readonly className?: string;
}): JSX.Element | null {
  if (!language || language.languages.length < 2) {
    return null;
  }

  return (
    <nav
      data-testid="booking-language"
      aria-label={t("page.language")}
      className={cx("flex items-center gap-1", className)}
    >
      {language.languages.map((code) => {
        const current = code === language.language;
        const definition = languageDefinition(code);

        return (
          <a
            key={code}
            href={language.href(code)}
            lang={code}
            dir={definition.dir}
            data-testid={`booking-language-${code}`}
            {...(current && { "aria-current": "true" as const })}
            onClick={(event) => {
              event.preventDefault();
              language.choose(code);
            }}
            className={cx(
              "pill-text inline-flex h-(--control-h-sm) items-center rounded-pill px-3 text-label font-medium transition-colors duration-150",
              current ? "bg-primary-50 text-primary-900" : "text-ink-muted hover:text-primary-800",
            )}
          >
            {definition.nativeName}
          </a>
        );
      })}
    </nav>
  );
}
