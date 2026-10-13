import type { SiteSection } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Switch } from "@clinic/ui";
import { RowTools } from "@web/modules/website/components/row-tools";
import { SITE_SECTION_LABELS } from "@web/modules/website/constants";
import { moveItem, sectionOrder, setSectionVisible } from "@web/modules/website/lib/site-draft";

export function SectionsField({
  visible,
  onChange,
}: {
  readonly visible: readonly SiteSection[];
  readonly onChange: (visible: SiteSection[]) => void;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <ul data-testid="sections-field" className="flex flex-col divide-y divide-line">
      {sectionOrder(visible).map((section) => {
        const shown = visible.includes(section);
        const index = visible.indexOf(section);

        return (
          <li
            key={section}
            data-testid={`sections-field-${section}`}
            className="flex items-center justify-between gap-3 py-2"
          >
            <Switch
              data-testid={`sections-field-${section}-switch`}
              checked={shown}
              label={t(SITE_SECTION_LABELS[section])}
              onCheckedChange={(checked) => onChange(setSectionVisible(visible, section, checked))}
            />
            {shown && (
              <RowTools
                id={`sections-field-${section}`}
                index={index}
                count={visible.length}
                onMove={(delta) => onChange(moveItem(visible, index, delta))}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
