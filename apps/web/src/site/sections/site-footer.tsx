import type { JSX } from "react";
import { InfoStrip } from "@web/site/components/info-strip";
import { SiteLink } from "@web/site/components/site-link";
import { SiteLogo } from "@web/site/components/site-logo";
import { SocialLinks } from "@web/site/components/social-links";
import { useSite } from "@web/site/hooks/use-site";
import { nameIn, pick } from "@web/site/lib/text";

export function SiteFooter(): JSX.Element {
  const { site, language, t } = useSite();
  const name = nameIn(site.clinic.name, language);
  const tagline = pick(site.content.brand.tagline, language);

  return (
    <footer data-testid="site-footer" className="bg-primary-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex shrink-0 flex-col items-start gap-2">
          <SiteLink to="/">
            <SiteLogo url={site.clinic.logoUrl} name={name} size="footer" />
          </SiteLink>
          {tagline && <span className="text-meta text-primary-600">{tagline}</span>}
        </div>
        <InfoStrip compact />
        <SocialLinks />
      </div>
      <p className="border-t border-primary-100 px-4 py-4 text-center text-meta text-ink-subtle">
        {t("footer.rights", { year: new Date().getFullYear(), name })}
      </p>
    </footer>
  );
}
