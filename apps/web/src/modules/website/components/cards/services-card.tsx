import type { JSX } from "react";
import { DraftImage } from "@web/modules/website/components/draft-image";
import { DraftText } from "@web/modules/website/components/draft-text";
import { EditorCard } from "@web/modules/website/components/editor-card";
import { ServicesField } from "@web/modules/website/components/services-field";
import { SITE_IMAGE_MIN_WIDTH } from "@web/modules/website/constants";
import { useEditor } from "@web/modules/website/hooks/use-editor";

export function ServicesCard(): JSX.Element {
  const { draft, update, images, remember, errors, leave } = useEditor();

  return (
    <EditorCard id="services" title="website.cards.services" hint="website.cards.servicesHint">
      <DraftText path="services.subtitle" label="website.fields.eyebrow" />
      <DraftText
        path="services.title"
        label="website.fields.title"
        placeholder="website.placeholders.servicesTitle"
      />
      <DraftText path="services.intro" label="website.fields.intro" multiline />
      <DraftImage
        path="services.image"
        label="website.fields.headerImage"
        minWidth={SITE_IMAGE_MIN_WIDTH.HERO}
      />
      <ServicesField
        items={draft.services.items}
        images={images}
        errors={errors}
        leave={leave}
        onImage={remember}
        onChange={(items) =>
          update((current) => ({ ...current, services: { ...current.services, items } }))
        }
      />
      <DraftText path="services.promo.title" label="website.fields.promo" />
      <DraftImage
        path="services.promo.image"
        label="website.fields.promoImage"
        minWidth={SITE_IMAGE_MIN_WIDTH.WIDE}
      />
    </EditorCard>
  );
}
