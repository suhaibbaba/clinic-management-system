import { LOOKUP_LIST, MOVEMENT_TYPE, type ItemBatch, type MovementType } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  type Column,
  EmptyState,
  Ltr,
  MenuItem,
  RowMenu,
  SegmentedControl,
  StatCard,
  StatRow,
  Table,
  useTabParam,
} from "@clinic/ui";
import { useSession } from "@web/providers/session";
import { useLookupLabels } from "@web/queries/lookups";
import { categoryTone, stockTone } from "@web/lib/inventory/display";
import { ItemFormModal } from "@web/components/inventory/item-form-modal";
import { ItemMovements } from "@web/components/inventory/item-movements";
import { MovementModal, mayRecord } from "@web/components/inventory/movement-modal";
import { canManageInventory } from "@web/permissions/inventory";
import { useInventoryItem, useItemBatches } from "@web/queries/inventory";
import { formatDate } from "@web/lib/format";
import { Skeleton, SkeletonKpi } from "@clinic/ui/components/skeleton";
import { useQueryLoading } from "@clinic/ui/lib/use-delayed-loading";
import { useIsMobile } from "@clinic/ui/lib/use-media-query";
import {
  ITEM_PAGE_TABS,
  MOVEMENT_ACTIONS,
  MOVEMENT_ACTION_ICONS,
  UNBATCHED_ROW_KEY,
} from "@web/constants/inventory";

type Tab = (typeof ITEM_PAGE_TABS)[number];

export function ItemPage(): JSX.Element {
  const { t } = useTranslation();
  const { id = "" } = useParams<{ id: string }>();
  const { can } = useSession();
  const categoryLabel = useLookupLabels(LOOKUP_LIST.ITEM_CATEGORY);
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);

  const [tab, setTab] = useTabParam<Tab>("tab", ITEM_PAGE_TABS, "overview", ["page"]);
  const [movement, setMovement] = useState<MovementType | null>(null);
  const [editing, setEditing] = useState(false);

  const item = useInventoryItem(id);
  const batches = useItemBatches(id);
  const row = item.data;
  const { showSkeleton } = useQueryLoading(item);
  const unit = row ? unitLabel(row.unit) : "";

  const isMobile = useIsMobile();
  const allowed = MOVEMENT_ACTIONS.filter((type) => mayRecord(type, can));
  const buttons = allowed.filter((type) => type !== MOVEMENT_TYPE.ADJUST);
  const menuActions = isMobile ? allowed : allowed.filter((type) => type === MOVEMENT_TYPE.ADJUST);
  const mayEdit = canManageInventory(can);

  return (
    <div data-testid="item-page" className="flex flex-col gap-5">
      <header data-testid="item-header" className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 data-testid="item-name" className="truncate text-title font-medium text-primary-900">
            {row ? <bdi>{row.name}</bdi> : <Skeleton className="h-7 w-56 max-w-full" />}
          </h1>
          {row && (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-value text-ink-muted">
              <Badge tone={categoryTone(row.category)} data-testid="item-category">
                {categoryLabel(row.category)}
              </Badge>
              {row.isLow && (
                <Badge tone="danger" data-testid="item-low">
                  {t("inventory.flags.low")}
                </Badge>
              )}
              {row.supplierName && <span>{row.supplierName}</span>}
            </p>
          )}
        </div>

        {row && (
          <div className="flex shrink-0 items-center gap-2">
            {!isMobile &&
              buttons.map((type) => (
                <Button
                  key={type}
                  data-testid={`item-movement-${type}`}
                  variant={type === MOVEMENT_TYPE.PURCHASE ? "primary" : "secondary"}
                  onClick={() => setMovement(type)}
                >
                  {t(`inventory.movement.action.${type}`)}
                </Button>
              ))}

            {(menuActions.length > 0 || mayEdit) && (
              <RowMenu
                size="target"
                label={t("inventory.itemPage.actions")}
                data-testid="item-actions"
              >
                {menuActions.map((type) => (
                  <MenuItem
                    key={type}
                    icon={MOVEMENT_ACTION_ICONS[type]}
                    data-testid={`item-movement-${type}`}
                    onSelect={() => setMovement(type)}
                  >
                    {t(`inventory.movement.action.${type}`)}
                  </MenuItem>
                ))}
                {mayEdit && (
                  <MenuItem icon="edit" data-testid="item-edit" onSelect={() => setEditing(true)}>
                    {t("inventory.editItem")}
                  </MenuItem>
                )}
              </RowMenu>
            )}
          </div>
        )}
      </header>

      <SegmentedControl
        data-testid="item-tabs"
        label={t("inventory.itemPage.tabs")}
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: t("inventory.itemPage.overview") },
          { value: "movements", label: t("inventory.history.title") },
        ]}
      />

      {tab === "overview" && showSkeleton && !row && (
        <>
          <SkeletonKpi count={3} />
          <Batches batches={[]} unbatched="0" unit="" isLoading />
        </>
      )}

      {tab === "overview" && row && (
        <>
          <StatRow data-testid="item-kpis">
            <StatCard
              icon="package"
              data-testid="item-kpi-quantity"
              tone={stockTone(row)}
              label={t("inventory.columns.quantity")}
              value={<Quantity value={row.quantity} unit={unit} />}
            />
            <StatCard
              icon="alert"
              data-testid="item-kpi-minimum"
              tone="neutral"
              label={t("inventory.minimum")}
              value={<Quantity value={row.minQuantity} unit={unit} />}
            />
            <StatCard
              icon="clock"
              data-testid="item-kpi-expiry"
              tone={row.isExpired ? "danger" : row.isExpiring ? "warning" : "neutral"}
              label={t("inventory.columns.expiry")}
              value={row.nearestExpiry ? <Ltr>{formatDate(row.nearestExpiry)}</Ltr> : "—"}
            />
          </StatRow>

          <Batches
            batches={batches.data?.batches ?? []}
            unbatched={batches.data?.unbatched ?? "0"}
            unit={unit}
            isLoading={batches.isPending}
          />

          {row.notes && (
            <Card data-testid="item-notes">
              <h2 className="text-label font-semibold text-ink">{t("inventory.notes")}</h2>
              <p className="mt-1 max-w-(--form-max) text-value text-ink">{row.notes}</p>
            </Card>
          )}
        </>
      )}

      {tab === "movements" && <ItemMovements itemId={id} />}

      <MovementModal
        data-testid="movement-modal"
        type={movement}
        item={row}
        onClose={() => setMovement(null)}
      />

      {row && (
        <ItemFormModal
          data-testid="item-edit-modal"
          open={editing}
          onOpenChange={setEditing}
          item={row}
        />
      )}
    </div>
  );
}

