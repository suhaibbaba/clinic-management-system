import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { cn } from '@web/lib/cn';
import { Ltr } from '@web/components/ui/ltr';

export interface TabDefinition<TId extends string> {
  readonly id: TId;
  readonly label: string;
  readonly count?: number | undefined;
}

export interface TabsProps<TId extends string> {
  readonly tabs: readonly TabDefinition<TId>[];
  readonly value: TId;
  readonly onChange: (id: TId) => void;
  readonly label: string;
  readonly className?: string | undefined;
}

// Not `SegmentedControl`, which is a radio group: that announces "one of these choices", right for
// a filter and wrong for a set of panels.
export function Tabs<TId extends string>({
  tabs,
  value,
  onChange,
  label,
  className,
}: TabsProps<TId>): JSX.Element {
  const { t } = useTranslation();

  return (
    <div
      role="tablist"
      aria-label={t(label)}
      className={cn(
        'flex items-center gap-1 rounded-control border border-line bg-inset p-1',
        'max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        // `self-start` as well as `inline-flex`: in a column flex container `align-items: stretch`
        // would draw the strip as a full-width grey bar.
        'sm:inline-flex sm:flex-wrap sm:self-start sm:overflow-visible',
        className,
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.id === value;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={cn(
              'inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-1.5',
              'rounded-control px-3 py-1.5 lg:min-h-0 lg:min-w-0',
              'text-value font-medium',
              'transition-[background-color,color,box-shadow,transform] duration-150 active:scale-95',
              selected
                ? 'bg-surface text-ink shadow-pill'
                : 'text-ink-muted hover:bg-surface/60 hover:text-ink',
            )}
          >
            {t(tab.label)}
            {tab.count !== undefined && tab.count > 0 && (
              <Ltr
                className={cn(
                  'min-w-5 rounded-pill px-1.5 text-meta font-semibold tabular-nums',
                  selected ? 'bg-inset text-ink-muted' : 'bg-surface text-ink-subtle',
                )}
              >
                {tab.count}
              </Ltr>
            )}
          </button>
        );
      })}
    </div>
  );
}

export interface TabPanelProps {
  readonly id: string;
  readonly children: ReactNode;
  readonly className?: string | undefined;
}

export function TabPanel({ id, children, className }: TabPanelProps): JSX.Element {
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      className={cn('min-w-0', className)}
    >
      {children}
    </div>
  );
}

// A tab in `useState` is a tab nobody can link to, and three things link here. The first tab is
// written as no parameter, so the plain address keeps working.
export function useTabParam<TId extends string>(
  param: string,
  ids: readonly TId[],
  fallback: TId,
): readonly [TId, (id: TId) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get(param);
  // An unknown value is treated as absent rather than as an error: a stale
  // bookmark should land on the page, not on a blank panel.
  const active = ids.find((id) => id === raw) ?? fallback;

  const setActive = (id: TId): void => {
    const next = new URLSearchParams(params);

    if (id === fallback) {
      next.delete(param);
    } else {
      next.set(param, id);
    }

    setParams(next, { replace: true });
  };

  return [active, setActive];
}
