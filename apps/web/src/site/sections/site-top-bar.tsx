import type { JSX } from "react";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteLanguageMenu } from "@web/site/components/site-language-menu";
import { SocialLinks } from "@web/site/components/social-links";
import { useSite } from "@web/site/hooks/use-site";
import { pick } from "@web/site/lib/text";

export function SiteTopBar(): JSX.Element {
  const { site, language } = useSite();
  const tagline = pick(site.content.brand.tagline, language);

  return (
    <div data-testid="site-top-bar" className="bg-primary-900 text-meta text-ink-inverse/85">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-1">
        {tagline && (
          <p className="hidden min-w-0 items-center gap-2 truncate md:flex">
            <SiteIcon name="sparkles" className="size-4 text-primary-300" />
            {tagline}
          </p>
        )}
        <div className="ms-auto hidden md:block">
          <SocialLinks plain />
        </div>
        <div className="ms-auto md:ms-0">
          <SiteLanguageMenu />
        </div>
      </div>
    </div>
  );
}
