import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { StatRow } from '@web/components/ui/stat-card';
import type { Column } from '@web/components/ui/table';
import { cn } from '@web/lib/cn';

export function Skeleton({ className }: { readonly className?: string }): JSX.Element {
  return <span aria-hidden="true" className={cn('skeleton block rounded-pill', className)} />;
}

export function SkeletonStatus(): JSX.Element {
  const { t } = useTranslation();

  return (
    <span role="status" className="sr-only">
      {t('common.loading')}
    </span>
  );
}

/** Data already on screen stays there; this says the next page of it is on its way. */
export function RefreshBar({ active }: { readonly active: boolean }): JSX.Element | null {
  const { t } = useTranslation();

  if (!active) {
    return null;
  }

  return (
    <div role="status" aria-live="polite" className="px-4 pt-3">
      <span className="sr-only">{t('common.updating')}</span>
      <Skeleton className="h-0.5 w-full rounded-none" />
    </div>
  );
}

const CELL_WIDTHS = ['w-28', 'w-20', 'w-32', 'w-24'] as const;

const cellWidth = (index: number): string => CELL_WIDTHS[index % CELL_WIDTHS.length] ?? 'w-24';

const endAligned = (align: Column<never>['align']): boolean =>
  align === 'numeric' || align === 'end';

/** The caller's own columns, so every bar sits at the width its data will occupy. */
export function SkeletonTable<TRow>({
  columns,
  rows = 5,
}: {
  readonly columns: readonly Column<TRow>[];
  readonly rows?: number;
}): JSX.Element {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row} aria-hidden="true">
          {columns.map((column, index) => (
            <td key={column.key} className={cn('px-4 py-3 align-middle', column.className)}>
              <Skeleton
                className={cn('h-3', cellWidth(index + row), endAligned(column.align) && 'ms-auto')}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonTableCards<TRow>({
  columns,
  cards = 3,
}: {
  readonly columns: readonly Column<TRow>[];
  readonly cards?: number;
}): JSX.Element {
  const hasPrimary = columns.some((column) => column.primary === true);
  const details = columns.filter(
    (column) => column.primary !== true && column.actions !== true,
  ).length;

  return (
    <>
      {Array.from({ length: cards }, (_, card) => (
        <div key={card} aria-hidden="true" className="rounded-card bg-surface p-4 shadow-card">
          {hasPrimary && <Skeleton className="mb-3 h-4 w-1/2" />}

          <div className="flex flex-col gap-3">
            {Array.from({ length: Math.max(details, 3) }, (_, row) => (
              <div key={row} className="flex items-center justify-between gap-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className={cn('h-3', cellWidth(row + card))} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

/** Mirrors `EntityCard`: the icon chip, its two lines, and the progress bar under them. */
export function SkeletonCard({ count = 3 }: { readonly count?: number }): JSX.Element {
  return (
    <>
      {Array.from({ length: count }, (_, card) => (
        <div
          key={card}
          aria-hidden="true"
          className="flex flex-col rounded-card bg-surface p-4 shadow-card"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="size-9 shrink-0 rounded-control" />

            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="mt-2 h-3 w-1/4" />
            </div>

            <Skeleton className="h-5 w-16 shrink-0" />
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <Skeleton className="h-1.5 w-full" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </>
  );
}

/** Mirrors `StatCard` inside the row that lays the real cards out. */
export function SkeletonKpi({ count = 3 }: { readonly count?: number }): JSX.Element {
  return (
    <StatRow cards={count}>
      <SkeletonStatus />

      {Array.from({ length: count }, (_, card) => (
        <div key={card} aria-hidden="true" className="rounded-card bg-surface p-4 shadow-card">
          <div className="flex items-center gap-2">
            <Skeleton className="size-7 shrink-0 rounded-control" />
            <Skeleton className="h-3 w-2/5" />
          </div>

          <Skeleton className="mt-3 h-7 w-1/2" />
          <Skeleton className="mt-2 h-3 w-3/5" />
        </div>
      ))}
    </StatRow>
  );
}

export function SkeletonForm({ fields = 4 }: { readonly fields?: number }): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonStatus />

      {Array.from({ length: fields }, (_, field) => (
        <div key={field} aria-hidden="true" className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-11 w-full rounded-control" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTimeline({ entries = 4 }: { readonly entries?: number }): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <SkeletonStatus />

      {Array.from({ length: entries }, (_, entry) => (
        <div
          key={entry}
          aria-hidden="true"
          className="flex items-start gap-3 rounded-card bg-surface p-4 shadow-card"
        >
          <Skeleton className="size-9 shrink-0 rounded-control" />

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-20 shrink-0" />
            </div>
            <Skeleton className="mt-2 h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

const BLOCKS = [
  'start-1 end-1 top-[8%] h-[12%]',
  'start-1 end-1 top-[26%] h-[9%]',
  'start-1 end-1 top-[44%] h-[16%]',
  'start-1 end-1 top-[68%] h-[11%]',
] as const;

/** The grid's own shape: an hour gutter beside one column of blocks per doctor. */
export function SkeletonCalendarDay({ columns = 3 }: { readonly columns?: number }): JSX.Element {
  return (
    <div className="rounded-card bg-surface p-4 shadow-card">
      <SkeletonStatus />

      <div aria-hidden="true" className="flex gap-3">
        <div className="flex w-12 shrink-0 flex-col gap-6 pt-8">
          {Array.from({ length: 6 }, (_, hour) => (
            <Skeleton key={hour} className="h-3 w-10" />
          ))}
        </div>

        <div
          className="grid flex-1 gap-3"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }, (_, column) => (
            <div key={column} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />

              <div className="relative h-72 rounded-panel bg-inset">
                {BLOCKS.slice(0, 3 + (column % 2)).map((block) => (
                  <Skeleton key={block} className={cn('absolute rounded-panel', block)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
