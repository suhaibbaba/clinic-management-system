import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Select, Tabs, type TabDefinition } from "@clinic/ui";

export interface SectionViewsProps<TId extends string> {
  readonly "data-testid": string;
  readonly views: readonly TabDefinition<TId>[];
  readonly value: TId;
  readonly onChange: (id: TId) => void;
  /** Names the switcher for a screen reader. */
  readonly label: string;
}

/** One page, several screens: tabs where they fit, a picker on a phone where four did not. */
export function SectionViews<TId extends string>({
  views,
  value,
  onChange,
  label,
  "data-testid": testId,
}: SectionViewsProps<TId>): JSX.Element {
  const { t } = useTranslation();

  return (
    <>
      <div className="sm:hidden">
        <Select
          data-testid={`${testId}-picker`}
          aria-label={t(label)}
          value={value}
          options={views.map((view) => ({ value: view.id, label: t(view.label) }))}
          onChange={(event) => onChange(event.target.value as TId)}
        />
      </div>

      <div className="hidden sm:block">
        <Tabs data-testid={testId} tabs={views} value={value} onChange={onChange} label={label} />
      </div>
    </>
  );
}
