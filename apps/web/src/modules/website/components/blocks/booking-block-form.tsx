import type { JSX } from "react";
import { DraftImage } from "@web/modules/website/components/draft-image";
import { DraftText } from "@web/modules/website/components/draft-text";
import { SITE_IMAGE_MIN_WIDTH } from "@web/modules/website/constants";
import { MODAL_FORM_GRID } from "@web/modules/website/constants";

export function BookingBlockForm(): JSX.Element {
  return (
    <div data-testid="booking-block-form" className={MODAL_FORM_GRID}>
      <DraftText path="title" label="website.fields.title" />
      <DraftText path="subtitle" label="website.fields.subtitle" />
      <DraftImage path="image" label="website.fields.image" minWidth={SITE_IMAGE_MIN_WIDTH.CARD} />
    </div>
  );
}
