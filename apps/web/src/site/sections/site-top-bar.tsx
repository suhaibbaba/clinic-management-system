import type { JSX } from "react";
import { cx } from "@web/booking/ui";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteLanguageMenu } from "@web/site/components/site-language-menu";
import { SocialLinks } from "@web/site/components/social-links";
import { useHoursText } from "@web/site/hooks/use-hours-text";
import { useSite } from "@web/site/hooks/use-site";
import { pick } from "@web/site/lib/text";

export function SiteTopBar(): JSX.Element {
  const { site, language, languages } = useSite();
  const tagline = pick(site.content.brand.tagline, language, languages);
  const hours = useHoursText();
  const address = site.clinic.address;

  return (
    <div data-testid="site-top-bar" className="bg-primary-900 text-meta text-ink-inverse/85">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-1">
        {address ? (
          <p className="hidden min-w-0 items-center gap-2 md:flex">
            <SiteIcon name="map-pin" className="size-4 shrink-0 text-primary-300" />
            <span className="truncate">{address}</span>
          </p>
        ) : (
          tagline && (
            <p className="hidden min-w-0 items-center gap-2 truncate md:flex">
              <SiteIcon name="sparkles" className="size-4 text-primary-300" />
              {tagline}
            </p>
          )
        )}
        {hours && (
          <p
            data-testid="site-top-bar-hours"
            className="mx-auto hidden min-w-0 items-center gap-2 lg:flex"
          >
            <SiteIcon name="clock" className="size-4 shrink-0 text-primary-300" />
            <span className="truncate">
              {hours.days}
              <span aria-hidden className="mx-2 text-ink-inverse/40">
                |
              </span>
              <bdi className="tabular-nums">{hours.time}</bdi>
            </span>
          </p>
        )}
        <div className={cx("ms-auto hidden md:block", hours && "lg:ms-0")}>
          <SocialLinks plain />
        </div>
        <div className="ms-auto md:ms-0">
          <SiteLanguageMenu />
        </div>
      </div>
    </div>
  );
}
