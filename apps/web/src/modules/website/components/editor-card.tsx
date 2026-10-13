import type { JSX, ReactNode } from "react";
import { useTranslation } from "react-i18next";

export function EditorCard({
  id,
  title,
  hint,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly hint?: string;
  readonly children: ReactNode;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <section
      data-testid={`website-card-${id}`}
      aria-labelledby={`website-card-${id}-title`}
      className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 shadow-card"
    >
      <div>
        <h2 id={`website-card-${id}-title`} className="text-section font-medium text-ink">
          {t(title)}
        </h2>
        {hint && <p className="mt-0.5 text-label text-ink-muted">{t(hint)}</p>}
      </div>
      {children}
    </section>
  );
}
