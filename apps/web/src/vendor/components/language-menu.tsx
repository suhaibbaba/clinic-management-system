import { languageDefinition } from "@clinic/shared";
import { Icon } from "@clinic/ui/components/icon";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@clinic/ui/components/menu";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { changeVendorLanguage, VENDOR_LANGUAGES } from "@web/vendor/i18n";

export function LanguageMenu(): JSX.Element {
  const { t, i18n } = useTranslation();

  return (
    <Menu>
      <MenuTrigger
        aria-label={t("vendor.nav.language")}
        className="flex min-h-(--control-h) cursor-pointer items-center gap-2 rounded-control border border-line bg-surface px-3 text-label text-ink hover:border-primary-600"
        data-testid="vendor-language"
      >
        <Icon name="globe" className="size-4 text-ink-muted" />
        {languageDefinition(i18n.language).nativeName}
        <Icon name="chevron-down" className="size-4 text-ink-muted" />
      </MenuTrigger>
      <MenuContent align="end">
        {VENDOR_LANGUAGES.map((language) => (
          <MenuItem
            key={language}
            icon="language"
            onSelect={() => changeVendorLanguage(language)}
            trailing={
              i18n.language === language ? <Icon name="check" className="size-4" /> : undefined
            }
          >
            {languageDefinition(language).nativeName}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
