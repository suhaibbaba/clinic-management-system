import { SITE_RATING_MAX } from "@clinic/shared";
import type { JSX } from "react";
import { cx } from "@web/booking/ui";
import { ShowcaseHeading } from "@web/site/components/showcase-heading";
import { CardFill } from "@web/site/components/card-fill";
import { SiteIcon } from "@web/site/components/site-icon";
import { Slider } from "@web/site/components/slider";
import { useSite } from "@web/site/hooks/use-site";
import { orDefault, pick } from "@web/site/lib/text";

export function TestimonialsSection(): JSX.Element | null {
  const { site, language, t } = useSite();
  const { testimonials } = site.content;

  if (testimonials.items.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="site-testimonials"
      aria-labelledby="testimonials-title"
      className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-14"
    >
      <ShowcaseHeading
        id="testimonials"
        title={orDefault(testimonials.title, language, t("testimonials.title"))}
        subtitle={pick(testimonials.subtitle, language)}
      />
      <Slider
        label={t("testimonials.title")}
        item="w-[85%] sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]"
        data-testid="site-testimonials-carousel"
      >
        {testimonials.items.map((item, position) => (
          <figure
            key={position}
            data-testid={`site-testimonial-${position + 1}`}
            className="group relative isolate flex h-full flex-col gap-4 overflow-hidden rounded-card border border-line bg-surface p-5 shadow-card transition-colors duration-300 hover:border-primary-700"
          >
            <CardFill />
            <SiteIcon name="quote" className="size-7 text-primary-200" />
            <blockquote className="site-fill-soft flex-1 text-value text-ink-muted">
              {pick(item.text, language)}
            </blockquote>
            <figcaption className="flex items-center justify-between gap-3">
              <span className="site-fill-ink text-section font-bold text-primary-900">
                {item.name}
              </span>
              <span
                role="img"
                aria-label={t("testimonials.rating", { count: item.rating, max: SITE_RATING_MAX })}
                className="flex gap-0.5"
              >
                {Array.from({ length: SITE_RATING_MAX }, (_, star) => (
                  <SiteIcon
                    key={star}
                    name="star"
                    className={cx(
                      "size-4",
                      star < item.rating ? "fill-warning-500 text-warning-500" : "text-line",
                    )}
                  />
                ))}
              </span>
            </figcaption>
          </figure>
        ))}
      </Slider>
    </section>
  );
}
