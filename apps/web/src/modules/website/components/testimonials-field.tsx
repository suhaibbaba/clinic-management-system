import { SITE_RATING_MAX, SITE_TESTIMONIALS_MAX, type SiteTestimonial } from "@clinic/shared";
import type { FocusEvent, JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, FormField, Icon, Input, Select } from "@clinic/ui";
import type { FieldErrors } from "@web/shared/lib/form-errors";
import { RowTools } from "@web/modules/website/components/row-tools";
import { TextPair } from "@web/modules/website/components/text-pair";
import { blankText, moveItem, removeAt, replaceAt } from "@web/modules/website/lib/site-draft";

const RATINGS = Array.from({ length: SITE_RATING_MAX }, (_, index) => SITE_RATING_MAX - index);

export function TestimonialsField({
  items,
  onChange,
  errors,
  leave,
}: {
  readonly items: readonly SiteTestimonial[];
  readonly onChange: (items: SiteTestimonial[]) => void;
  readonly errors: FieldErrors;
  readonly leave: (field: string) => (event: FocusEvent<HTMLElement>) => void;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <div data-testid="testimonials-field" className="flex flex-col gap-3">
      {items.length === 0 && (
        <p data-testid="testimonials-field-empty" className="text-label text-ink-muted">
          {t("website.testimonials.empty")}
        </p>
      )}

      {items.map((item, index) => {
        const namePath = `testimonials.items.${index}.name`;

        return (
          <div
            key={index}
            data-testid={`testimonials-field-${index}`}
            className="flex flex-col gap-3 rounded-panel border border-line bg-sunken p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="flex-1 text-label font-medium text-ink-muted">
                {t("website.testimonials.item", { number: index + 1 })}
              </p>
              <Select
                aria-label={t("website.testimonials.rating")}
                data-testid={`testimonials-field-${index}-rating`}
                className="w-36"
                value={String(item.rating)}
                options={RATINGS.map((rating) => ({
                  value: String(rating),
                  label: t("website.testimonials.stars", { count: rating }),
                }))}
                onChange={(event) =>
                  onChange(replaceAt(items, index, { ...item, rating: Number(event.target.value) }))
                }
              />
              <RowTools
                id={`testimonials-field-${index}`}
                index={index}
                count={items.length}
                onMove={(delta) => onChange(moveItem(items, index, delta))}
                onRemove={() => onChange(removeAt(items, index))}
              />
            </div>

            <div onBlur={leave(namePath)} className="max-w-(--field-max)">
              <FormField
                label="website.testimonials.name"
                htmlFor={`testimonial-${index}-name`}
                error={errors[namePath]}
                required
              >
                <Input
                  id={`testimonial-${index}-name`}
                  data-testid={`testimonials-field-${index}-name`}
                  value={item.name}
                  hasError={errors[namePath] !== undefined}
                  onChange={(event) =>
                    onChange(replaceAt(items, index, { ...item, name: event.target.value }))
                  }
                />
              </FormField>
            </div>

            <TextPair
              id={`testimonial-${index}-text`}
              label="website.testimonials.text"
              path={`testimonials.items.${index}.text`}
              value={item.text}
              errors={errors}
              leave={leave}
              multiline
              required
              onChange={(text) => onChange(replaceAt(items, index, { ...item, text }))}
            />
          </div>
        );
      })}

      {items.length < SITE_TESTIMONIALS_MAX && (
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          icon={<Icon name="plus" />}
          data-testid="testimonials-field-add"
          onClick={() =>
            onChange([...items, { name: "", text: blankText(), rating: SITE_RATING_MAX }])
          }
        >
          {t("website.testimonials.add")}
        </Button>
      )}
    </div>
  );
}
