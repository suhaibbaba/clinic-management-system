import { SITE_HERO_IMAGES_MAX } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { FormField, Input } from "@clinic/ui";
import { DraftText } from "@web/modules/website/components/draft-text";
import { EditorCard } from "@web/modules/website/components/editor-card";
import { SiteImageField } from "@web/modules/website/components/site-image-field";
import { SITE_IMAGE_MIN_WIDTH } from "@web/modules/website/constants";
import { useEditor } from "@web/modules/website/hooks/use-editor";
import { removeAt } from "@web/modules/website/lib/site-draft";

export function HeroCard(): JSX.Element {
  const { t } = useTranslation();
  const { draft, update, images, remember, errors, leave } = useEditor();
  const slides = draft.hero.images;

  return (
    <EditorCard id="hero" title="website.cards.hero" hint="website.cards.heroHint">
      <DraftText
        path="hero.title"
        label="website.fields.title"
        hint="website.fields.heroTitleHint"
      />
      <DraftText path="hero.subtitle" label="website.fields.subtitle" multiline />

      <div className="flex flex-col gap-3">
        {Array.from({ length: SITE_HERO_IMAGES_MAX }, (_, slot) => slot)
          .filter((slot) => slot <= slides.length)
          .map((slot) => {
            const key = slides[slot];

            return (
              <SiteImageField
                key={slot}
                id={`hero-${slot + 1}`}
                label={t("website.fields.slide", { number: slot + 1 })}
                minWidth={SITE_IMAGE_MIN_WIDTH.HERO}
                hasImage={key !== undefined}
                url={key ? images[key] : undefined}
                onUpload={(next, url) => {
                  remember(next, url);
                  update((current) => {
                    const list = [...current.hero.images];
                    list[slot] = next;

                    return { ...current, hero: { ...current.hero, images: list } };
                  });
                }}
                onRemove={() =>
                  update((current) => ({
                    ...current,
                    hero: { ...current.hero, images: removeAt(current.hero.images, slot) },
                  }))
                }
              />
            );
          })}
      </div>

      <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div onBlur={leave("hero.stat.value")}>
          <FormField
            label="website.fields.statValue"
            htmlFor="hero-stat-value"
            error={errors["hero.stat.value"]}
            optional
          >
            <Input
              id="hero-stat-value"
              data-testid="website-hero-stat-value"
              dir="ltr"
              maxLength={12}
              placeholder="+5K"
              value={draft.hero.stat.value}
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  hero: {
                    ...current.hero,
                    stat: { ...current.hero.stat, value: event.target.value },
                  },
                }))
              }
            />
          </FormField>
        </div>
        <DraftText path="hero.stat.label" label="website.fields.statLabel" />
      </div>
    </EditorCard>
  );
}
