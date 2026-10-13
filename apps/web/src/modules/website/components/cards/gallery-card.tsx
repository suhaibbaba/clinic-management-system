import { SITE_GALLERY_MAX } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { DraftText } from "@web/modules/website/components/draft-text";
import { EditorCard } from "@web/modules/website/components/editor-card";
import { SiteImageField } from "@web/modules/website/components/site-image-field";
import { SITE_IMAGE_MIN_WIDTH } from "@web/modules/website/constants";
import { useEditor } from "@web/modules/website/hooks/use-editor";
import { removeAt } from "@web/modules/website/lib/site-draft";

export function GalleryCard(): JSX.Element {
  const { t } = useTranslation();
  const { draft, update, images, remember } = useEditor();
  const photos = draft.gallery.images;

  return (
    <EditorCard id="gallery" title="website.cards.gallery" hint="website.cards.galleryHint">
      <DraftText path="gallery.eyebrow" label="website.fields.eyebrow" />
      <DraftText path="gallery.title" label="website.fields.title" />
      <DraftText path="gallery.body" label="website.fields.body" multiline />

      <div className="flex flex-col gap-3">
        {Array.from({ length: SITE_GALLERY_MAX }, (_, slot) => slot)
          .filter((slot) => slot <= photos.length)
          .map((slot) => {
            const key = photos[slot];

            return (
              <SiteImageField
                key={slot}
                id={`gallery-${slot + 1}`}
                label={t("website.fields.slide", { number: slot + 1 })}
                minWidth={SITE_IMAGE_MIN_WIDTH.CARD}
                hasImage={key !== undefined}
                url={key ? images[key] : undefined}
                onUpload={(next, url) => {
                  remember(next, url);
                  update((current) => {
                    const list = [...current.gallery.images];
                    list[slot] = next;

                    return { ...current, gallery: { ...current.gallery, images: list } };
                  });
                }}
                onRemove={() =>
                  update((current) => ({
                    ...current,
                    gallery: { ...current.gallery, images: removeAt(current.gallery.images, slot) },
                  }))
                }
              />
            );
          })}
      </div>
    </EditorCard>
  );
}
