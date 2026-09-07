import { LOOKUP_LIST, type ShoppingListLine } from '@clinic/shared';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Badge,
  Button,
  EmptyState,
  Icon,
  PageHeader,
  Table,
  type Column,
} from '@web/components/ui';
import { inventoryApi } from '@web/features/inventory/api';
import { useLookupLabels } from '@web/features/lookups/queries';
import { categoryTone } from '@web/features/inventory/display';
import { useShoppingList } from '@web/features/inventory/queries';
import { formatDate } from '@web/lib/format';

/**
 * What to buy, on a page somebody prints and carries.
 *
 * The suggestion is twice the minimum less what is on the shelf: enough to
 * clear the reorder level and hold the same amount again, so the clinic is not
 * back on this screen next week. It is a starting figure, and the page says so
 * — the technician who knows a supplier only sells full cartons will write
 * their own number on the paper, which is exactly what paper is for.
 */
export function ShoppingListPage(): JSX.Element {
  const { t } = useTranslation();
  const categoryLabel = useLookupLabels(LOOKUP_LIST.ITEM_CATEGORY);
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
  const list = useShoppingList();

  const columns: readonly Column<ShoppingListLine>[] = [
    {
      key: 'item',
      header: 'inventory.columns.item',
      primary: true,
      render: (row) => (
        <span className="flex flex-col">
          <span className="font-medium text-ink">{row.nameAr}</span>
          {row.supplierName && (
            <span className="text-label text-ink-muted">{row.supplierName}</span>
          )}
        </span>
      ),
    },
    {
      key: 'category',
      header: 'inventory.columns.category',
      hideOnMobile: true,
      render: (row) => (
        <Badge tone={categoryTone(row.category)}>{categoryLabel(row.category)}</Badge>
      ),
    },
    {
      key: 'current',
      header: 'inventory.shoppingList.current',
      align: 'numeric',
      render: (row) => (
        <span dir="ltr" className="text-danger-600">
          {row.quantity}
        </span>
      ),
    },
    {
      key: 'minimum',
      header: 'inventory.minimum',
      align: 'numeric',
      hideOnMobile: true,
      render: (row) => <span dir="ltr">{row.minQuantity}</span>,
    },
    {
      key: 'suggested',
      header: 'inventory.shoppingList.suggested',
      align: 'numeric',
      render: (row) => (
        <span className="flex items-baseline justify-end gap-1.5">
          <span dir="ltr" className="font-semibold text-ink">
            {row.suggested}
          </span>
          <span className="text-label text-ink-muted">{unitLabel(row.unit)}</span>
        </span>
      ),
    },
  ];

  const print = async (): Promise<void> => {
    const url = URL.createObjectURL(await inventoryApi.shoppingListPdf());

    window.open(url, '_blank', 'noopener');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="inventory.shoppingList.title"
        subtitle="inventory.shoppingList.subtitle"
        actions={
          <Button
            icon={<Icon name="print" />}
            disabled={(list.data?.lines.length ?? 0) === 0}
            onClick={() => void print()}
          >
            {t('inventory.shoppingList.print')}
          </Button>
        }
      />

      <Table
        columns={columns}
        rows={list.data?.lines ?? []}
        rowKey={(row) => row.itemId}
        isLoading={list.isPending}
        empty={
          <EmptyState
            icon="check"
            title="inventory.shoppingList.empty"
            hint="inventory.shoppingList.emptyHint"
          />
        }
      />

      {list.data && list.data.lines.length > 0 && (
        <p className="text-label text-ink-muted">
          {t('inventory.shoppingList.note')} —{' '}
          <span dir="ltr">{formatDate(list.data.generatedAt)}</span>
        </p>
      )}
    </div>
  );
}
