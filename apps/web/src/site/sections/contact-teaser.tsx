import { SITE_SECTION } from "@clinic/shared";
import type { JSX } from "react";
import { ContactCards } from "@web/site/components/contact-cards";
import { PillLink } from "@web/site/components/pill-link";
import { SectionHeading } from "@web/site/components/section-heading";
import { useSite } from "@web/site/hooks/use-site";
import { orDefault } from "@web/site/lib/text";
import { SITE_PATH } from "@web/site/route";

export function ContactTeaser(): JSX.Element | null {
  const { site, language, t } = useSite();
  const { contact } = site.content;

  if (!site.content.sections.includes(SITE_SECTION.CONTACT)) {
    return null;
  }

  return (
    <section data-testid="site-contact-teaser" className="site-wash">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-14">
        <SectionHeading
          id="contact-teaser"
          align="center"
          eyebrow={t("nav.contact")}
          title={orDefault(contact.subtitle, language, t("contact.subtitleDefault"))}
        />
        <ContactCards />
        <PillLink
          to={SITE_PATH.CONTACT}
          tone="outline"
          className="self-center"
          data-testid="site-contact-more"
        >
          {t("home.contactLink")}
        </PillLink>
      </div>
    </section>
  );
}
