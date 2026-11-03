import type { SITE_BLOCK_TYPE, SiteBlockOf } from "@clinic/shared";
import type { JSX } from "react";
import { SiteIcon } from "@web/site/components/site-icon";
import { useSite } from "@web/site/hooks/use-site";
import { pick } from "@web/site/lib/text";

export function AboutPillarsBlock({
  block,
}: {
  readonly block: SiteBlockOf<typeof SITE_BLOCK_TYPE.ABOUT_PILLARS>;
}): JSX.Element | null {
  const { language, languages } = useSite();
  const note = pick(block.note, language, languages);

  if (block.pillars.length === 0 && !note) {
    return null;
  }

  return (
    <section
      data-testid="site-pillars"
      data-reveal
      className="grid items-center gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]"
    >
      {note && (
        <p className="flex items-center gap-4 text-title font-bold text-primary-900">
          <span aria-hidden className="flex flex-col items-center gap-2 text-primary-600">
            <SiteIcon name="sparkles" className="size-5" />
            <span className="h-12 w-0.5 rounded-pill bg-primary-500" />
          </span>
          {note}
        </p>
      )}
      <ul className="grid gap-8 sm:grid-cols-3 sm:divide-x sm:divide-line lg:col-start-2">
        {block.pillars.map((pillar, position) => (
          <li key={position} className="flex flex-col items-center gap-2 px-4 text-center">
            <SiteIcon name={pillar.icon} className="size-10 text-primary-600" />
            <h2 className="text-heading font-bold text-primary-900">
              {pick(pillar.label, language, languages)}
            </h2>
            {pick(pillar.text, language, languages) && (
              <p className="text-label text-ink-muted">{pick(pillar.text, language, languages)}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
