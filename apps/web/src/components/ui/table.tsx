import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@web/components/ui/button';
import { Icon } from '@web/components/ui/icon';
import { cn } from '@web/lib/cn';
import { useIsMobile } from '@web/lib/use-media-query';

export interface Column<TRow> {
  readonly key: string;
  /** i18n key for the header cell — the same string labels the mobile card. */
  readonly header: string;
  readonly render: (row: TRow) => ReactNode;
  readonly className?: string | undefined;
  /**
   * Dropped from the mobile card. For columns that are context on a wide
   * screen and noise on a narrow one: an internal id, a file number already
   * implied by the row you tapped.
   */
  readonly hideOnMobile?: boolean | undefined;
  /**
   * The mirror image: dropped from the wide table, kept on the card. For a
   * field the wide shape folds into another cell — an email printed as the
   * caption under a name — and which therefore has nowhere to live on a card
   * unless it is declared again as its own labelled row.
   *
   * A column may set one of these or the other; setting both would declare a
   * column that never renders.
   */
  readonly hideOnDesktop?: boolean | undefined;
  /**
   * The card's title line on mobile: rendered bold across the full width with
   * no label, because a patient's name does not need to be captioned "name".
   * At most one column should claim this.
   */
  readonly primary?: boolean | undefined;
  /**
   * The row's actions. On mobile they leave the label/value grid and sit as a
   * button row at the foot of the card.
   */
  readonly actions?: boolean | undefined;
  /** Numeric values: lining, tabular figures so columns of money line up. */
  readonly align?: 'start' | 'end' | 'numeric' | undefined;
}

export interface TableProps<TRow> {
  columns: readonly Column<TRow>[];
  rows: readonly TRow[];
  rowKey: (row: TRow) => string;
  isLoading?: boolean | undefined;
  /** Rendered in place of the table body when there are no rows. */
  empty?: ReactNode | undefined;
  pagination?: PaginationProps | undefined;
  /**
   * Makes the whole row activate. On mobile the card itself becomes the
   * target, which is the point — a 44px button inside a card is a small thing
   * to hit when the card is right there.
   */
  onRowClick?: ((row: TRow) => void) | undefined;
  /** Names a row for screen readers when the whole row is clickable. */
  rowLabel?: ((row: TRow) => string) | undefined;
}

export interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

const alignClass = (align: Column<never>['align']): string =>
  align === 'numeric' ? 'text-end tabular-nums' : align === 'end' ? 'text-end' : 'text-start';

/**
 * One table, two shapes.
 *
 * Above `md` it is a real `<table>`. Below it, each row becomes a card whose
 * body is a two-column grid: the column's own header on one side, that row's
 * value on the other. In RTL that puts labels on the right and values on the
 * left, which falls out of `text-start`/`text-end` rather than being arranged.
 *
 * Both shapes are driven by the *same* `columns` array, which is the whole
 * reason this lives in one component: a label rendered on a card has to be the
 * label in the header above it, and the only way to guarantee that is for
 * there to be one string. A per-screen mobile fork would have had six copies
 * of every header, drifting one rename at a time.
 *
 * Only one shape is rendered at a time, chosen by a media query. Rendering
 * both and hiding one with `md:hidden` was simpler and wrong: `display: none`
 * hides a thing visually but the duplicate is still in the document, so a
 * screen reader reads every row twice and any `id` inside a cell exists twice.
 * The query is read through `useSyncExternalStore`, which returns its snapshot
 * during the first render — so there is no flash of the wrong shape either.
 */
