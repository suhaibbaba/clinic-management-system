import { languageDefinition, languageScript } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@clinic/ui/components/icon";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@clinic/ui/components/menu";
import { cn } from "@clinic/ui/lib/cn";
import { changeLanguage, LANGUAGES, type Language } from "@web/i18n/language";

interface LanguageSwitchProps {
  readonly className?: string;
  readonly languages?: readonly Language[] | undefined;
}

export function LanguageSwitch({
  className,
  languages = LANGUAGES,
}: LanguageSwitchProps): JSX.Element {
  const { t, i18n } = useTranslation();
  const base = i18n.language.split("-")[0];
  const current = languages.find((language) => language === base) ?? languages[0] ?? LANGUAGES[0];

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
          {languageDefinition(current).nativeName}
          <Icon
            name="chevron-down"
            className={cn(
              "text-ink-subtle transition-transform duration-150",
              "group-data-[state=open]:rotate-180",
            )}
          />
        </MenuTrigger>

        <MenuContent align="end" data-testid="language-switch-content">
          {languages.map((language) => (
            <MenuItem
              key={language}
              data-testid={`language-switch-${language}`}
              icon={languageScript(language) === "arabic" ? "language" : "globe"}
              onSelect={() => void changeLanguage(language)}
              {...(language === current && {
                trailing: <Icon name="check" className="text-primary-600" />,
              })}
            >
              {languageDefinition(language).nativeName}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
    </div>
  );
}
