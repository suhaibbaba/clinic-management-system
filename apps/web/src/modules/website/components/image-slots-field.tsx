import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { SiteImageField } from "@web/modules/website/components/site-image-field";
import { useEditor } from "@web/modules/website/hooks/use-editor";
import { useScoped } from "@web/modules/website/hooks/use-scoped";
import { removeAt, valueAt } from "@web/modules/website/lib/site-draft";

export function ImageSlotsField({
  field,
  max,
  minWidth,
}: {
  readonly field: string;
  readonly max: number;
  readonly minWidth: number;
}): JSX.Element {
  const { t } = useTranslation();
  const { images, remember } = useEditor();
  const { value, path, set } = useScoped<unknown>();
  const slots = (valueAt(value, field) as readonly string[] | undefined) ?? [];
  const id = path(field).replaceAll(".", "-");

  return (
    <div data-testid={`image-slots-${id}`} className="flex flex-col gap-3">
      {Array.from({ length: max }, (_, slot) => slot)
        .filter((slot) => slot <= slots.length)
        .map((slot) => {
          const key = slots[slot];

          return (
            <SiteImageField
              key={slot}
              id={`${id}-${slot + 1}`}
              label={t("website.fields.slide", { number: slot + 1 })}
              minWidth={minWidth}
              hasImage={key !== undefined}
              url={key ? images[key] : undefined}
              onUpload={(next, url) => {
                remember(next, url);
                const list = [...slots];
                list[slot] = next;
                set(field, list);
              }}
              onRemove={() => set(field, removeAt(slots, slot))}
            />
          );
        })}
    </div>
  );
}