function Quantity({ value, unit }: { readonly value: string; readonly unit: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <Ltr className="tabular-nums">{value}</Ltr>
      <span className="text-label font-normal text-ink-muted">{unit}</span>
    </span>
  );
}

interface ShelfRow {
  readonly key: string;
  readonly batchNo: string | null;
  readonly expiryDate: string | null;
  readonly receivedAt: string | null;
  readonly remaining: string;
  readonly quantity: string | null;
  readonly isExpired: boolean;
  readonly isExpiring: boolean;
}

const byExpiry = (a: ItemBatch, b: ItemBatch): number =>
  (a.expiryDate ?? "9999").localeCompare(b.expiryDate ?? "9999") ||
  a.receivedAt.localeCompare(b.receivedAt);

function Batches({
  batches,
  unbatched,
  unit,
  isLoading,
}: {
  readonly batches: readonly ItemBatch[];
  readonly unbatched: string;
  readonly unit: string;
  readonly isLoading: boolean;
}): JSX.Element {
  const { t } = useTranslation();

  const rows: ShelfRow[] = [
    ...batches
      .filter((batch) => Number(batch.remaining) > 0)
      .sort(byExpiry)
      .map((batch) => ({ ...batch, key: `${batch.batchNo ?? "none"}-${batch.receivedAt}` })),
    ...(Number(unbatched) > 0
      ? [
          {
            key: UNBATCHED_ROW_KEY,
            batchNo: null,
            expiryDate: null,
            receivedAt: null,
            remaining: unbatched,
            quantity: null,
            isExpired: false,
            isExpiring: false,
          },
        ]
      : []),
  ];

  const columns: readonly Column<ShelfRow>[] = [
    {
      key: "batch",
      header: "inventory.batches.columns.batch",
      primary: true,
      render: (row) =>
        row.batchNo ? (
          <Ltr className="font-medium text-ink">{row.batchNo}</Ltr>
        ) : (
          <span className="text-ink-muted">
            {t(
              row.key === UNBATCHED_ROW_KEY
                ? "inventory.batches.unbatched"
                : "inventory.batches.unlabelled",
            )}
          </span>
        ),
    },
    {
      key: "expiry",
      header: "inventory.batches.columns.expiry",
      render: (row) =>
        row.expiryDate ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <Ltr className={row.isExpired ? "text-danger-600" : undefined}>
              {formatDate(row.expiryDate)}
            </Ltr>
            {row.isExpired && <Badge tone="danger">{t("inventory.flags.expired")}</Badge>}
            {row.isExpiring && <Badge tone="warning">{t("inventory.flags.expiring")}</Badge>}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "received",
      header: "inventory.batches.columns.received",
      hideOnMobile: true,
      render: (row) => (row.receivedAt ? <Ltr>{formatDate(row.receivedAt)}</Ltr> : "—"),
    },
    {
      key: "left",
      header: "inventory.batches.columns.left",
      render: (row) => (
        <span className="flex flex-wrap items-baseline gap-x-1.5">
          <Ltr className="font-medium tabular-nums text-ink">{row.remaining}</Ltr>
          <span className="text-ink-muted">{unit}</span>
          {row.quantity !== null && (
            <span className="text-label text-ink-subtle">
              {t("inventory.batches.of", { quantity: row.quantity })}
            </span>
          )}
        </span>
      ),
    },
  ];

  return (
    <section data-testid="item-batches" className="flex flex-col gap-3">
      <div>
        <h2 className="text-value font-medium text-ink">{t("inventory.batches.title")}</h2>
        <p className="text-label text-ink-muted">{t("inventory.batches.hint")}</p>
      </div>

      <Table
        data-testid="item-batches-table"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.key}
        isLoading={isLoading}
        empty={
          <EmptyState
            icon="package"
            data-testid="item-batches-empty"
            title="inventory.batches.empty"
          />
        }
      />

      {rows.length > 0 && (
        <p className="text-label text-ink-subtle">{t("inventory.batches.assumption")}</p>
      )}
    </section>
  );
}
