import { SITE_FEATURES_MAX, SITE_ICONS, type SiteFeature, type SiteIcon } from "@clinic/shared";
import type { FocusEvent, JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, Icon, Select } from "@clinic/ui";
import type { FieldErrors } from "@web/shared/lib/form-errors";
import { RowTools } from "@web/modules/website/components/row-tools";
import { TextPair } from "@web/modules/website/components/text-pair";
import { SITE_ICON_GLYPHS } from "@web/modules/website/constants";
import { blankText, moveItem, removeAt, replaceAt } from "@web/modules/website/lib/site-draft";

export function FeatureListField({
  id,
  path,
  items,
  onChange,
  errors,
  leave,
  withText = false,
}: {
  readonly id: string;
  readonly path: string;
  readonly items: readonly SiteFeature[];
  readonly onChange: (items: SiteFeature[]) => void;
  readonly errors: FieldErrors;
  readonly leave: (field: string) => (event: FocusEvent<HTMLElement>) => void;
  readonly withText?: boolean;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <div data-testid={`feature-list-${id}`} className="flex flex-col gap-3">
      {items.map((item, index) => (
        <div
          key={index}
          data-testid={`feature-list-${id}-${index}`}
          className="flex flex-col gap-3 rounded-panel border border-line bg-sunken p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <Select
              aria-label={t("website.feature.icon")}
              data-testid={`feature-list-${id}-${index}-icon`}
              className="w-48"
              value={item.icon}
              options={SITE_ICONS.map((icon) => ({
                value: icon,
                label: t(`website.icons.${icon}`),
                icon: <Icon name={SITE_ICON_GLYPHS[icon]} />,
              }))}
              onChange={(event) =>
                onChange(replaceAt(items, index, { ...item, icon: event.target.value as SiteIcon }))
              }
            />
            <RowTools
              id={`feature-list-${id}-${index}`}
              index={index}
              count={items.length}
              onMove={(delta) => onChange(moveItem(items, index, delta))}
              onRemove={() => onChange(removeAt(items, index))}
            />
          </div>
          <TextPair
            id={`${id}-${index}-label`}
            label="website.feature.label"
            path={`${path}.${index}.label`}
            value={item.label}
            errors={errors}
            leave={leave}
            required
            onChange={(label) => onChange(replaceAt(items, index, { ...item, label }))}
          />
          {withText && (
            <TextPair
              id={`${id}-${index}-text`}
              label="website.feature.text"
              path={`${path}.${index}.text`}
              value={item.text}
              errors={errors}
              leave={leave}
              multiline
              onChange={(text) => onChange(replaceAt(items, index, { ...item, text }))}
            />
          )}
        </div>
      ))}

      {items.length < SITE_FEATURES_MAX && (
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          icon={<Icon name="plus" />}
          data-testid={`feature-list-${id}-add`}
          onClick={() =>
            onChange([...items, { icon: "sparkles", label: blankText(), text: blankText() }])
          }
        >
          {t("website.feature.add")}
        </Button>
      )}
    </div>
  );
}
