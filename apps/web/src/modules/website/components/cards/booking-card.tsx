import type { JSX } from "react";
import { DraftImage } from "@web/modules/website/components/draft-image";
import { DraftText } from "@web/modules/website/components/draft-text";
import { EditorCard } from "@web/modules/website/components/editor-card";
import { SITE_IMAGE_MIN_WIDTH } from "@web/modules/website/constants";

export function BookingCard(): JSX.Element {
  return (
    <EditorCard id="booking" title="website.cards.booking" hint="website.cards.bookingHint">
      <DraftText path="booking.title" label="website.fields.title" />
      <DraftText path="booking.subtitle" label="website.fields.subtitle" />
      <DraftImage
        path="booking.image"
        label="website.fields.image"
        minWidth={SITE_IMAGE_MIN_WIDTH.CARD}
      />
    </EditorCard>
  );
}
