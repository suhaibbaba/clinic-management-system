import type { JSX, ReactNode } from "react";
import { cx } from "@web/booking/ui";
import { AccentRule } from "@web/site/components/accent-rule";

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
      {eyebrow && <p className="text-section font-medium text-primary-600">{eyebrow}</p>}
      <Heading
        id={`${id}-title`}
        className="text-title font-bold text-primary-900 md:text-headline"
      >
        {title}
      </Heading>
      {subtitle && <p className="text-section text-ink-muted">{subtitle}</p>}
      <AccentRule className="mt-2" />
      {children}
    </div>
  );
}
