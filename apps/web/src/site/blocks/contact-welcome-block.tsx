import type { SITE_BLOCK_TYPE, SiteBlockOf } from "@clinic/shared";
import type { JSX } from "react";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import { Tagline } from "@web/site/components/tagline";
import { useHoursText } from "@web/site/hooks/use-hours-text";
import { useSite } from "@web/site/hooks/use-site";
import { imageOf } from "@web/site/lib/images";
import { orDefault, pick } from "@web/site/lib/text";

export function ContactWelcomeBlock({
  block,
}: {
  readonly block: SiteBlockOf<typeof SITE_BLOCK_TYPE.CONTACT_WELCOME>;
}): JSX.Element {
  const { site, language, languages, t } = useSite();
  const hours = useHoursText();

  return (
    <div
      data-testid="site-welcome"
      data-reveal
      className="site-panel-wash grid items-stretch overflow-hidden rounded-card shadow-card md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.1fr)]"
    >
      <div className="flex flex-col justify-center gap-2 p-6 md:p-8">
        <h2 className="text-title font-bold text-primary-900 md:text-headline">
          {orDefault(block.title, language, t("contact.welcome"), languages)}
        </h2>
        {pick(block.body, language, languages) && (
          <p className="text-value text-ink-muted">{pick(block.body, language, languages)}</p>
        )}
      </div>
      {hours && (
        <div className="flex items-center gap-4 p-6 md:p-8">
          <span className="inline-flex size-16 shrink-0 items-center justify-center rounded-pill border border-primary-200 bg-surface text-primary-600 shadow-card">
            <SiteIcon name="clock" className="size-7" />
          </span>
          <div className="flex flex-col items-start gap-0.5">
            <p className="text-heading font-bold text-primary-900">{t("contact.hours")}</p>
            <bdi className="text-label text-ink-muted tabular-nums">{hours.time}</bdi>
            <p className="text-label text-ink-muted">{hours.days}</p>
          </div>
        </div>
      )}
      <div className="relative min-h-48">
        <SiteImage src={imageOf(site, block.image)} layer className="site-fade-start" />
        <Tagline className="absolute end-5 top-5" />
      </div>
    </div>
  );
}
