import type { JSX, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Icon, type IconName } from "@ui/components/icon";
import { Ltr } from "@ui/components/ltr";
import { Select } from "@ui/components/select";
import {
  RefreshBar,
  SkeletonStatus,
  SkeletonTable,
  SkeletonTableCards,
} from "@ui/components/skeleton";
import { cn } from "@ui/lib/cn";
import { useDelayedLoading } from "@ui/lib/use-delayed-loading";
import { useIsMobile } from "@ui/lib/use-media-query";
import { testid, type TestIdProps } from "@ui/lib/testid";

export interface Column<TRow> {
  readonly key: string;
  /** i18n key for the header cell — the same string labels the mobile card. */
  readonly header: string;
  /** Drawn beside the label on the mobile card, where each row answers what its value means. */
  readonly icon?: IconName | undefined;
  readonly render: (row: TRow) => ReactNode;
  readonly className?: string | undefined;
  readonly hideOnMobile?: boolean | undefined;
  // The mirror image, for a field the wide shape folds into another cell. A column sets one or the
  // other; both would declare a column that never renders.
  readonly hideOnDesktop?: boolean | undefined;
  readonly primary?: boolean | undefined;
  readonly actions?: boolean | undefined;
  /** Numeric values: lining, tabular figures so columns of money line up. */
  readonly align?: "start" | "end" | "numeric" | undefined;
}

export interface TableProps<TRow> extends TestIdProps {
  columns: readonly Column<TRow>[];
  rows: readonly TRow[];
  rowKey: (row: TRow) => string;
  isLoading?: boolean | undefined;
  isRefreshing?: boolean | undefined;
  empty?: ReactNode | undefined;
  pagination?: PaginationProps | undefined;
  onRowClick?: ((row: TRow) => void) | undefined;
  /** Names a row for screen readers when the whole row is clickable. */
  rowLabel?: ((row: TRow) => string) | undefined;
  // The reference's `.panel-head`: a title and its filters ride inside the panel, above the rule
  // that starts the rows, rather than floating above the card with nothing holding them.
  header?: ReactNode | undefined;
  /**
   * `compact` sits inside another card: no box of its own, `--control-h-sm` rows, a sticky head,
   * and it scrolls sideways on a phone rather than turning into cards.
   */
  density?: "default" | "compact" | undefined;
}

export interface PaginationProps extends TestIdProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Rows per page. Offered as a control only when `onPerPageChange` is given with it. */
  perPage?: number | undefined;
  perPageOptions?: readonly number[] | undefined;
  onPerPageChange?: ((perPage: number) => void) | undefined;
}

/** What a list offers as its page sizes. A clinic's screen is a laptop or a phone, not a wall. */
export const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;

const alignClass = (align: Column<never>["align"]): string =>
  align === "numeric" ? "text-end tabular-nums" : align === "end" ? "text-end" : "text-start";

