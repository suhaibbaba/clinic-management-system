import type { SiteFeature } from "@clinic/shared";
import type { JSX } from "react";
import { SiteIcon } from "@web/site/components/site-icon";
import { useSite } from "@web/site/hooks/use-site";
import { pick } from "@web/site/lib/text";

export function PageHeroFeatures({
  features,
}: {
  readonly features: readonly SiteFeature[];
}): JSX.Element | null {
  const { language, languages } = useSite();

  if (features.length === 0) {
    return null;
  }

  return (
    <ul className="mt-4 grid w-full auto-cols-fr grid-flow-col gap-4 lg:flex lg:w-auto lg:flex-wrap lg:gap-x-10 lg:gap-y-4">
      {features.map((feature, position) => (
        <li key={position} className="flex min-w-0 flex-col items-center gap-2 text-center">
          <SiteIcon name={feature.icon} className="size-8 text-primary-600" />
          <span className="text-label font-medium text-balance wrap-break-word text-primary-900">
            {pick(feature.label, language, languages)}
          </span>
        </li>
      ))}
    </ul>
  );
}
