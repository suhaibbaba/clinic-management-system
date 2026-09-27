import {
  LOOKUP_LIST,
  MOVEMENT_TYPE,
  type ItemBatch,
  type MovementType,
  type StockMovementRow,
} from "@clinic/shared";
import { useState, type JSX, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  Drawer,
  EmptyState,
  Icon,
  Ltr,
  MenuItem,
  Modal,
  PersonName,
  RowMenu,
  Textarea,
  useToast,
} from "@clinic/ui";
import { RefreshBar, SkeletonTimeline } from "@clinic/ui/components/skeleton";
import { useSession } from "@web/features/auth/session";
import { useLookupLabels } from "@web/features/lookups/queries";
import { useClinic } from "@web/features/clinic/queries";
import { categoryTone, MOVEMENT_TONES, movementLabel } from "@web/features/inventory/display";
import { ItemFormModal } from "@web/features/inventory/item-form-modal";
import { MovementModal, mayRecord } from "@web/features/inventory/movement-modal";
import { canManageInventory, canReverseMovement } from "@web/features/inventory/permissions";
import {
  useInventoryItem,
  useItemBatches,
  useItemMovements,
  useReverseMovement,
} from "@web/features/inventory/queries";
import { errorMessageKey } from "@web/lib/api-error";
import { cn } from "@clinic/ui/lib/cn";
import { formatDate, moneyText, visitMoment } from "@web/lib/format";
import { useQueryLoading } from "@clinic/ui/lib/use-delayed-loading";

export function ItemDrawer({
  itemId,
  onClose,
  "data-testid": testId = "item-drawer",
}: {
  readonly "data-testid"?: string | undefined;
  readonly itemId: string | null;
  readonly onClose: () => void;
}): JSX.Element | null {
  const { t } = useTranslation();
  const categoryLabel = useLookupLabels(LOOKUP_LIST.ITEM_CATEGORY);
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
  const { can } = useSession();
  const navigate = useNavigate();

  const [movement, setMovement] = useState<MovementType | null>(null);
  const [editing, setEditing] = useState(false);

  const item = useInventoryItem(itemId ?? "");
  const batches = useItemBatches(itemId ?? "");
  const movements = useItemMovements(itemId ?? "", { limit: 50 });
  const { showSkeleton, isRefreshing } = useQueryLoading(movements);

  if (itemId === null) {
    return null;
  }

  const row = item.data;
  const actions: readonly MovementType[] = [
    MOVEMENT_TYPE.PURCHASE,
    MOVEMENT_TYPE.CONSUME,
    MOVEMENT_TYPE.ADJUST,
  ];

  return (
    <>
      <Drawer
        data-testid={testId}
        open
        onOpenChange={(open) => !open && onClose()}
        descriptionKey="inventory.drawer.description"
        title={
          <span className="flex flex-wrap items-center gap-2">
            {row?.name ?? "…"}
            {row && (
              <Badge tone={categoryTone(row.category)} data-testid={`${testId}-category`}>
                {categoryLabel(row.category)}
              </Badge>
            )}
            {row?.isLow && (
              <Badge tone="danger" data-testid={`${testId}-low`}>
                {t("inventory.flags.low")}
              </Badge>
            )}
          </span>
        }
        footer={
          <div className="flex flex-wrap items-center gap-2">
            {actions
              .filter((type) => mayRecord(type, can))
              .map((type) => (
                <Button
                  key={type}
                  data-testid={`${testId}-movement-${type}`}
                  variant={type === MOVEMENT_TYPE.ADJUST ? "ghost" : "primary"}
                  disabled={!row}
                  onClick={() => setMovement(type)}
                >
                  {t(`inventory.movement.action.${type}`)}
                </Button>
              ))}
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          {row && (
            <>
              <dl
                data-testid={`${testId}-details`}
                className="grid grid-cols-2 gap-x-4 gap-y-3 text-value"
              >
                <Field label={t("inventory.columns.quantity")}>
                  <span className="flex items-baseline gap-1.5">
                    <Ltr className="font-medium tabular-nums">{row.quantity}</Ltr>
                    <span className="text-label text-ink-muted">{unitLabel(row.unit)}</span>
                  </span>
                </Field>
                <Field label={t("inventory.minimum")}>
                  <Ltr className="tabular-nums">{row.minQuantity}</Ltr>{" "}
                  <span className="text-label text-ink-muted">{unitLabel(row.unit)}</span>
                </Field>
                {row.supplierName && (
                  <Field label={t("inventory.movement.supplier")}>{row.supplierName}</Field>
                )}
                {row.nearestExpiry && (
                  <Field label={t("inventory.columns.expiry")}>
                    <Ltr className={row.isExpired ? "text-danger-600" : undefined}>
                      {formatDate(row.nearestExpiry)}
                    </Ltr>
                  </Field>
                )}
                {row.notes && (
                  <Field wide label={t("inventory.notes")}>
                    {row.notes}
                  </Field>
                )}
              </dl>

              {canManageInventory(can) && (
                <div>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Icon name="edit" />}
                    data-testid={`${testId}-edit`}
                    onClick={() => setEditing(true)}
                  >
                    {t("inventory.editItem")}
                  </Button>
                </div>
              )}
            </>
          )}

          <Batches
            batches={batches.data?.batches ?? []}
            unbatched={batches.data?.unbatched ?? "0"}
            unit={row ? unitLabel(row.unit) : ""}
          />

          <History
            movements={movements.data?.items ?? []}
            isLoading={showSkeleton}
            isRefreshing={isRefreshing}
            onOpenPatient={(patientId) => {
              onClose();
              void navigate(`/patients/${patientId}`);
            }}
          />
        </div>
      </Drawer>

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
    </>
  );
}

