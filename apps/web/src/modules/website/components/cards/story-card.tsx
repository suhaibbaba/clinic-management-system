import type { JSX } from "react";
import { DraftImage } from "@web/modules/website/components/draft-image";
import { DraftText } from "@web/modules/website/components/draft-text";
import { EditorCard } from "@web/modules/website/components/editor-card";
import { FeatureListField } from "@web/modules/website/components/feature-list-field";
import { SITE_IMAGE_MIN_WIDTH } from "@web/modules/website/constants";
import { useEditor } from "@web/modules/website/hooks/use-editor";

export function StoryCard(): JSX.Element {
  const { draft, update, errors, leave } = useEditor();

  return (
    <EditorCard id="story" title="website.cards.story" hint="website.cards.storyHint">
      <DraftText path="story.eyebrow" label="website.fields.eyebrow" />
      <DraftText path="story.title" label="website.fields.title" />
      <DraftText path="story.badge" label="website.fields.badge" />
      <DraftImage
        path="story.image"
        label="website.fields.image"
        minWidth={SITE_IMAGE_MIN_WIDTH.WIDE}
      />
      <FeatureListField
        id="highlights"
        path="highlights"
        items={draft.highlights}
        errors={errors}
        leave={leave}
        onChange={(highlights) => update((current) => ({ ...current, highlights }))}
      />
    </EditorCard>
  );
}
