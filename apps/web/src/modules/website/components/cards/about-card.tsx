import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { DraftImage } from "@web/modules/website/components/draft-image";
import { DraftText } from "@web/modules/website/components/draft-text";
import { EditorCard } from "@web/modules/website/components/editor-card";
import { FeatureListField } from "@web/modules/website/components/feature-list-field";
import { StatsField } from "@web/modules/website/components/stats-field";
import { SITE_IMAGE_MIN_WIDTH } from "@web/modules/website/constants";
import { useEditor } from "@web/modules/website/hooks/use-editor";

export function AboutCard(): JSX.Element {
  const { t } = useTranslation();
  const { draft, update, errors, leave } = useEditor();

  return (
    <EditorCard id="about" title="website.cards.about" hint="website.cards.aboutHint">
      <DraftText path="about.eyebrow" label="website.fields.eyebrow" />
      <DraftText path="about.title" label="website.fields.title" />
      <DraftText path="about.subtitle" label="website.fields.subtitle" />
      <DraftText
        path="about.body"
        label="website.fields.body"
        multiline
        hint="website.fields.bodyHint"
      />
      <DraftImage
        path="about.image"
        label="website.fields.headerImage"
        minWidth={SITE_IMAGE_MIN_WIDTH.HERO}
      />

      <p className="text-value font-medium text-ink">{t("website.fields.pillars")}</p>
      <FeatureListField
        id="pillars"
        path="about.pillars"
        items={draft.about.pillars}
        errors={errors}
        leave={leave}
        withText
        onChange={(pillars) =>
          update((current) => ({ ...current, about: { ...current.about, pillars } }))
        }
      />
      <DraftText path="about.note" label="website.fields.note" />

      <StatsField />
      <DraftImage
        path="about.statsImage"
        label="website.fields.statsImage"
        minWidth={SITE_IMAGE_MIN_WIDTH.CARD}
      />

      <DraftText path="about.whyTitle" label="website.fields.whyTitle" />
      <FeatureListField
        id="values"
        path="about.values"
        items={draft.about.values}
        errors={errors}
        leave={leave}
        withText
        onChange={(values) =>
          update((current) => ({ ...current, about: { ...current.about, values } }))
        }
      />
      <DraftImage
        path="about.whyImage"
        label="website.fields.whyImage"
        minWidth={SITE_IMAGE_MIN_WIDTH.WIDE}
      />
      <DraftText path="about.whyBadge" label="website.fields.badge" />

      <DraftText path="about.quote.text" label="website.fields.quote" multiline />

      <DraftText path="about.cta.title" label="website.fields.ctaTitle" />
      <DraftText path="about.cta.subtitle" label="website.fields.ctaSubtitle" />
      <DraftImage
        path="about.cta.image"
        label="website.fields.ctaImage"
        minWidth={SITE_IMAGE_MIN_WIDTH.ICON}
      />
    </EditorCard>
  );
}
