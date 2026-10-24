import type { JSX, ReactNode } from "react";
import { cx } from "@web/booking/ui";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteLink } from "@web/site/components/site-link";

const TONES = {
  primary: "bg-primary-600 text-ink-inverse shadow-nav-active hover:bg-primary-700",
  dark: "bg-primary-900 text-ink-inverse shadow-nav-active hover:bg-primary-800",
  outline:
    "border border-primary-300 bg-surface text-primary-700 hover:border-primary-600 hover:bg-primary-50",
  inverse: "bg-surface text-primary-800 shadow-float hover:bg-primary-50",
} as const;

export function PillLink({
  to,
  params,
  children,
  tone = "primary",
  size = "md",
  arrow = true,
  className,
  "data-testid": testId,
}: {
  readonly to: string;
  readonly params?: Record<string, string>;
  readonly children: ReactNode;
  readonly tone?: keyof typeof TONES;
  readonly size?: "md" | "lg";
  readonly arrow?: boolean;
  readonly className?: string;
  readonly "data-testid"?: string;
}): JSX.Element {
  return (
    <SiteLink
      to={to}
      {...(params && { params })}
      data-testid={testId}
      className={cx(
        "pill-text group/pill inline-flex min-h-(--control-h) items-center justify-center gap-2.5 rounded-pill font-medium transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
        size === "lg" ? "px-8 text-field" : "px-5 text-label",
        TONES[tone],
        className,
      )}
    >
      {children}
      {arrow && (
        <SiteIcon
          name="arrow-end"
          className="transition-transform group-hover/pill:-translate-x-0.5 ltr:group-hover/pill:translate-x-0.5"
        />
      )}
    </SiteLink>
  );
}
