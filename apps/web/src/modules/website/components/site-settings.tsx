import { setPageEnabled, type PublicSiteDoctor } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Switch } from "@clinic/ui";
import { BrandCard } from "@web/modules/website/components/cards/brand-card";
import { DoctorsCollectionForm } from "@web/modules/website/components/doctors-collection-form";
import { DraftImage } from "@web/modules/website/components/draft-image";
import { DraftText } from "@web/modules/website/components/draft-text";
import { EditorCard } from "@web/modules/website/components/editor-card";
import { EditorScope } from "@web/modules/website/components/editor-scope";
import { PagesField } from "@web/modules/website/components/pages-field";
import { ServicesCollectionForm } from "@web/modules/website/components/services-collection-form";
import {
  DOCTORS_COLLECTION_PATH,
  SERVICES_COLLECTION_PATH,
  SITE_IMAGE_MIN_WIDTH,
} from "@web/modules/website/constants";
import { useEditor } from "@web/modules/website/hooks/use-editor";

export function SiteSettings({
  doctors,
  bookingAvailable,
}: {
  readonly doctors: readonly PublicSiteDoctor[];
  readonly bookingAvailable: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const { draft, update } = useEditor();

  return (
    <div data-testid="site-settings" className="flex flex-col gap-5">
      <EditorCard
        id="pages"
        title="website.editor.settings.pages"
        hint="website.editor.settings.pagesHint"
      >
        <PagesField
          pages={draft.pages}
          bookingAvailable={bookingAvailable}
          onChange={(kind, enabled) => update((current) => setPageEnabled(current, kind, enabled))}
        />
        <Switch
          data-testid="site-settings-portal"
          checked={draft.portal}
          label={t("website.sections.portal")}
          onCheckedChange={(portal) => update((current) => ({ ...current, portal }))}
        />
      </EditorCard>
      <BrandCard />
      <EditorCard
        id="booking-band"
        title="website.editor.settings.bookingBand"
        hint="website.editor.settings.bookingBandHint"
      >
        <DraftText path="bookingBand.title" label="website.fields.ctaTitle" />
        <DraftText path="bookingBand.subtitle" label="website.fields.ctaSubtitle" />
        <DraftImage
          path="bookingBand.image"
          label="website.fields.ctaImage"
          minWidth={SITE_IMAGE_MIN_WIDTH.ICON}
        />
      </EditorCard>
      <EditorCard id="services" title="website.cards.services" hint="website.cards.servicesHint">
        <EditorScope path={SERVICES_COLLECTION_PATH} root>
          <ServicesCollectionForm />
        </EditorScope>
      </EditorCard>
      <EditorCard id="doctors" title="website.cards.doctors" hint="website.cards.doctorsHint">
        <EditorScope path={DOCTORS_COLLECTION_PATH} root>
          <DoctorsCollectionForm doctors={doctors} />
        </EditorScope>
      </EditorCard>
    </div>
  );
}
