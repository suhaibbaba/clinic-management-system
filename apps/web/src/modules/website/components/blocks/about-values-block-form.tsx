import { type SITE_BLOCK_TYPE, type SiteBlockOf } from "@clinic/shared";
import type { JSX } from "react";
import { DraftImage } from "@web/modules/website/components/draft-image";
import { DraftText } from "@web/modules/website/components/draft-text";
import { FeatureListField } from "@web/modules/website/components/feature-list-field";
import { SITE_IMAGE_MIN_WIDTH } from "@web/modules/website/constants";
import { useEditor } from "@web/modules/website/hooks/use-editor";
import { useScoped } from "@web/modules/website/hooks/use-scoped";
import { MODAL_FORM_GRID } from "@web/modules/website/constants";

export function AboutValuesBlockForm(): JSX.Element {
  const { errors, leave } = useEditor();
  const { value, path, set } = useScoped<SiteBlockOf<typeof SITE_BLOCK_TYPE.ABOUT_VALUES>>();

  return (
    <div data-testid="about-values-block-form" className={MODAL_FORM_GRID}>
      <DraftText path="title" label="website.fields.whyTitle" />
      <FeatureListField
        id="values"
        path={path("values")}
        items={value.values}
        errors={errors}
        leave={leave}
        withText
        onChange={(values) => set("values", values)}
      />
      <DraftImage
        path="image"
        label="website.fields.whyImage"
        minWidth={SITE_IMAGE_MIN_WIDTH.WIDE}
      />
      <DraftText path="badge" label="website.fields.badge" />
    </div>
  );
}
