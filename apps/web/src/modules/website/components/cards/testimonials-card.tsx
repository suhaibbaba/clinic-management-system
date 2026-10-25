import type { JSX } from "react";
import { DraftText } from "@web/modules/website/components/draft-text";
import { EditorCard } from "@web/modules/website/components/editor-card";
import { TestimonialsField } from "@web/modules/website/components/testimonials-field";
import { useEditor } from "@web/modules/website/hooks/use-editor";

export function TestimonialsCard(): JSX.Element {
  const { draft, update, errors, leave } = useEditor();

  return (
    <EditorCard
      id="testimonials"
      title="website.cards.testimonials"
      hint="website.cards.testimonialsHint"
    >
      <DraftText path="testimonials.title" label="website.fields.title" />
      <DraftText path="testimonials.subtitle" label="website.fields.subtitle" />
      <TestimonialsField
        items={draft.testimonials.items}
        errors={errors}
        leave={leave}
        onChange={(items) =>
          update((current) => ({ ...current, testimonials: { ...current.testimonials, items } }))
        }
      />
    </EditorCard>
  );
}
