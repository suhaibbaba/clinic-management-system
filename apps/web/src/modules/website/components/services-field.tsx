import { SITE_SERVICES_MAX, chartGlyph, type SiteService } from "@clinic/shared";
import type { FocusEvent, JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, Icon } from "@clinic/ui";
import type { FieldErrors } from "@web/shared/lib/form-errors";
import { useSession } from "@web/shared/providers/session";
import { IconSelect } from "@web/modules/website/components/icon-select";
import { RowTools } from "@web/modules/website/components/row-tools";
import { SiteImageField } from "@web/modules/website/components/site-image-field";
import { TextPair } from "@web/modules/website/components/text-pair";
import { SITE_IMAGE_MIN_WIDTH } from "@web/modules/website/constants";
import {
  blankText,
  moveItem,
  newItemId,
  removeAt,
  replaceAt,
} from "@web/modules/website/lib/site-draft";

export function ServicesField({
  items,
  images,
  onChange,
  onImage,
  errors,
  leave,
}: {
  readonly items: readonly SiteService[];
  readonly images: Readonly<Record<string, string>>;
  readonly onChange: (items: SiteService[]) => void;
  readonly onImage: (key: string, url: string) => void;
  readonly errors: FieldErrors;
  readonly leave: (field: string) => (event: FocusEvent<HTMLElement>) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const glyph = chartGlyph(user?.clinic.chartTypes ?? []) ?? "stethoscope";

  return (
    <div data-testid="services-field" className="flex flex-col gap-3">
      {items.length === 0 && (
        <p data-testid="services-field-empty" className="text-label text-ink-muted">
          {t("website.services.empty")}
        </p>
      )}

      {items.map((item, index) => (
        <div
          key={item.id}
          data-testid={`services-field-${item.id}`}
          className="flex flex-col gap-3 rounded-panel border border-line bg-sunken p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="flex-1 text-label font-medium text-ink-muted">
              {t("website.services.item", { number: index + 1 })}
            </p>
            <IconSelect
              data-testid={`services-field-${item.id}-icon`}
              value={item.icon}
              onChange={(icon) => onChange(replaceAt(items, index, { ...item, icon }))}
            />
            <RowTools
              id={`services-field-${item.id}`}
              index={index}
              count={items.length}
              onMove={(delta) => onChange(moveItem(items, index, delta))}
              onRemove={() => onChange(removeAt(items, index))}
            />
          </div>

          <TextPair
            id={`service-${item.id}-title`}
            label="website.services.name"
            path={`services.items.${index}.title`}
            value={item.title}
            errors={errors}
            leave={leave}
            required
            onChange={(title) => onChange(replaceAt(items, index, { ...item, title }))}
          />

          <TextPair
            id={`service-${item.id}-description`}
            label="website.services.description"
            path={`services.items.${index}.description`}
            value={item.description}
            errors={errors}
            leave={leave}
            multiline
            onChange={(description) => onChange(replaceAt(items, index, { ...item, description }))}
          />

          <SiteImageField
            id={`service-${item.id}`}
            label="website.services.image"
            hasImage={item.image !== null}
            url={item.image ? images[item.image] : undefined}
            width={80}
            height={80}
            minWidth={SITE_IMAGE_MIN_WIDTH.ICON}
            onUpload={(key, url) => {
              onImage(key, url);
              onChange(replaceAt(items, index, { ...item, image: key }));
            }}
            onRemove={() => onChange(replaceAt(items, index, { ...item, image: null }))}
          />
        </div>
      ))}

      {items.length < SITE_SERVICES_MAX && (
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          icon={<Icon name="plus" />}
          data-testid="services-field-add"
          onClick={() =>
            onChange([
              ...items,
              {
                id: newItemId(),
                title: blankText(),
                description: blankText(),
                image: null,
                icon: glyph,
              },
            ])
          }
        >
          {t("website.services.add")}
        </Button>
      )}
    </div>
  );
}
