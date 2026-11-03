import type { JSX } from "react";
import { DraftText } from "@web/modules/website/components/draft-text";
import { MODAL_FORM_GRID } from "@web/modules/website/constants";

export function HeadingBlockForm(): JSX.Element {
  return (
    <div data-testid="heading-block-form" className={MODAL_FORM_GRID}>
      <DraftText path="title" label="website.fields.title" />
      <DraftText path="subtitle" label="website.fields.subtitle" />
    </div>
  );
}
