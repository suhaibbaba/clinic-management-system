import { SITE_SOCIALS } from "@clinic/shared";
import type { JSX } from "react";
import { DraftLink } from "@web/modules/website/components/draft-link";
import { DraftText } from "@web/modules/website/components/draft-text";
import { EditorCard } from "@web/modules/website/components/editor-card";
import { SITE_SOCIAL_LABELS } from "@web/modules/website/constants";

export function BrandCard(): JSX.Element {
  return (
    <EditorCard id="brand" title="website.cards.brand" hint="website.cards.brandHint">
      <DraftText
        path="brand.tagline"
        label="website.fields.tagline"
        hint="website.fields.taglineHint"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {SITE_SOCIALS.map((name) => (
          <DraftLink
            key={name}
            path={`brand.social.${name}`}
            label={SITE_SOCIAL_LABELS[name]}
            placeholder="https://"
            adornment="globe"
          />
        ))}
      </div>
    </EditorCard>
  );
}
