import { type SITE_BLOCK_TYPE, type SiteBlockOf } from "@clinic/shared";
import type { JSX } from "react";
import { DraftText } from "@web/modules/website/components/draft-text";
import { TestimonialsField } from "@web/modules/website/components/testimonials-field";
import { useEditor } from "@web/modules/website/hooks/use-editor";
import { useScoped } from "@web/modules/website/hooks/use-scoped";
import { MODAL_FORM_GRID } from "@web/modules/website/constants";

export function TestimonialsBlockForm(): JSX.Element {
  const { errors, leave } = useEditor();
  const { value, path, set } = useScoped<SiteBlockOf<typeof SITE_BLOCK_TYPE.TESTIMONIALS>>();

  return (
    <div data-testid="testimonials-block-form" className={MODAL_FORM_GRID}>
      <DraftText path="title" label="website.fields.title" />
      <DraftText path="subtitle" label="website.fields.subtitle" />
      <TestimonialsField
        path={path("items")}
        items={value.items}
        errors={errors}
        leave={leave}
        onChange={(items) => set("items", items)}
      />
    </div>
  );
}
