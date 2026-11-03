import { type SITE_BLOCK_TYPE, type SiteBlockOf } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { DraftImage } from "@web/modules/website/components/draft-image";
import { DraftText } from "@web/modules/website/components/draft-text";
import { FeatureListField } from "@web/modules/website/components/feature-list-field";
import { SITE_IMAGE_MIN_WIDTH } from "@web/modules/website/constants";
import { useEditor } from "@web/modules/website/hooks/use-editor";
import { useScoped } from "@web/modules/website/hooks/use-scoped";
import { MODAL_FORM_GRID } from "@web/modules/website/constants";

export function AboutPillarsBlockForm(): JSX.Element {
  const { t } = useTranslation();
  const { errors, leave } = useEditor();
  const { value, path, set } = useScoped<SiteBlockOf<typeof SITE_BLOCK_TYPE.ABOUT_PILLARS>>();

  return (
    <div data-testid="about-pillars-block-form" className={MODAL_FORM_GRID}>
      <p className="text-value font-medium text-ink">{t("website.fields.pillars")}</p>
      <FeatureListField
        id="pillars"
        path={path("pillars")}
        items={value.pillars}
        errors={errors}
        leave={leave}
        withText
        onChange={(pillars) => set("pillars", pillars)}
      />
      <DraftText path="note" label="website.editor.fields.pillarsNote" />
      <DraftText path="quote.text" label="website.fields.quote" multiline />
      <DraftImage
        path="quote.image"
        label="website.editor.fields.quoteImage"
        minWidth={SITE_IMAGE_MIN_WIDTH.CARD}
      />
    </div>
  );
}
