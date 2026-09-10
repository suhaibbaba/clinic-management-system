import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { cn } from '@web/lib/cn';
import { Ltr } from '@web/components/ui/ltr';

export interface TabDefinition<TId extends string> {
  readonly id: TId;
  /** i18n key. */
  readonly label: string;
  /** A count beside the label — how many rows the panel holds. */
  readonly count?: number | undefined;
}

export interface TabsProps<TId extends string> {
  readonly tabs: readonly TabDefinition<TId>[];
  readonly value: TId;
  readonly onChange: (id: TId) => void;
  /** i18n key naming the whole strip. */
  readonly label: string;
  readonly className?: string | undefined;
}

/**
 * A strip of tabs that switch panels.
 *
 * Deliberately not `SegmentedControl`, which looks almost identical and is a
 * radio group: a radio group announces "one of these choices", which is right
 * for a filter over one list and wrong for a set of panels. These are
 * `tablist`/`tab`/`tabpanel`, so a screen reader says which panel is showing
 * and how many there are.
 *
 * One scrolling row on a phone rather than a wrapping strip: one that wraps
 * to three ragged lines pushes the content a hundred pixels down the screen,
 * and a tab strip that scrolls sideways is what every mobile OS does.
 */
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
        // `self-start` as well as `inline-flex`: inside a column flex container
        // `align-items: stretch` would otherwise pull the strip to the full
        // width and draw it as a grey bar with the tabs bunched at one end.
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

/** The panel half of the pair, wired to the tab of the same id. */
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

/**
 * The open tab, kept in the URL.
 *
 * A tab that lives in `useState` is a tab nobody can link to, and this app
 * links to tabs from three directions: the dashboard's cards, the redirects
 * from the routes these tabs replaced, and anyone pasting an address to a
 * colleague. The URL is also what survives a refresh, which is what people do
 * when a screen looks stale.
 *
 * The first tab is the default and is written as *no* parameter rather than
 * `?tab=all`: the plain address has to keep working, and a redirect that adds
 * a parameter meaning "the default" is noise in everyone's history.
 */
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
