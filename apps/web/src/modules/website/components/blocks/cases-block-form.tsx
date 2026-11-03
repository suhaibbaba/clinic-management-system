import { type SITE_BLOCK_TYPE, type SiteBlockOf } from "@clinic/shared";
import type { JSX } from "react";
import { CasesField } from "@web/modules/website/components/cases-field";
import { DraftText } from "@web/modules/website/components/draft-text";
import { useEditor } from "@web/modules/website/hooks/use-editor";
import { useScoped } from "@web/modules/website/hooks/use-scoped";
import { MODAL_FORM_GRID } from "@web/modules/website/constants";

export function CasesBlockForm(): JSX.Element {
  const { images, remember, errors, leave } = useEditor();
  const { value, path, set } = useScoped<SiteBlockOf<typeof SITE_BLOCK_TYPE.CASES>>();

  return (
    <div data-testid="cases-block-form" className={MODAL_FORM_GRID}>
      <DraftText path="title" label="website.fields.title" />
      <DraftText path="subtitle" label="website.fields.subtitle" />
      <CasesField
        path={path("items")}
        items={value.items}
        images={images}
        errors={errors}
        leave={leave}
        onImage={remember}
        onChange={(items) => set("items", items)}
      />
    </div>
  );
}
