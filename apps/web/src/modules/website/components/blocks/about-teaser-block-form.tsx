import type { JSX } from "react";
import { DraftImage } from "@web/modules/website/components/draft-image";
import { DraftText } from "@web/modules/website/components/draft-text";
import { StatsField } from "@web/modules/website/components/stats-field";
import { SITE_IMAGE_MIN_WIDTH } from "@web/modules/website/constants";

export function AboutTeaserBlockForm(): JSX.Element {
  return (
    <div data-testid="about-teaser-block-form" className="flex flex-col gap-4">
      <DraftText path="eyebrow" label="website.fields.eyebrow" />
      <DraftText path="title" label="website.fields.title" />
      <DraftText path="body" label="website.fields.body" multiline hint="website.fields.bodyHint" />
      <DraftText path="badge" label="website.fields.badge" />
      <DraftImage path="image" label="website.fields.image" minWidth={SITE_IMAGE_MIN_WIDTH.WIDE} />
      <DraftImage
        path="storyImage"
        label="website.editor.fields.storyImage"
        minWidth={SITE_IMAGE_MIN_WIDTH.WIDE}
      />
      <StatsField />
      <DraftImage
        path="statsImage"
        label="website.fields.statsImage"
        minWidth={SITE_IMAGE_MIN_WIDTH.CARD}
      />
    </div>
  );
}
