import type { SITE_BLOCK_TYPE, SiteBlockOf } from "@clinic/shared";
import type { JSX } from "react";
import { AccentRule } from "@web/site/components/accent-rule";
import { SiteIcon } from "@web/site/components/site-icon";
import { useSite } from "@web/site/hooks/use-site";
import { orDefault, pick } from "@web/site/lib/text";

export function AboutValuesBlock({
  block,
}: {
  readonly block: SiteBlockOf<typeof SITE_BLOCK_TYPE.ABOUT_VALUES>;
}): JSX.Element | null {
  const { language, languages, t } = useSite();

  if (block.values.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="site-why"
      aria-labelledby="why-title"
      className="flex flex-col items-center gap-8"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 id="why-title" className="text-headline font-bold text-primary-900">
          {orDefault(block.title, language, t("about.why"), languages)}
        </h2>
        <AccentRule className="mt-1" />
      </div>
      <ul
        data-reveal-group
        className="grid w-full grid-cols-1 gap-y-5 rounded-card border border-line/70 bg-surface p-5 shadow-float sm:grid-cols-2 md:p-7 lg:grid-cols-4 lg:divide-x lg:divide-line"
      >
        {block.values.map((value, position) => {
          const text = pick(value.text, language, languages);

          return (
            <li key={position} className="flex items-center gap-4 lg:px-5">
              <span className="inline-flex size-16 shrink-0 items-center justify-center rounded-pill bg-primary-50 text-primary-700">
                <SiteIcon name={value.icon} className="size-7" />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="text-section font-bold text-primary-900">
                  {pick(value.label, language, languages)}
                </h3>
                {text && <span className="text-label text-ink-muted">{text}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
