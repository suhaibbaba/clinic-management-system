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
  // For columns that are context on a wide screen and noise on a narrow one — an internal id, a
  // file number already implied by the row.
  readonly hideOnMobile?: boolean | undefined;
  // The mirror image, for a field the wide shape folds into another cell. A column sets one or the
  // other; both would declare a column that never renders.
  readonly hideOnDesktop?: boolean | undefined;
  // The card's title line: bold across the full width with no label, because a patient's name needs
  // no caption. At most one column claims it.
  readonly primary?: boolean | undefined;
  readonly actions?: boolean | undefined;
  /** Numeric values: lining, tabular figures so columns of money line up. */
  readonly align?: 'start' | 'end' | 'numeric' | undefined;
}

export interface TableProps<TRow> {
  columns: readonly Column<TRow>[];
  rows: readonly TRow[];
  rowKey: (row: TRow) => string;
  isLoading?: boolean | undefined;
  empty?: ReactNode | undefined;
  pagination?: PaginationProps | undefined;
  // On mobile the card itself becomes the target — a 44px button inside a card is a small thing to
  // hit when the card is right there.
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

// End-alignment is a property of a column, and a card has no column: it pushed the balance to the
// far side while the phone and age sat at the start. Only `tabular-nums` is kept.
const cardAlignClass = (align: Column<never>['align']): string =>
  align === 'numeric' ? 'text-start tabular-nums' : 'text-start';

// Both shapes read the same `columns` array, so a card's label is the header above it. Only one is
// rendered — `md:hidden` left the duplicate in the document, read twice and with duplicate ids.
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
        {/* One card per row */}
        <div className="flex flex-col gap-3">
          {isLoading && <CardSkeleton rows={detail.length || 3} />}

          {!isLoading &&
            rows.map((row) => {
              // Rendered up front: a row action is often conditional, and an empty actions block
              // still draws its divider under nothing.
              const rowActions = actions?.render(row) ?? null;

              // A row whose value renders nothing is dropped from the card: on the wide shape an
              // empty cell holds a column open, on a card it is a label with nothing after it.
              const shown = detail.filter((column) => {
                const value = column.render(row);
                return value !== null && value !== undefined && value !== false && value !== '';
              });

              const body = (
                <>
                  {primary && (
                    <p className="mb-3 text-value font-semibold text-ink">{primary.render(row)}</p>
                  )}

                  {/* No column gap: the row divider is drawn on the two cells, so a gap would break
                      every hairline in the middle. The label pads its own end instead. */}
                  <dl className="grid grid-cols-[minmax(5.5rem,auto)_1fr]">
                    {shown.map((column, index) => (
                      <div key={column.key} className="contents">
                        <dt
                          className={cn(
                            // `pe-4` is the label's own end padding — without it a label wider than
                            // its minimum runs straight into its value.
                            'py-2.5 pe-4 text-start text-label text-ink-muted',
                            // The label carries the value's line height: different line boxes split
                            // the row, and `items-baseline` breaks the hairline.
                            'leading-6',
                            index > 0 && 'border-t border-line',
                          )}
                        >
                          {t(column.header)}
                        </dt>
                        <dd
                          className={cn(
                            'py-2.5 text-value text-ink',
                            cardAlignClass(column.align),
                            index > 0 && 'border-t border-line',
                          )}
                        >
                          {column.render(row)}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {rowActions !== null && (
                    <div
                      // Above the overlay, and clickable in its own right:
                      // these are the row's own actions, not a way into it.
                      className={cn(
                        'relative z-10 mt-3 flex flex-wrap items-center justify-end gap-2',
                        'border-t border-line pt-3',
                      )}
                    >
                      {rowActions}
                    </div>
                  )}
                </>
              );

              const cardClass =
                'rounded-card bg-surface p-4 text-start shadow-card transition-shadow duration-150';

              return onRowClick === undefined ? (
                <div key={rowKey(row)} data-row className={cardClass}>
                  {body}
                </div>
              ) : (
                // An overlay button rather than one wrapped around the card: a row with actions
                // nested a `<button>` in a `<button>`, and "edit" sometimes opened the supplier.
                <div key={rowKey(row)} data-row className={cn(cardClass, 'relative')}>
                  <button
                    type="button"
                    onClick={() => onRowClick(row)}
                    {...(rowLabel && { 'aria-label': rowLabel(row) })}
                    className="absolute inset-0 z-0 cursor-pointer rounded-card"
                  />
                  {body}
                </div>
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
                    'whitespace-nowrap border-b border-line px-4 py-2.5 text-label font-medium text-ink-muted',
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
                  data-row
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
                        // 12px above and below a 22px line makes a 46px row:
                        // the 44 a thumb needs, and no taller.
                        'px-4 py-3 align-middle',
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

// Mirrors the card's own grid, so the skeleton occupies about the height the content will and the
// page does not jump.
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
      className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3"
      // The landmark names the whole control, not one of its buttons: a screen reader announced
      // "next" as the name of the region.
      aria-label={t('pagination.label')}
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
          iconPosition="end"
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
