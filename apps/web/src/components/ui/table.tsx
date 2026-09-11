import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@web/components/ui/icon';
import { Ltr } from '@web/components/ui/ltr';
import {
  RefreshBar,
  SkeletonStatus,
  SkeletonTable,
  SkeletonTableCards,
} from '@web/components/ui/skeleton';
import { cn } from '@web/lib/cn';
import { useDelayedLoading } from '@web/lib/use-delayed-loading';
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
  isRefreshing?: boolean | undefined;
  empty?: ReactNode | undefined;
  pagination?: PaginationProps | undefined;
  // On mobile the card itself becomes the target — a 44px button inside a card is a small thing to
  // hit when the card is right there.
  onRowClick?: ((row: TRow) => void) | undefined;
  /** Names a row for screen readers when the whole row is clickable. */
  rowLabel?: ((row: TRow) => string) | undefined;
  // The reference's `.panel-head`: a title and its filters ride inside the panel, above the rule
  // that starts the rows, rather than floating above the card with nothing holding them.
  header?: ReactNode | undefined;
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
  isRefreshing = false,
  empty,
  pagination,
  onRowClick,
  rowLabel,
  header,
}: TableProps<TRow>): JSX.Element {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const showSkeleton = useDelayedLoading(isLoading);

  if (!isLoading && rows.length === 0 && empty !== undefined) {
    return (
      <>
        {header !== undefined && <PanelHead>{header}</PanelHead>}
        {empty}
      </>
    );
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
        {header !== undefined && <PanelHead>{header}</PanelHead>}

        {/* One card per row */}
        <div className="flex flex-col gap-3">
          <RefreshBar active={isRefreshing} />

          {showSkeleton && (
            <>
              <SkeletonStatus />
              <SkeletonTableCards columns={mobileColumns} />
            </>
          )}

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
                    <p className="mb-3 text-value font-medium text-ink">{primary.render(row)}</p>
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
                'border border-line rounded-card bg-surface p-4 text-start shadow-card transition-shadow duration-150';

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
          <div className="mt-3 border border-line rounded-card bg-surface shadow-card">
            <Pagination {...pagination} />
          </div>
        )}
      </>
    );
  }

  return (
    <div className="overflow-hidden border border-line rounded-card bg-surface shadow-card">
      {header !== undefined && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-[22px] py-[18px]">
          {header}
        </div>
      )}

      {showSkeleton && <SkeletonStatus />}
      <RefreshBar active={isRefreshing} />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-value">
          <thead>
            <tr>
              {wideColumns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    // A tinted band with the reference's 13/18 rhythm: the head reads as a rule
                    // over the rows rather than as a first row of them.
                    'whitespace-nowrap border-b border-line bg-table-head px-[18px] py-[13px]',
                    'text-micro font-medium text-ink-muted',
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
            {showSkeleton && <SkeletonTable columns={wideColumns} />}

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
                        // 13px above and below a 20px line makes a 46px row: the 44 a thumb
                        // needs, and no taller.
                        'px-[18px] py-[13px] align-middle',
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

// On a phone the rows are separate cards, so the head cannot sit inside one; it becomes the row
// above them, carrying the same spacing.
function PanelHead({ children }: { readonly children: ReactNode }): JSX.Element {
  return <div className="flex flex-wrap items-center justify-between gap-3">{children}</div>;
}

export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: PaginationProps): JSX.Element {
  const { t } = useTranslation();
  const pages = pageWindow(page, totalPages);

  return (
    <nav
      className={cn(
        'flex flex-wrap items-center justify-between gap-2',
        'border-t border-line bg-table-head px-[18px] py-3',
      )}
      // The landmark names the whole control, not one of its buttons: a screen reader announced
      // "next" as the name of the region.
      aria-label={t('pagination.label')}
    >
      <p className="text-meta text-ink-muted">{t('pagination.total', { total })}</p>

      {/* Numbered, as the reference draws it: on two or three pages, naming them beats a pair of
          arrows and a "page 1 of 2" that has to be read to be understood. */}
      <div className="flex items-center gap-1.5">
        <PageButton
          label={t('pagination.previous')}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <Icon name="chevron-start" className="size-3.5" />
        </PageButton>

        {pages.map((entry) =>
          entry === null ? (
            <span key={`gap-${String(entry)}`} aria-hidden="true" className="px-1 text-ink-faint">
              …
            </span>
          ) : (
            <PageButton
              key={entry}
              label={t('pagination.goToPage', { page: entry })}
              current={entry === page}
              onClick={() => onPageChange(entry)}
            >
              <Ltr>{entry}</Ltr>
            </PageButton>
          ),
        )}

        <PageButton
          label={t('pagination.next')}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <Icon name="chevron-end" className="size-3.5" />
        </PageButton>
      </div>
    </nav>
  );
}

function PageButton({
  label,
  current = false,
  disabled = false,
  onClick,
  children,
}: {
  readonly label: string;
  readonly current?: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={current ? 'page' : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        // 44px on touch, the reference's drawn 28 on a laptop.
        'inline-flex size-11 cursor-pointer items-center justify-center lg:size-7',
        'rounded-chip border text-label tabular-nums transition-colors duration-150',
        current
          ? 'border-primary-600 bg-primary-600 font-medium text-ink-inverse'
          : 'border-line bg-surface text-ink-muted hover:border-primary-600 hover:text-primary-700',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line',
      )}
    >
      {children}
    </button>
  );
}

/** At most seven slots: the ends, the neighbours, and an ellipsis for whatever is skipped. */
function pageWindow(page: number, totalPages: number): readonly (number | null)[] {
  const last = Math.max(totalPages, 1);

  if (last <= 7) {
    return Array.from({ length: last }, (_, index) => index + 1);
  }

  const around = [page - 1, page, page + 1].filter((entry) => entry > 1 && entry < last);
  const shown = [1, ...around, last];

  return shown.flatMap((entry, index) =>
    index > 0 && entry - shown[index - 1]! > 1 ? [null, entry] : [entry],
  );
}
