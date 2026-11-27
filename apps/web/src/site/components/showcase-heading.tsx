import type { JSX, ReactNode } from "react";
import { Eyebrow } from "@web/site/components/eyebrow";
import { FooterSmile } from "@web/site/components/footer-curves";

export function ShowcaseHeading({
  id,
  eyebrow,
  title,
  subtitle,
  action,
}: {
  readonly id: string;
  readonly eyebrow?: string | undefined;
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly action?: ReactNode;
}): JSX.Element {
  return (
    <div
      data-testid={`site-heading-${id}`}
      data-reveal
      className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]"
    >
      <div className="flex flex-col items-center gap-1.5 text-center md:col-start-2">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 id={`${id}-title`} className="text-title font-bold text-primary-900 md:text-headline">
          {title}
        </h2>
        <FooterSmile className="h-2.5 w-24 sm:h-3 sm:w-32" />
        {subtitle && <p className="text-section text-ink-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex justify-center md:justify-end">{action}</div>}
    </div>
  );
}
