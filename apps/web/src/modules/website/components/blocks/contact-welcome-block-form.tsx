import type { JSX } from "react";
import { DraftImage } from "@web/modules/website/components/draft-image";
import { DraftText } from "@web/modules/website/components/draft-text";
import { SITE_IMAGE_MIN_WIDTH } from "@web/modules/website/constants";

export function ContactWelcomeBlockForm(): JSX.Element {
  return (
    <div data-testid="contact-welcome-block-form" className="flex flex-col gap-4">
      <DraftText path="title" label="website.fields.welcome" />
      <DraftText path="body" label="website.fields.welcomeBody" />
      <DraftImage
        path="image"
        label="website.fields.welcomeImage"
        minWidth={SITE_IMAGE_MIN_WIDTH.CARD}
      />
    </div>
  );
}