// The assumption is written on the panel: the ledger does not record which box an ampoule came
// from, so this is oldest-first applied to the numbers.
function Batches({
  batches,
  unbatched,
  unit,
}: {
  readonly batches: readonly ItemBatch[];
  readonly unbatched: string;
  readonly unit: string;
}): JSX.Element {
  const { t } = useTranslation();
  const live = batches.filter((batch) => Number(batch.remaining) > 0);

  return (
    <section data-testid="item-batches" className="flex flex-col gap-2">
      <div>
        <h3 className="text-label font-semibold text-ink">{t("inventory.batches.title")}</h3>
        <p className="text-meta text-ink-muted">{t("inventory.batches.hint")}</p>
      </div>

      {live.length === 0 ? (
        <p data-testid="item-batches-empty" className="text-label text-ink-muted">
          {t("inventory.batches.empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {live.map((batch) => (
            <li
              key={`${batch.batchNo ?? "none"}-${batch.receivedAt}`}
              data-testid={`item-batch-${batch.batchNo ?? "none"}`}
              className={cn(
                "flex flex-wrap items-baseline justify-between gap-2 rounded-panel px-3 py-2",
                batch.isExpired ? "bg-danger-50" : batch.isExpiring ? "bg-warning-50" : "bg-inset",
              )}
            >
              <span className="flex flex-wrap items-baseline gap-2">
                <Ltr className="text-label font-medium text-ink">
                  {batch.batchNo ?? t("inventory.batches.unlabelled")}
                </Ltr>
                {batch.expiryDate && (
                  <Ltr className="text-label text-ink-muted">{formatDate(batch.expiryDate)}</Ltr>
                )}
                {batch.isExpired && <Badge tone="danger">{t("inventory.flags.expired")}</Badge>}
                {batch.isExpiring && <Badge tone="warning">{t("inventory.flags.expiring")}</Badge>}
              </span>
              <span className="flex items-baseline gap-1 text-label text-ink">
                <Ltr className="tabular-nums">
                  {batch.remaining} / {batch.quantity}
                </Ltr>
                <span className="text-ink-muted">{unit}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {Number(unbatched) > 0 && (
        <p className="flex items-baseline justify-between text-label text-ink-muted">
          <span>{t("inventory.batches.unbatched")}</span>
          <span className="flex items-baseline gap-1">
            <Ltr className="tabular-nums text-ink">{unbatched}</Ltr>
            <span>{unit}</span>
          </span>
        </p>
      )}

      <p className="text-label text-ink-subtle">{t("inventory.batches.assumption")}</p>
    </section>
  );
}

function History({
  movements,
  isLoading,
  isRefreshing,
  onOpenPatient,
}: {
  readonly movements: readonly StockMovementRow[];
  readonly isLoading: boolean;
  readonly isRefreshing: boolean;
  readonly onOpenPatient: (patientId: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const { can } = useSession();
  const toast = useToast();
  const clinic = useClinic();
  const reverse = useReverseMovement();

  const [reversing, setReversing] = useState<StockMovementRow | null>(null);
  const [reason, setReason] = useState("");

  const submit = async (): Promise<void> => {
    if (!reversing) {
      return;
    }

    try {
      await reverse.mutateAsync({ id: reversing.id, reason: reason.trim() });
      toast.success("inventory.movement.reversed");
      setReversing(null);
      setReason("");
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <section data-testid="item-history" className="flex flex-col gap-2">
      <h3 className="text-label font-semibold text-ink">{t("inventory.history.title")}</h3>

      <RefreshBar active={isRefreshing} />

      {isLoading && <SkeletonTimeline entries={3} />}

      {!isLoading && movements.length === 0 && (
        <EmptyState
          icon="clipboard"
          data-testid="item-history-empty"
          title="inventory.history.empty"
        />
      )}

      <ol className="flex flex-col">
        {movements.map((movement) => {
          const out = movement.quantity.startsWith("-");
          const mayReverse =
            canReverseMovement(can) && movement.reversedAt === null && movement.reversesId === null;
          const details = [
            movement.supplierName,
            movement.batchNo ? t("inventory.history.batch", { batch: movement.batchNo }) : null,
            movement.unitPrice
              ? t("inventory.history.unitPrice", {
                  price: moneyText(movement.unitPrice, clinic.data?.currency),
                })
              : null,
          ].filter(Boolean);

          return (
            <li
              key={movement.id}
              data-testid={`item-movement-${movement.id}`}
              className="flex gap-3 border-b border-line py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={MOVEMENT_TONES[movement.type]} data-testid="item-movement-type">
                    {t(movementLabel(movement.type))}
                  </Badge>
                  {movement.reversesId && (
                    <Badge tone="neutral" data-testid="item-movement-reversal">
                      {t("inventory.history.reversal")}
                    </Badge>
                  )}
                  {movement.reversedAt && (
                    <Badge tone="neutral" data-testid="item-movement-reversed">
                      {t("inventory.history.reversed")}
                    </Badge>
                  )}
                </div>

                {movement.patientId && (
                  <button
                    type="button"
                    data-testid="item-movement-patient"
                    onClick={() => onOpenPatient(movement.patientId as string)}
                    className="mt-1 block max-w-full cursor-pointer truncate text-start text-value font-medium text-primary-700 hover:underline"
                  >
                    {movement.patientName}
                    {movement.procedureName ? ` · ${movement.procedureName}` : ""}
                  </button>
                )}
                {details.length > 0 && (
                  <p className="mt-1 text-meta text-ink">{details.join(" · ")}</p>
                )}
                {movement.reason && (
                  // Its own reading order, the page's alignment: `dir="auto"` would push an Arabic
                  // reason to the far edge of an English drawer.
                  <p className="mt-1 text-meta text-ink [unicode-bidi:plaintext] page-rtl:text-right page-ltr:text-left">
                    {movement.reason}
                  </p>
                )}

                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-meta text-ink-muted">
                  <Ltr>{visitMoment(movement.createdAt)}</Ltr>
                  {movement.createdByName && (
                    <>
                      <span aria-hidden="true">·</span>
                      <PersonName name={movement.createdByName} />
                    </>
                  )}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-0.5 text-end">
                <Ltr
                  data-testid="item-movement-quantity"
                  className={cn(
                    "text-value font-semibold tabular-nums",
                    out ? "text-danger-600" : "text-success-700",
                  )}
                >
                  {out ? `\u2212${movement.quantity.slice(1)}` : `+${movement.quantity}`}
                </Ltr>
                <span className="text-meta text-ink-muted">
                  {t("inventory.history.after")}{" "}
                  <Ltr className="tabular-nums text-ink">{movement.runningQuantity}</Ltr>
                </span>
              </div>

              {mayReverse ? (
                <RowMenu
                  label={t("inventory.history.menu")}
                  data-testid={`item-movement-${movement.id}-menu`}
                >
                  <MenuItem
                    icon="reset"
                    data-testid="item-movement-reverse"
                    onSelect={() => setReversing(movement)}
                  >
                    {t("inventory.history.reverse")}
                  </MenuItem>
                </RowMenu>
              ) : (
                <span className="w-(--control-h-sm) shrink-0" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>

      {/* A reversal writes the opposite entry rather than deleting anything,
          so it asks for the sentence that will sit beside it forever. */}
      <Modal
        data-testid="movement-reverse-modal"
        open={reversing !== null}
        onOpenChange={(open) => !open && setReversing(null)}
        title="inventory.history.reverseTitle"
        description={t("inventory.history.reverseDescription")}
        footer={
          <>
            <Button
              variant="secondary"
              data-testid="movement-reverse-cancel"
              onClick={() => setReversing(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              icon={<Icon name="reset" />}
              data-testid="movement-reverse-confirm"
              isLoading={reverse.isPending}
              disabled={reason.trim().length < 3}
              onClick={() => void submit()}
            >
              {t("inventory.history.reverse")}
            </Button>
          </>
        }
      >
        <label htmlFor="reverse-reason" className="mb-1.5 block text-label font-medium text-ink">
          {t("inventory.movement.reason")}
        </label>
        <Textarea
          id="reverse-reason"
          data-testid="movement-reverse-reason"
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Modal>
    </section>
  );
}

function Field({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className={cn("min-w-0", wide && "col-span-2")}>
      <dt className="text-meta text-ink-muted">{label}</dt>
      <dd className="mt-0.5 min-w-0 text-ink">{children}</dd>
    </div>
  );
}