export function Table<TRow>({
  columns,
  rows,
  rowKey,
  isLoading = false,
  empty,
  pagination,
  onRowClick,
  rowLabel,
}: TableProps<TRow>): JSX.Element {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  if (!isLoading && rows.length === 0 && empty !== undefined) {
    return <>{empty}</>;
  }

  const wideColumns = columns.filter((column) => column.hideOnDesktop !== true);
  const mobileColumns = columns.filter((column) => column.hideOnMobile !== true);
  const primary = mobileColumns.find((column) => column.primary === true);
  const actions = mobileColumns.find((column) => column.actions === true);
  const detail = mobileColumns.filter(
    (column) => column.primary !== true && column.actions !== true,
  );

  if (isMobile) {
    return (
      <>
        {/* ── One card per row ──────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          {isLoading && <CardSkeleton rows={detail.length || 3} />}

          {!isLoading &&
            rows.map((row) => {
              // Rendered up front: a row action is often conditional — only a
              // payment has a receipt — and an empty actions block still draws
              // its divider and padding, leaving a hairline under nothing.
              const rowActions = actions?.render(row) ?? null;

              /*
               * A row whose value renders nothing is dropped from the card.
               *
               * On the wide shape an empty cell holds a column open and the
               * grid stays aligned; on a card it is a labelled row with
               * nothing after the label — every charge line in a statement
               * showed an empty "credit", and every payment an empty "debit".
               */
              const shown = detail.filter((column) => {
                const value = column.render(row);
                return value !== null && value !== undefined && value !== false && value !== '';
              });

              const body = (
                <>
                  {primary && (
                    <p className="mb-3 text-value font-semibold text-ink">{primary.render(row)}</p>
                  )}

                  {/*
                  No column gap: the row divider is drawn on the two cells, so
                  a gap between them leaves a visible break in the middle of
                  every hairline. The label pads its own end instead.
                */}
                  <dl className="grid grid-cols-[minmax(5.5rem,auto)_1fr]">
                    {shown.map((column, index) => (
                      <div key={column.key} className="contents">
                        <dt
                          className={cn(
                            'py-2.5 text-start text-label text-ink-muted',
                            index > 0 && 'border-t border-line',
                          )}
                        >
                          {t(column.header)}
                        </dt>
                        <dd
                          className={cn(
                            'py-2.5 text-value text-ink',
                            alignClass(column.align),
                            index > 0 && 'border-t border-line',
                          )}
                        >
                          {column.render(row)}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {rowActions !== null && (
                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
                      {rowActions}
                    </div>
                  )}
                </>
              );

              const cardClass =
                'rounded-card bg-surface p-4 text-start shadow-card transition-shadow duration-150';

              return onRowClick === undefined ? (
                <div key={rowKey(row)} className={cardClass}>
                  {body}
                </div>
              ) : (
                <button
                  key={rowKey(row)}
                  type="button"
                  onClick={() => onRowClick(row)}
                  {...(rowLabel && { 'aria-label': rowLabel(row) })}
                  className={cn(cardClass, 'w-full cursor-pointer hover:shadow-float')}
                >
                  {body}
                </button>
              );
            })}
        </div>

        {pagination !== undefined && (
          <div className="mt-3 rounded-card bg-surface shadow-card">
            <Pagination {...pagination} />
          </div>
        )}
      </>
    );
  }

  return (
    <div className="overflow-hidden rounded-card bg-surface shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-value">
          <thead>
            <tr>
              {wideColumns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    // Headers are the secondary grey at 13px, not shouted.
                    'whitespace-nowrap border-b border-line px-[22px] py-3 text-label font-medium text-ink-muted',
                    alignClass(column.align),
                    column.className,
                  )}
                >
                  {t(column.header)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-line">
            {isLoading && (
              <tr>
                <td colSpan={wideColumns.length} className="px-4 py-8 text-center text-ink-muted">
                  {t('common.loading')}
                </td>
              </tr>
            )}

            {!isLoading &&
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  {...(onRowClick && {
                    onClick: () => onRowClick(row),
                    className: 'cursor-pointer transition-colors duration-150 hover:bg-row-hover',
                  })}
                  {...(!onRowClick && {
                    className: 'transition-colors duration-150 hover:bg-row-hover',
                  })}
                >
                  {wideColumns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-[22px] py-3.5 align-middle',
                        alignClass(column.align),
                        column.className,
                      )}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {pagination !== undefined && <Pagination {...pagination} />}
    </div>
  );
}

/**
 * The loading state in card shape.
 *
 * It mirrors the card's own grid — a title line and `rows` label/value rows —
 * so the skeleton occupies about the height the content will, and the page
 * does not jump when the data lands.
 */
function CardSkeleton({ rows }: { readonly rows: number }): JSX.Element {
  const { t } = useTranslation();

  return (
    <>
      <span className="sr-only" role="status">
        {t('common.loading')}
      </span>

      {[0, 1, 2].map((card) => (
        <div
          key={card}
          aria-hidden="true"
          className="animate-pulse rounded-card bg-surface p-4 shadow-card"
        >
          <div className="mb-3 h-4 w-1/2 rounded-pill bg-sunken" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: rows }, (_, row) => (
              <div key={row} className="flex items-center justify-between gap-4">
                <div className="h-3 w-20 rounded-pill bg-sunken" />
                <div className="h-3 w-24 rounded-pill bg-sunken" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: PaginationProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-[22px] py-3.5"
      aria-label={t('pagination.next')}
    >
      <p className="text-label text-ink-muted">{t('pagination.total', { total })}</p>

      <div className="flex items-center gap-2">
        <Button
          icon={<Icon name="chevron-start" />}
          size="sm"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {t('pagination.previous')}
        </Button>

        <span className="text-label text-ink-muted">
          {t('pagination.page', { page, totalPages: Math.max(totalPages, 1) })}
        </span>

        <Button
          icon={<Icon name="chevron-end" />}
          size="sm"
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t('pagination.next')}
        </Button>
      </div>
    </nav>
  );
}
