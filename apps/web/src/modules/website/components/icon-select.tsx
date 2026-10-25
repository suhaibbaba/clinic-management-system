import { SITE_ICONS, type SiteIcon } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Icon, Select } from "@clinic/ui";
import { SITE_ICON_GLYPHS } from "@web/modules/website/constants";

export function IconSelect({
  value,
  onChange,
  "data-testid": testId,
}: {
  readonly value: SiteIcon;
  readonly onChange: (icon: SiteIcon) => void;
  readonly "data-testid": string;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <Select
      aria-label={t("website.feature.icon")}
      data-testid={testId}
      className="w-48"
      value={value}
      options={SITE_ICONS.map((icon) => ({
        value: icon,
        label: t(`website.icons.${icon}`),
        icon: <Icon name={SITE_ICON_GLYPHS[icon]} />,
      }))}
      onChange={(event) => onChange(event.target.value as SiteIcon)}
    />
  );
}
