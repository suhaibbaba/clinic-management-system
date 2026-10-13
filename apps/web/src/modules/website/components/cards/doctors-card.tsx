import type { PublicSiteDoctor } from "@clinic/shared";
import type { JSX } from "react";
import { DoctorsField } from "@web/modules/website/components/doctors-field";
import { DraftImage } from "@web/modules/website/components/draft-image";
import { DraftText } from "@web/modules/website/components/draft-text";
import { EditorCard } from "@web/modules/website/components/editor-card";
import { FeatureListField } from "@web/modules/website/components/feature-list-field";
import { SITE_IMAGE_MIN_WIDTH } from "@web/modules/website/constants";
import { useEditor } from "@web/modules/website/hooks/use-editor";

export function DoctorsCard({
  doctors,
}: {
  readonly doctors: readonly PublicSiteDoctor[];
}): JSX.Element {
  const { draft, update, errors, leave } = useEditor();

  return (
    <EditorCard id="doctors" title="website.cards.doctors" hint="website.cards.doctorsHint">
      <DraftText path="doctors.title" label="website.fields.title" />
      <DraftText path="doctors.subtitle" label="website.fields.subtitle" />
      <DraftImage
        path="doctors.image"
        label="website.fields.headerImage"
        minWidth={SITE_IMAGE_MIN_WIDTH.HERO}
      />
      <FeatureListField
        id="doctor-features"
        path="doctors.features"
        items={draft.doctors.features}
        errors={errors}
        leave={leave}
        onChange={(features) =>
          update((current) => ({ ...current, doctors: { ...current.doctors, features } }))
        }
      />
      <DoctorsField doctors={doctors} />
      <DraftText path="doctors.promo.title" label="website.fields.promo" />
      <DraftImage
        path="doctors.promo.image"
        label="website.fields.promoImage"
        minWidth={SITE_IMAGE_MIN_WIDTH.WIDE}
      />
    </EditorCard>
  );
}
