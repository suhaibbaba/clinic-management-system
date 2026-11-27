import { SITE_SOCIALS } from "@clinic/shared";
import type { JSX } from "react";
import { cx } from "@web/booking/ui";
import { SocialIcon } from "@web/site/components/social-icon";
import { useSite } from "@web/site/hooks/use-site";

const TONES = {
  plain: {
    testId: "site-social-plain",
    list: "gap-1",
    link: "size-(--control-h-sm) text-ink-inverse/85 hover:bg-ink-inverse/10 hover:text-ink-inverse",
  },
  outline: {
    testId: "site-social",
    list: "gap-4",
    link: "size-(--control-h) border border-ink-inverse text-ink-inverse hover:bg-surface hover:text-primary-700",
  },
} as const;

export function SocialLinks({ tone }: { readonly tone: keyof typeof TONES }): JSX.Element | null {
  const { siteDocument, t } = useSite();
  const links = SITE_SOCIALS.filter((name) => siteDocument.brand.social[name] !== "");
  const { testId, list, link } = TONES[tone];

  if (links.length === 0) {
    return null;
  }

  return (
    <ul
      aria-label={t("footer.social")}
      data-testid={testId}
      className={cx("flex items-center", list)}
    >
      {links.map((name) => (
        <li key={name}>
          <a
            href={siteDocument.brand.social[name]}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={t(`footer.socials.${name}`)}
            data-testid={`${testId}-${name}`}
            className={cx("inline-flex items-center justify-center rounded-pill", link)}
          >
            <SocialIcon name={name} />
          </a>
        </li>
      ))}
    </ul>
  );
}
