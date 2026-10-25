import type { JSX } from "react";
import { CasesField } from "@web/modules/website/components/cases-field";
import { DraftText } from "@web/modules/website/components/draft-text";
import { EditorCard } from "@web/modules/website/components/editor-card";
import { useEditor } from "@web/modules/website/hooks/use-editor";

export function CasesCard(): JSX.Element {
  const { draft, update, images, remember, errors, leave } = useEditor();

  return (
    <EditorCard id="cases" title="website.cards.cases" hint="website.cards.casesHint">
      <DraftText path="cases.title" label="website.fields.title" />
      <DraftText path="cases.subtitle" label="website.fields.subtitle" />
      <CasesField
        items={draft.cases.items}
        images={images}
        errors={errors}
        leave={leave}
        onImage={remember}
        onChange={(items) =>
          update((current) => ({ ...current, cases: { ...current.cases, items } }))
        }
      />
    </EditorCard>
  );
}
