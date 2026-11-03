import { type SITE_BLOCK_TYPE, type SiteBlockOf } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Switch } from "@clinic/ui";
import { DraftImage } from "@web/modules/website/components/draft-image";
import { DraftText } from "@web/modules/website/components/draft-text";
import { FeatureListField } from "@web/modules/website/components/feature-list-field";
import { SITE_IMAGE_MIN_WIDTH } from "@web/modules/website/constants";
import { useEditor } from "@web/modules/website/hooks/use-editor";
import { useScoped } from "@web/modules/website/hooks/use-scoped";
import { MODAL_FORM_GRID } from "@web/modules/website/constants";

export function PageHeroBlockForm(): JSX.Element {
  const { t } = useTranslation();
  const { errors, leave } = useEditor();
  const { value, path, set } = useScoped<SiteBlockOf<typeof SITE_BLOCK_TYPE.PAGE_HERO>>();

  return (
    <div data-testid="page-hero-block-form" className={MODAL_FORM_GRID}>
      <DraftText path="eyebrow" label="website.fields.eyebrow" />
      <DraftText path="title" label="website.fields.title" />
      <DraftText path="subtitle" label="website.fields.subtitle" />
      <DraftText path="intro" label="website.fields.intro" multiline />
      <DraftImage
        path="image"
        label="website.fields.headerImage"
        minWidth={SITE_IMAGE_MIN_WIDTH.HERO}
      />
      <Switch
        data-testid="page-hero-block-form-tagline"
        checked={value.tagline}
        label={t("website.editor.fields.showTagline")}
        onCheckedChange={(tagline) => set("tagline", tagline)}
      />
      <p className="text-value font-medium text-ink">{t("website.editor.fields.features")}</p>
      <FeatureListField
        id="page-hero-features"
        path={path("features")}
        items={value.features}
        errors={errors}
        leave={leave}
        onChange={(features) => set("features", features)}
      />
    </div>
  );
}
