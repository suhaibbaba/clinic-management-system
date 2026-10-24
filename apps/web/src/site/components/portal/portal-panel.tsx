import type { JSX, ReactNode } from "react";

export function PortalPanel({
  title,
  empty,
  children,
  "data-testid": testId,
}: {
  readonly title: string;
  readonly empty: string;
  readonly children: ReactNode;
  readonly "data-testid": string;
}): JSX.Element {
  const hasContent = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <section
      data-testid={testId}
      className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5 shadow-card"
    >
      <h3 className="text-heading font-bold text-primary-900">{title}</h3>
      {hasContent ? (
        <ul className="flex flex-col divide-y divide-line">{children}</ul>
      ) : (
        <p className="text-value text-ink-muted">{empty}</p>
      )}
    </section>
  );
}
