import { SITE_GALLERY_MAX } from "@clinic/shared";
import type { JSX } from "react";
import { DraftText } from "@web/modules/website/components/draft-text";
import { ImageSlotsField } from "@web/modules/website/components/image-slots-field";
import { SITE_IMAGE_MIN_WIDTH } from "@web/modules/website/constants";

export function GalleryBlockForm(): JSX.Element {
  return (
    <div data-testid="gallery-block-form" className="flex flex-col gap-4">
      <DraftText path="eyebrow" label="website.fields.eyebrow" />
      <DraftText path="title" label="website.fields.title" />
      <DraftText path="body" label="website.fields.body" multiline />
      <ImageSlotsField field="images" max={SITE_GALLERY_MAX} minWidth={SITE_IMAGE_MIN_WIDTH.CARD} />
    </div>
  );
}
