import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@clinic/ui/components/icon";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@clinic/ui/components/menu";
import { cn } from "@clinic/ui/lib/cn";
import { changeLanguage, LANGUAGES } from "@web/i18n/language";
import { LANGUAGE_LABELS } from "@web/shared/constants/layout";

interface LanguageSwitchProps {
  readonly className?: string;
}

export function LanguageSwitch({ className }: LanguageSwitchProps): JSX.Element {
  const { t, i18n } = useTranslation();
  const base = i18n.language.split("-")[0];
  const current = LANGUAGES.find((language) => language === base) ?? LANGUAGES[0];

  return (
    <div className={className}>
      <Menu>
        <MenuTrigger
          data-testid="language-switch"
          aria-label={t("nav.language")}
          className={cn(
            "group inline-flex h-(--control-h) cursor-pointer items-center gap-2 rounded-panel px-3",
            "border border-line bg-surface text-label text-ink transition-colors duration-150",
            "hover:bg-primary-50 data-[state=open]:bg-primary-50",
          )}
        >
          <Icon name="globe" className="text-ink-subtle" />
          {LANGUAGE_LABELS[current]}
          <Icon
            name="chevron-down"
            className={cn(
              "text-ink-subtle transition-transform duration-150",
              "group-data-[state=open]:rotate-180",
            )}
          />
        </MenuTrigger>

        <MenuContent align="end" data-testid="language-switch-content">
          {LANGUAGES.map((language) => (
            <MenuItem
              key={language}
              data-testid={`language-switch-${language}`}
              icon={language === "ar" ? "language" : "globe"}
              onSelect={() => void changeLanguage(language)}
              {...(language === current && {
                trailing: <Icon name="check" className="text-primary-600" />,
              })}
            >
              {LANGUAGE_LABELS[language]}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
    </div>
  );
}
