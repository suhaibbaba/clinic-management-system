import type { JSX } from "react";
import { cx } from "@web/booking/ui";
import { AccentRule } from "@web/site/components/accent-rule";
import { useSite } from "@web/site/hooks/use-site";
import { pick } from "@web/site/lib/text";

export function Tagline({
  tone = "brand",
  className,
}: {
  readonly tone?: "brand" | "inverse";
  readonly className?: string;
}): JSX.Element | null {
  const { site, language } = useSite();
  const tagline = pick(site.content.brand.tagline, language);

  if (!tagline) {
    return null;
  }

  return (
    <p
      data-testid="site-tagline"
      className={cx(
        "flex max-w-36 flex-col gap-3 text-meta font-medium tracking-[0.22em] uppercase",
        tone === "inverse" ? "text-ink-inverse/85" : "text-primary-500",
        className,
      )}
    >
      {tagline}
      <AccentRule className={cx("w-8", tone === "inverse" && "bg-ink-inverse/70")} />
    </p>
  );
}
