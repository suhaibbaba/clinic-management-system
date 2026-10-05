import { LOOKUP_LIST, MOVEMENT_TYPE, type MovementType } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  Ltr,
  MenuItem,
  RowMenu,
  SegmentedControl,
  StatCard,
  StatRow,
  useConfirm,
  useTabParam,
  useToast,
} from "@clinic/ui";
import { useSession } from "@web/shared/providers/session";
import { useLookupLabels } from "@web/shared/queries/lookups";
import { categoryTone, stockTone } from "@web/modules/inventory/lib/display";
import { ItemBatches } from "@web/modules/inventory/components/item-batches";
import { ItemFormModal } from "@web/modules/inventory/components/item-form-modal";
import { Quantity } from "@web/modules/inventory/components/quantity";
import { ItemMovementsTab } from "@web/modules/inventory/pages/item-movements-tab";
import { MovementModal } from "@web/modules/inventory/components/movement-modal";
import { canDeleteItem, canManageInventory, mayRecord } from "@web/shared/permissions/inventory";
import { useDeleteItem, useInventoryItem, useItemBatches } from "@web/modules/inventory/queries";
import { errorToast } from "@web/shared/lib/api-error";
import { formatDate } from "@web/shared/lib/format";
import { Skeleton, SkeletonKpi } from "@clinic/ui/components/skeleton";
import { useQueryLoading } from "@clinic/ui/lib/use-delayed-loading";
import { useIsMobile } from "@clinic/ui/lib/use-media-query";
import {
  ITEM_PAGE_TABS,
  MOVEMENT_ACTIONS,
  MOVEMENT_ACTION_ICONS,
} from "@web/modules/inventory/constants";

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
  const mayDelete = canDeleteItem(can);

  const navigate = useNavigate();
  const toast = useToast();
  const remove = useDeleteItem();
  const { confirm, dialog } = useConfirm("item-confirm-delete");

  const askDelete = (): void => {
    if (!row) {
      return;
    }
    confirm({
      title: "inventory.item.confirmDelete.title",
      titleValues: { name: row.name },
      consequences: [
        t("inventory.item.confirmDelete.history"),
        t("inventory.item.confirmDelete.stock"),
      ],
      onConfirm: async () => {
        try {
          await remove.mutateAsync(row.id);
          toast.success("inventory.item.deleted");
          void navigate("/inventory", { replace: true });
        } catch (error) {
          toast.error(...errorToast(error));
          throw error;
        }
      },
    });
  };

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

            {(menuActions.length > 0 || mayEdit || mayDelete) && (
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
                {mayDelete && (
                  <MenuItem
                    icon="trash"
                    tone="danger"
                    data-testid="item-delete"
                    onSelect={askDelete}
                  >
                    {t("common.delete")}
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
          <ItemBatches batches={[]} unbatched="0" unit="" isLoading />
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

          <ItemBatches
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

      {tab === "movements" && <ItemMovementsTab itemId={id} />}

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

      {dialog}
    </div>
  );
}
