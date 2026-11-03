import { type SITE_BLOCK_TYPE, SITE_HERO_IMAGES_MAX, type SiteBlockOf } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { FormField, Input } from "@clinic/ui";
import { DraftText } from "@web/modules/website/components/draft-text";
import { FeatureListField } from "@web/modules/website/components/feature-list-field";
import { ImageSlotsField } from "@web/modules/website/components/image-slots-field";
import { SITE_IMAGE_MIN_WIDTH } from "@web/modules/website/constants";
import { useEditor } from "@web/modules/website/hooks/use-editor";
import { useScoped } from "@web/modules/website/hooks/use-scoped";

export function HeroBlockForm(): JSX.Element {
  const { t } = useTranslation();
  const { errors, leave } = useEditor();
  const { value, path, set } = useScoped<SiteBlockOf<typeof SITE_BLOCK_TYPE.HERO>>();
  const statPath = path("stat.value");
  const statId = statPath.replaceAll(".", "-");

  return (
    <div data-testid="hero-block-form" className="flex flex-col gap-4">
      <DraftText path="eyebrow" label="website.fields.eyebrow" />
      <DraftText
        path="title"
        label="website.fields.title"
        hint="website.fields.heroTitleHint"
        multiline
      />
      <DraftText path="subtitle" label="website.fields.subtitle" multiline />
      <ImageSlotsField
        field="images"
        max={SITE_HERO_IMAGES_MAX}
        minWidth={SITE_IMAGE_MIN_WIDTH.HERO}
      />
      <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div onBlur={leave(statPath)}>
          <FormField
            label="website.fields.statValue"
            htmlFor={statId}
            error={errors[statPath]}
            optional
          >
            <Input
              id={statId}
              data-testid="hero-block-form-stat-value"
              dir="ltr"
              maxLength={12}
              placeholder="+5K"
              value={value.stat.value}
              onChange={(event) => set("stat.value", event.target.value)}
            />
          </FormField>
        </div>
        <DraftText path="stat.label" label="website.fields.statLabel" />
      </div>
      <p className="text-value font-medium text-ink">{t("website.editor.fields.highlights")}</p>
      <FeatureListField
        id="highlights"
        path={path("highlights")}
        items={value.highlights}
        errors={errors}
        leave={leave}
        onChange={(highlights) => set("highlights", highlights)}
      />
    </div>
  );
}
