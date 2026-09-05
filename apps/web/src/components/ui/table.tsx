import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@web/components/ui/icon';
import { Button } from '@web/components/ui/button';
import { cn } from '@web/lib/cn';

export interface Column<TRow> {
  readonly key: string;
  /** i18n key for the header cell. */
  readonly header: string;
  readonly render: (row: TRow) => ReactNode;
  readonly className?: string | undefined;
}

export interface TableProps<TRow> {
  columns: readonly Column<TRow>[];
  rows: readonly TRow[];
  rowKey: (row: TRow) => string;
  isLoading?: boolean | undefined;
  /** Rendered in place of the table body when there are no rows. */
  empty?: ReactNode | undefined;
  pagination?: PaginationProps | undefined;
}

export interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

/**
 * Table with optional pagination. Cells are `text-start`, so columns align to
 * the reading direction and the whole table mirrors in RTL without overrides.
 */
export function Table<TRow>({
  columns,
  rows,
  rowKey,
  isLoading = false,
  empty,
  pagination,
}: TableProps<TRow>): JSX.Element {
  const { t } = useTranslation();

  if (!isLoading && rows.length === 0 && empty !== undefined) {
    return <>{empty}</>;
  }

  return (
    <div className="overflow-hidden rounded-card border border-line-card bg-surface shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-value">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'h-12 whitespace-nowrap border-b border-line px-5 text-start text-label font-semibold text-ink-muted',
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
                <td colSpan={columns.length} className="px-4 py-8 text-center text-ink-muted">
                  {t('common.loading')}
                </td>
              </tr>
            )}

            {!isLoading &&
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="h-12 transition-colors duration-150 hover:bg-inset"
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn('px-5 py-2.5 text-start align-middle', column.className)}
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

export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: PaginationProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3.5"
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
