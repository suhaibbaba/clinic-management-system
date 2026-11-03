import type { SiteDocument } from "@clinic/shared";
import type { JSX } from "react";
import { DraftImage } from "@web/modules/website/components/draft-image";
import { DraftText } from "@web/modules/website/components/draft-text";
import { ServicesField } from "@web/modules/website/components/services-field";
import { SITE_IMAGE_MIN_WIDTH } from "@web/modules/website/constants";
import { useEditor } from "@web/modules/website/hooks/use-editor";
import { useScoped } from "@web/modules/website/hooks/use-scoped";

export function ServicesCollectionForm(): JSX.Element {
  const { images, remember, errors, leave } = useEditor();
  const { value, path, set } = useScoped<SiteDocument["collections"]["services"]>();

  return (
    <div data-testid="services-collection-form" className="flex flex-col gap-4">
      <ServicesField
        path={path("items")}
        items={value.items}
        images={images}
        errors={errors}
        leave={leave}
        onImage={remember}
        onChange={(items) => set("items", items)}
      />
      <DraftText path="promo.title" label="website.fields.promo" />
      <DraftImage
        path="promo.image"
        label="website.fields.promoImage"
        minWidth={SITE_IMAGE_MIN_WIDTH.WIDE}
      />
    </div>
  );
}
