import type { JSX } from "react";
import { InfoStrip } from "@web/site/components/info-strip";
import { SiteLink } from "@web/site/components/site-link";
import { SiteLogo } from "@web/site/components/site-logo";
import { SocialLinks } from "@web/site/components/social-links";
import { useSite } from "@web/site/hooks/use-site";
import { nameIn, pick } from "@web/site/lib/text";

export function SiteFooter(): JSX.Element {
  const { site, language, t, page } = useSite();
  const name = nameIn(site.clinic.name, language);
  const motto = pick(site.content.brand.motto, language);

  return (
    <footer data-testid="site-footer" className="bg-primary-50">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 pt-6 pb-8 text-center">
        <SiteLink to="/" className="flex max-w-full min-w-0 justify-center">
          <SiteLogo url={site.clinic.logoUrl} name={name} size="footer" />
        </SiteLink>
        {motto && <p className="text-heading font-bold text-primary-900">{motto}</p>}
        {page.kind !== "home" && <InfoStrip compact />}
        <SocialLinks />
      </div>
      <p className="border-t border-primary-100 px-4 py-4 text-center text-meta text-ink-subtle">
        {t("footer.rights", { year: new Date().getFullYear(), name })}
      </p>
    </footer>
  );
}
