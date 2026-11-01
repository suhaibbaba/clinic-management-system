import type { JSX } from "react";
import { CompareCard } from "@web/site/components/compare-card";
import { ShowcaseHeading } from "@web/site/components/showcase-heading";
import { Slider } from "@web/site/components/slider";
import { useSite } from "@web/site/hooks/use-site";
import { completeCases } from "@web/site/lib/showcase";
import { orDefault, pick } from "@web/site/lib/text";

export function CasesSection(): JSX.Element | null {
  const { site, language, languages, t } = useSite();
  const { cases } = site.content;
  const items = completeCases(site);

  if (items.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="site-cases"
      aria-labelledby="cases-title"
      className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-14"
    >
      <ShowcaseHeading
        id="cases"
        title={orDefault(cases.title, language, t("cases.title"), languages)}
        subtitle={pick(cases.subtitle, language, languages)}
      />
      <Slider
        label={t("cases.title")}
        item="w-[80%] sm:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-4rem)/5)]"
        data-testid="site-cases-carousel"
      >
        {items.map((item, position) => (
          <CompareCard
            key={position}
            before={item.before}
            after={item.after}
            title={pick(item.title, language, languages)}
            data-testid={`site-case-${position + 1}`}
          />
        ))}
      </Slider>
    </section>
  );
}
