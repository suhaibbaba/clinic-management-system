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
        <div className="flex items-center gap-4">
          <span aria-hidden className="h-0.5 w-8 rounded-pill bg-primary-900/70 sm:w-14" />
          <h2 id={`${id}-title`} className="text-headline font-bold text-primary-900">
            {title}
          </h2>
          <span aria-hidden className="h-0.5 w-8 rounded-pill bg-primary-900/70 sm:w-14" />
        </div>
        {subtitle && <p className="text-section text-ink-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex justify-center md:justify-end">{action}</div>}
    </div>
  );
}
