import { LOOKUP_LIST, type InventoryItemRow } from '@clinic/shared';
import { useMemo, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  Badge,
  Button,
  EmptyState,
  Icon,
  PageHeader,
  ProgressBar,
  SearchField,
  Select,
  Table,
  type Column,
} from '@web/components/ui';
import { useSession } from '@web/features/auth/session';
import { useLookupLabels, useLookupOptions } from '@web/features/lookups/queries';
import { InventoryAlertCards } from '@web/features/inventory/alert-cards';
import { categoryTone, stockScale, stockTone } from '@web/features/inventory/display';
import { ItemDrawer } from '@web/features/inventory/item-drawer';
import { ItemFormModal } from '@web/features/inventory/item-form-modal';
import { canManageInventory } from '@web/features/inventory/permissions';
import { useInventoryItems } from '@web/features/inventory/queries';
import { formatDate } from '@web/lib/format';
import { useDebounced } from '@web/lib/use-debounced';

/**
 * The store cupboard, as a list of what is in it.
 *
 * The quantity is the column people come here for, so it is drawn as a bar
 * against the reorder level rather than as a number they have to compare with
 * another number: the minimum sits at the halfway mark, and an empty red bar
 * says "order this" from across the room. The figure is there too — a bar
 * alone cannot say 3 of 10.
 *
 * Everything on this screen is computed from the ledger. There is no quantity
 * to edit here and no field to edit it with (CLAUDE.md).
 */
export function InventoryPage(): JSX.Element {
  const { t } = useTranslation();
  const categoryLabel = useLookupLabels(LOOKUP_LIST.ITEM_CATEGORY);
  const categoryOptions = useLookupOptions(LOOKUP_LIST.ITEM_CATEGORY);
  const { user } = useSession();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [low, setLow] = useState(false);
  const [expiring, setExpiring] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const debounced = useDebounced(search);

  const query = useMemo(
    () => ({
      limit: 100,
      ...(debounced.trim() !== '' && { search: debounced.trim() }),
      ...(category !== '' && { category }),
      ...(low && { low: true }),
      ...(expiring && { expiring: true }),
    }),
    [debounced, category, low, expiring],
  );

  const items = useInventoryItems(query);
  const rows = items.data?.items ?? [];
  const mayManage = canManageInventory(user?.role);

  const columns: readonly Column<InventoryItemRow>[] = [
    {
      key: 'name',
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
      render: (row) => (
        <Badge tone={categoryTone(row.category)}>{categoryLabel(row.category)}</Badge>
      ),
    },
    {
      key: 'quantity',
      header: 'inventory.columns.quantity',
      render: (row) => <StockCell item={row} />,
    },
    {
      key: 'expiry',
      header: 'inventory.columns.expiry',
      hideOnMobile: true,
      render: (row) =>
        row.nearestExpiry ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <span dir="ltr" className={row.isExpired ? 'text-danger-600' : undefined}>
              {formatDate(row.nearestExpiry)}
            </span>
            {row.isExpired && <Badge tone="danger">{t('inventory.flags.expired')}</Badge>}
            {row.isExpiring && <Badge tone="warning">{t('inventory.flags.expiring')}</Badge>}
          </span>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="inventory.title"
        subtitle="inventory.subtitle"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              icon={<Icon name="clipboard" />}
              onClick={() => void navigate('/inventory/shopping-list')}
            >
              {t('inventory.shoppingList.action')}
            </Button>
            {mayManage && (
              <Button icon={<Icon name="plus" />} onClick={() => setCreating(true)}>
                {t('inventory.addItem')}
              </Button>
            )}
          </div>
        }
      />

      {/* The alerts sit at the top of the screen the technician lives on.
          There is no dashboard yet (reports are Phase 3); when one lands, this
          is the component that moves onto it. */}
      <InventoryAlertCards
        onSelectItem={setOpenItemId}
        onShowLow={() => {
          setLow(true);
          setExpiring(false);
        }}
        onShowExpiring={() => {
          setExpiring(true);
          setLow(false);
        }}
      />

      <div className="flex flex-wrap items-end gap-3">
        <SearchField
          className="w-full min-w-0 sm:max-w-xs"
          label={t('inventory.search')}
          shortcut="/"
          placeholder={t('inventory.searchPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="min-w-44">
          <label htmlFor="inventory-category" className="mb-1 block text-label text-ink-muted">
            {t('inventory.filterCategory')}
          </label>
          <Select
            id="inventory-category"
            value={category}
            placeholder={t('common.all')}
            onChange={(event) => setCategory(event.target.value)}
            options={categoryOptions}
          />
        </div>

        <Button
          variant={low ? 'danger' : 'secondary'}
          icon={<Icon name="alert" />}
          onClick={() => setLow((previous) => !previous)}
        >
          {t('inventory.filterLow')}
        </Button>

        <Button
          variant={expiring ? 'danger' : 'secondary'}
          icon={<Icon name="clock" />}
          onClick={() => setExpiring((previous) => !previous)}
        >
          {t('inventory.filterExpiring')}
        </Button>
      </div>

      <Table
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        isLoading={items.isPending}
        onRowClick={(row) => setOpenItemId(row.id)}
        rowLabel={(row) => row.nameAr}
        empty={<EmptyState icon="clipboard" title="inventory.empty" hint="inventory.emptyHint" />}
      />

      <ItemDrawer itemId={openItemId} onClose={() => setOpenItemId(null)} />

      <ItemFormModal open={creating} onOpenChange={setCreating} />
    </div>
  );
}

/**
 * Quantity against the reorder level.
 *
 * The number, its unit, and a bar scaled so the minimum is the midpoint. Both
 * are needed: the bar is what the eye reads in a list of forty rows, and the
 * figure is what somebody writes on an order.
 */
function StockCell({ item }: { readonly item: InventoryItemRow }): JSX.Element {
  const { t } = useTranslation();
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
  const scale = stockScale(item);

  return (
    <span className="flex min-w-28 flex-col gap-1">
      <span className="flex items-baseline gap-1.5">
        <span dir="ltr" className="font-medium tabular-nums text-ink">
          {item.quantity}
        </span>
        <span className="text-label text-ink-muted">{unitLabel(item.unit)}</span>
        {item.isLow && (
          <Badge tone="danger" className="ms-auto">
            {t('inventory.flags.low')}
          </Badge>
        )}
      </span>

      <ProgressBar
        value={scale.value}
        total={scale.total}
        tone={stockTone(item)}
        label={t('inventory.stockBar', {
          quantity: item.quantity,
          minimum: item.minQuantity,
        })}
      />

      <span className="text-label text-ink-subtle">
        {t('inventory.minimum')}: <span dir="ltr">{item.minQuantity}</span>
      </span>
    </span>
  );
}
