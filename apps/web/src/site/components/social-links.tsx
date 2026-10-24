import { SITE_SOCIALS, type SiteSocial } from "@clinic/shared";
import type { JSX } from "react";
import { cx } from "@web/booking/ui";
import { SocialIcon } from "@web/site/components/social-icon";
import { useSite } from "@web/site/hooks/use-site";

const BRAND: Record<SiteSocial, string> = {
  instagram: "bg-social-instagram",
  facebook: "bg-social-facebook",
  whatsapp: "bg-social-whatsapp",
  youtube: "bg-social-youtube",
};

export function SocialLinks({ plain = false }: { readonly plain?: boolean }): JSX.Element | null {
  const { site, t } = useSite();
  const links = SITE_SOCIALS.filter((name) => site.content.brand.social[name] !== "");

  if (links.length === 0) {
    return null;
  }

  return (
    <ul
      aria-label={t("footer.social")}
      data-testid={plain ? "site-social-plain" : "site-social"}
      className={cx("flex items-center", plain ? "gap-1" : "gap-2")}
    >
      {links.map((name) => (
        <li key={name}>
          <a
            href={site.content.brand.social[name]}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={t(`footer.socials.${name}`)}
            data-testid={`${plain ? "site-social-plain" : "site-social"}-${name}`}
            className={
              plain
                ? "inline-flex size-(--control-h-sm) items-center justify-center rounded-pill text-ink-inverse/85 hover:bg-ink-inverse/10 hover:text-ink-inverse"
                : cx(
                    "inline-flex size-(--control-h) items-center justify-center rounded-pill text-ink-inverse shadow-float",
                    "transition-[translate,box-shadow,filter] duration-200 hover:-translate-y-0.5 hover:shadow-card-hover hover:brightness-110",
                    BRAND[name],
                  )
            }
          >
            <SocialIcon name={name} />
          </a>
        </li>
      ))}
    </ul>
  );
}
