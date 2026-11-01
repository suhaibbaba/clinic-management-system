import type { JSX } from "react";
import { LanguageMenu } from "@web/site/components/language-menu";
import { SiteIcon } from "@web/site/components/site-icon";
import { SocialLinks } from "@web/site/components/social-links";
import { useHoursText } from "@web/site/hooks/use-hours-text";
import { useSite } from "@web/site/hooks/use-site";
import { pick } from "@web/site/lib/text";

export function SiteTopBar(): JSX.Element {
  const { site, language } = useSite();
  const { clinic } = site;
  const hours = useHoursText();
  const tagline = pick(site.content.brand.tagline, language);

  return (
    <div
      data-testid="site-top-bar"
      className="bg-linear-to-l from-primary-900 to-primary-800 text-meta text-ink-inverse/85"
    >
      <div className="mx-auto flex min-h-12 max-w-6xl items-center gap-6 px-4 py-1.5">
        {tagline && (
          <p className="hidden min-w-0 items-center gap-2 truncate md:flex">
            <SiteIcon name="sparkles" className="size-4 text-primary-300" />
            {tagline}
          </p>
        )}
        <ul className="hidden items-center gap-5 md:flex">
          {hours && (
            <li className="flex items-center gap-1.5">
              <SiteIcon name="clock" className="size-4 text-primary-300" />
              <span>{hours.days}</span>
              <bdi className="tabular-nums">{hours.time}</bdi>
            </li>
          )}
          {clinic.phone && (
            <li>
              <a
                href={`tel:${clinic.phone}`}
                data-testid="site-top-bar-phone"
                className="flex items-center gap-1.5 hover:text-ink-inverse"
              >
                <SiteIcon name="phone" className="size-4 text-primary-300" />
                <bdi dir="ltr">{clinic.phone}</bdi>
              </a>
            </li>
          )}
          {clinic.address && (
            <li className="hidden max-w-64 items-center gap-1.5 lg:flex">
              <SiteIcon name="map-pin" className="size-4 text-primary-300" />
              <span className="truncate">{clinic.address}</span>
            </li>
          )}
        </ul>
        <span className="hidden md:block">
          <SocialLinks plain />
        </span>
        <span className="ms-auto">
          <LanguageMenu />
        </span>
      </div>
    </div>
  );
}
