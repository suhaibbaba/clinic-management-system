import type { JSX, ReactNode } from "react";
import { cx } from "@web/booking/ui";
import { Eyebrow } from "@web/site/components/eyebrow";
import { FooterSmile } from "@web/site/components/footer-curves";

export function SectionHeading({
  id,
  eyebrow,
  title,
  subtitle,
  align = "start",
  level = 2,
  children,
}: {
  readonly id: string;
  readonly eyebrow?: string | undefined;
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly align?: "start" | "center";
  readonly level?: 1 | 2;
  readonly children?: ReactNode;
}): JSX.Element {
  const Heading = level === 1 ? "h1" : "h2";
  const centered = align === "center";

  return (
    <div
      data-testid={`site-heading-${id}`}
      data-reveal
      className={cx(
        "flex max-w-2xl flex-col gap-2",
        centered ? "mx-auto items-center text-center" : "items-start",
      )}
    >
      {eyebrow && <Eyebrow align={align}>{eyebrow}</Eyebrow>}
      <Heading
        id={`${id}-title`}
        className={cx(
          "font-bold text-primary-900",
          level === 1 ? "text-hero" : "text-title md:text-headline",
        )}
      >
        {title}
      </Heading>
      <FooterSmile className="h-2.5 w-24 sm:h-3 sm:w-32" />
      {subtitle && <p className="text-section text-ink-muted">{subtitle}</p>}
      {children}
    </div>
  );
}
