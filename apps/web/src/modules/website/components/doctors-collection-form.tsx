import type { PublicSiteDoctor } from "@clinic/shared";
import type { JSX } from "react";
import { DoctorsField } from "@web/modules/website/components/doctors-field";
import { DraftImage } from "@web/modules/website/components/draft-image";
import { DraftText } from "@web/modules/website/components/draft-text";
import { SITE_IMAGE_MIN_WIDTH } from "@web/modules/website/constants";

export function DoctorsCollectionForm({
  doctors,
}: {
  readonly doctors: readonly PublicSiteDoctor[];
}): JSX.Element {
  return (
    <div data-testid="doctors-collection-form" className="flex flex-col gap-4">
      <DoctorsField doctors={doctors} />
      <DraftText path="promo.title" label="website.fields.promo" />
      <DraftImage
        path="promo.image"
        label="website.fields.promoImage"
        minWidth={SITE_IMAGE_MIN_WIDTH.WIDE}
      />
    </div>
  );
}
