import type { JSX, ReactNode } from "react";

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
        {eyebrow && <p className="text-section font-medium text-primary-600">{eyebrow}</p>}
        <h2 id={`${id}-title`} className="text-title font-bold text-primary-900 md:text-headline">
          {title}
        </h2>
        {subtitle && <p className="text-section text-ink-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex justify-center md:justify-end">{action}</div>}
    </div>
  );
}