// End-alignment is a property of a column, and a card has no column: it pushed the balance to the
// far side while the phone and age sat at the start. Only `tabular-nums` is kept.
const cardAlignClass = (align: Column<never>["align"]): string =>
  align === "numeric" ? "text-start tabular-nums" : "text-start";

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
  density = "default",
  "data-testid": testId,
}: TableProps<TRow>): JSX.Element {
  const { t } = useTranslation();
  const compact = density === "compact";
  const isMobile = useIsMobile() && !compact;
  const showSkeleton = useDelayedLoading(isLoading);

  // Every node a row owns hangs off one id, so a failing selector names the row it missed.
  const rowId = (row: TRow): string | undefined =>
    testId === undefined ? undefined : `${testId}-row-${rowKey(row)}`;

  if (!isLoading && rows.length === 0 && empty !== undefined) {
    return (
      <>
        {header !== undefined && <PanelHead {...testid(testId, "header")}>{header}</PanelHead>}
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
        {header !== undefined && <PanelHead {...testid(testId, "header")}>{header}</PanelHead>}

        {/* One card per row */}
        <div data-part="table-cards" {...testid(testId)} className="flex flex-col gap-3">
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

              const shown = detail.filter((column) => {
                const value = column.render(row);
                return value !== null && value !== undefined && value !== false && value !== "";
              });

              const body = (
                <>
                  {primary && (
                    <p
                      data-part="table-card-title"
                      {...testid(rowId(row), "title")}
                      className="mb-3 text-value font-medium text-ink"
                    >
                      {primary.render(row)}
                    </p>
                  )}

                  {/* No column gap: the row divider is drawn on the two cells, so a gap would break
                      every hairline in the middle. The label pads its own end instead. */}
                  <dl
                    data-part="table-card-meta"
                    {...testid(rowId(row), "meta")}
                    className="grid grid-cols-[minmax(5.5rem,auto)_1fr]"
                  >
                    {shown.map((column, index) => (
                      <div key={column.key} className="contents">
                        <dt
                          data-part="table-card-label"
                          {...testid(rowId(row), `${column.key}-label`)}
                          className={cn(
                            // `pe-4` is the label's own end padding — without it a label wider than
                            // its minimum runs straight into its value.
                            "py-2.5 pe-4 text-start text-label text-ink-muted",
                            // The label carries the value's line height: different line boxes split
                            // the row, and `items-baseline` breaks the hairline.
                            "leading-value",
                            index > 0 && "border-t border-line",
                          )}
                        >
                          {column.icon === undefined ? (
                            t(column.header)
                          ) : (
                            <span className="inline-flex items-center gap-1.5">
                              <Icon name={column.icon} className="size-4 shrink-0" />
                              {t(column.header)}
                            </span>
                          )}
                        </dt>
                        <dd
                          data-part="table-card-value"
                          {...testid(rowId(row), column.key)}
                          className={cn(
                            "py-2.5 text-value text-ink",
                            cardAlignClass(column.align),
                            index > 0 && "border-t border-line",
                          )}
                        >
                          {column.render(row)}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {rowActions !== null && (
                    <div
                      data-part="table-row-actions"
                      {...testid(rowId(row), "actions")}
                      className={cn(
                        "relative z-10 mt-3 flex flex-wrap items-center justify-end gap-2",
                        "border-t border-line pt-3",
                      )}
                    >
                      {rowActions}
                    </div>
                  )}
                </>
              );

              const cardClass =
                "border border-line rounded-card bg-surface p-4 text-start shadow-card transition duration-[250ms] ease-in-out";

              return onRowClick === undefined ? (
                <div
                  key={rowKey(row)}
                  data-row
                  data-part="table-card"
                  {...testid(rowId(row))}
                  className={cardClass}
                >
                  {body}
                </div>
              ) : (
                // An overlay button rather than one wrapped around the card: a row with actions
                // nested a `<button>` in a `<button>`, and "edit" sometimes opened the supplier.
                <div
                  key={rowKey(row)}
                  data-row
                  data-part="table-card"
                  {...testid(rowId(row))}
                  className={cn(cardClass, "relative")}
                >
                  <button
                    type="button"
                    data-part="table-card-overlay"
                    {...testid(rowId(row), "open")}
                    onClick={() => onRowClick(row)}
                    {...(rowLabel && { "aria-label": rowLabel(row) })}
                    className="absolute inset-0 z-0 cursor-pointer rounded-card"
                  />
                  {body}
                </div>
              );
            })}
        </div>

        {pagination !== undefined && (
          <div
            data-part="table-pagination"
            {...testid(testId, "pagination")}
            className="mt-3 border border-line rounded-card bg-surface shadow-card"
          >
            <Pagination {...pagination} {...testid(testId, "pagination-nav")} />
          </div>
        )}
      </>
    );
  }

  return (
    <div
      data-part="table"
      data-density={density}
      {...testid(testId)}
      className={cn(
        "overflow-hidden bg-surface",
        !compact && "border border-line rounded-card shadow-card",
      )}
    >
      {header !== undefined && (
        <div
          data-part="table-header"
          {...testid(testId, "header")}
          className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-[22px] py-[18px]"
        >
          {header}
        </div>
      )}

      {showSkeleton && <SkeletonStatus />}
      <RefreshBar active={isRefreshing} />

      <div data-part="table-scroll" {...testid(testId, "scroll")} className="overflow-x-auto">
        <table className="w-full border-collapse text-value">
          <thead>
            <tr>
              {wideColumns.map((column) => (
                <th
                  key={column.key}
                  data-part="table-head-cell"
                  {...testid(testId, `head-${column.key}`)}
                  scope="col"
                  className={cn(
                    "whitespace-nowrap border-b border-line bg-table-head",
                    compact ? "sticky top-0 h-(--control-h-sm) px-3" : "px-[18px] py-[13px]",
                    "text-micro font-medium text-ink-muted",
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
                  data-part="table-body-row"
                  {...testid(rowId(row))}
                  {...(onRowClick && {
                    onClick: () => onRowClick(row),
                    className: "cursor-pointer transition-colors duration-150 hover:bg-row-hover",
                  })}
                  {...(!onRowClick && {
                    className: "transition-colors duration-150 hover:bg-row-hover",
                  })}
                >
                  {wideColumns.map((column) => (
                    <td
                      key={column.key}
                      data-part="table-body-cell"
                      {...testid(rowId(row), column.key)}
                      className={cn(
                        compact
                          ? "h-(--control-h-sm) whitespace-nowrap px-3 py-1 align-middle"
                          : "px-[18px] py-[13px] align-middle",
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

      {pagination !== undefined && <Pagination {...pagination} {...testid(testId, "pagination")} />}
    </div>
  );
}

// On a phone the rows are separate cards, so the head cannot sit inside one; it becomes the row
// above them, carrying the same spacing.
function PanelHead({
  children,
  "data-testid": testId,
}: { readonly children: ReactNode } & TestIdProps): JSX.Element {
  return (
    <div
      data-part="table-header"
      {...testid(testId)}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      {children}
    </div>
  );
}

// A size the list was given but the ladder does not offer still has to be shown — a control drawn
// blank is worse than an odd rung.
const sizes = (perPage: number, options: readonly number[]): number[] =>
  options.includes(perPage) ? [...options] : [...options, perPage].sort((a, b) => a - b);

export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
  perPage,
  perPageOptions = PER_PAGE_OPTIONS,
  onPerPageChange,
  "data-testid": testId,
}: PaginationProps): JSX.Element {
  const { t } = useTranslation();
  const pages = pageWindow(page, totalPages);

  return (
    <nav
      data-part="pagination"
      {...testid(testId)}
      className={cn(
        "flex flex-wrap items-center justify-between gap-2",
        "border-t border-line bg-table-head px-[18px] py-3",
      )}
      aria-label={t("pagination.label")}
    >
      <div className="flex items-center gap-3">
        <p
          data-part="pagination-total"
          {...testid(testId, "total")}
          className="text-meta text-ink-muted"
        >
          {t("pagination.total", { total })}
        </p>

        {/* The size of a page is the reader's: a laptop shows fifty rows where a phone shows ten. */}
        {perPage !== undefined && onPerPageChange !== undefined && (
          <label className="flex items-center gap-2 text-meta text-ink-muted">
            {t("pagination.perPage")}
            <Select
              className="w-[5.5rem]"
              {...testid(testId, "per-page")}
              value={String(perPage)}
              onChange={(event) => onPerPageChange(Number(event.target.value))}
              options={sizes(perPage, perPageOptions).map((size) => ({
                value: String(size),
                label: String(size),
              }))}
            />
          </label>
        )}
      </div>

      {/* Numbered, as the reference draws it: on two or three pages, naming them beats a pair of
          arrows and a "page 1 of 2" that has to be read to be understood. */}
      <div
        data-part="pagination-pages"
        {...testid(testId, "pages")}
        className="flex items-center gap-1.5"
      >
        <PageButton
          label={t("pagination.previous")}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          {...testid(testId, "previous")}
        >
          <Icon name="chevron-start" className="size-3.5" />
        </PageButton>

        {pages.map((entry) =>
          entry === null ? (
            <span
              key={`gap-${String(entry)}`}
              data-part="pagination-gap"
              {...testid(testId, "gap")}
              aria-hidden="true"
              className="px-1 text-ink-faint"
            >
              …
            </span>
          ) : (
            <PageButton
              key={entry}
              label={t("pagination.goToPage", { page: entry })}
              current={entry === page}
              onClick={() => onPageChange(entry)}
              {...testid(testId, `page-${String(entry)}`)}
            >
              <Ltr>{entry}</Ltr>
            </PageButton>
          ),
        )}

        <PageButton
          label={t("pagination.next")}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          {...testid(testId, "next")}
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
  "data-testid": testId,
}: {
  readonly label: string;
  readonly current?: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly children: ReactNode;
} & TestIdProps): JSX.Element {
  return (
    <button
      type="button"
      data-part="pagination-page"
      {...testid(testId)}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "pill-text inline-flex items-center size-(--control-h) cursor-pointer justify-center lg:size-(--control-h-sm)",
        "rounded-chip border text-label tabular-nums transition-colors duration-[250ms] ease-in-out",
        current
          ? "border-primary-600 bg-primary-600 font-medium text-ink-inverse"
          : "border-line bg-surface text-ink-muted hover:bg-inset hover:border-primary-600 hover:text-primary-700",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line",
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
