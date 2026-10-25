import { SITE_CASES_MAX, type SiteCase } from "@clinic/shared";
import type { FocusEvent, JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, Icon } from "@clinic/ui";
import type { FieldErrors } from "@web/shared/lib/form-errors";
import { RowTools } from "@web/modules/website/components/row-tools";
import { SiteImageField } from "@web/modules/website/components/site-image-field";
import { TextPair } from "@web/modules/website/components/text-pair";
import { SITE_IMAGE_MIN_WIDTH } from "@web/modules/website/constants";
import { blankText, moveItem, removeAt, replaceAt } from "@web/modules/website/lib/site-draft";

const SIDES = ["before", "after"] as const;

export function CasesField({
  items,
  images,
  onChange,
  onImage,
  errors,
  leave,
}: {
  readonly items: readonly SiteCase[];
  readonly images: Readonly<Record<string, string>>;
  readonly onChange: (items: SiteCase[]) => void;
  readonly onImage: (key: string, url: string) => void;
  readonly errors: FieldErrors;
  readonly leave: (field: string) => (event: FocusEvent<HTMLElement>) => void;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <div data-testid="cases-field" className="flex flex-col gap-3">
      {items.length === 0 && (
        <p data-testid="cases-field-empty" className="text-label text-ink-muted">
          {t("website.cases.empty")}
        </p>
      )}

      {items.map((item, index) => (
        <div
          key={index}
          data-testid={`cases-field-${index}`}
          className="flex flex-col gap-3 rounded-panel border border-line bg-sunken p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-label font-medium text-ink-muted">
              {t("website.cases.item", { number: index + 1 })}
            </p>
            <RowTools
              id={`cases-field-${index}`}
              index={index}
              count={items.length}
              onMove={(delta) => onChange(moveItem(items, index, delta))}
              onRemove={() => onChange(removeAt(items, index))}
            />
          </div>

          <TextPair
            id={`case-${index}-title`}
            label="website.cases.title"
            path={`cases.items.${index}.title`}
            value={item.title}
            errors={errors}
            leave={leave}
            onChange={(title) => onChange(replaceAt(items, index, { ...item, title }))}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            {SIDES.map((side) => {
              const key = item[side];

              return (
                <SiteImageField
                  key={side}
                  id={`case-${index}-${side}`}
                  label={`website.cases.${side}`}
                  hasImage={key !== null}
                  url={key ? images[key] : undefined}
                  minWidth={SITE_IMAGE_MIN_WIDTH.CARD}
                  onUpload={(next, url) => {
                    onImage(next, url);
                    onChange(replaceAt(items, index, { ...item, [side]: next }));
                  }}
                  onRemove={() => onChange(replaceAt(items, index, { ...item, [side]: null }))}
                />
              );
            })}
          </div>
        </div>
      ))}

      {items.length < SITE_CASES_MAX && (
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          icon={<Icon name="plus" />}
          data-testid="cases-field-add"
          onClick={() => onChange([...items, { title: blankText(), before: null, after: null }])}
        >
          {t("website.cases.add")}
        </Button>
      )}
    </div>
  );
}
