import type { JSX } from "react";
import { DraftText } from "@web/modules/website/components/draft-text";

export function HeadingBlockForm(): JSX.Element {
  return (
    <div data-testid="heading-block-form" className="flex flex-col gap-4">
      <DraftText path="title" label="website.fields.title" />
      <DraftText path="subtitle" label="website.fields.subtitle" />
    </div>
  );
}
