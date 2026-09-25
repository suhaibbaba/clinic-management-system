import {
  LOOKUP_LIST,
  MOVEMENT_TYPE,
  subtractQuantity,
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
  Modal,
  PersonName,
  Textarea,
  useToast,
} from "@clinic/ui";
import { RefreshBar, SkeletonTimeline } from "@clinic/ui/components/skeleton";
import { useSession } from "@web/features/auth/session";
import { useLookupLabels } from "@web/features/lookups/queries";
import { Money } from "@web/features/billing/money";
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
import { formatDate, formatDateTime } from "@web/lib/format";
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
                  <Ltr className="tabular-nums">{row.minQuantity}</Ltr>
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
}: {
  readonly batches: readonly ItemBatch[];
  readonly unbatched: string;
}): JSX.Element {
  const { t } = useTranslation();
  const live = batches.filter((batch) => Number(batch.remaining) > 0);

  return (
    <section data-testid="item-batches" className="flex flex-col gap-2">
      <h3 className="text-label font-semibold text-ink">{t("inventory.batches.title")}</h3>

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

              <Ltr className="text-label tabular-nums text-ink">
                {batch.remaining} / {batch.quantity}
              </Ltr>
            </li>
          ))}
        </ul>
      )}

      {Number(unbatched) > 0 && (
        <p className="flex items-baseline justify-between text-label text-ink-muted">
          <span>{t("inventory.batches.unbatched")}</span>
          <Ltr className="tabular-nums">{unbatched}</Ltr>
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

      <ol className="flex flex-col gap-2">
        {movements.map((movement) => (
          <li
            key={movement.id}
            data-testid={`item-movement-${movement.id}`}
            className="rounded-panel bg-canvas p-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="flex flex-wrap items-center gap-2">
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
              </span>

              <span className="flex items-baseline gap-3">
                <Ltr
                  className={cn(
                    "font-medium tabular-nums",
                    movement.quantity.startsWith("-") ? "text-danger-600" : "text-success-900",
                  )}
                >
                  {movement.quantity.startsWith("-") ? movement.quantity : `+${movement.quantity}`}
                </Ltr>
                {/* The icon set's arrow, not a literal `→`: a typed arrow points right in both
                    languages. It sits outside the island so the row decides its side. */}
                <span className="flex items-baseline gap-1 text-label text-ink-muted">
                  <span className="sr-only">{t("inventory.history.balance")}</span>
                  <Ltr className="tabular-nums">
                    {subtractQuantity(movement.runningQuantity, movement.quantity)}
                  </Ltr>
                  <Icon name="chevron-end" className="size-3.5 self-center" />
                  <Ltr className="tabular-nums">{movement.runningQuantity}</Ltr>
                </span>
              </span>
            </div>

            <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-label text-ink-muted">
              <div className="flex gap-1">
                <dt className="sr-only">{t("inventory.history.when")}</dt>
                <Ltr as="dd">{formatDateTime(movement.createdAt)}</Ltr>
              </div>

              {movement.createdByName && (
                <dd>
                  <PersonName name={movement.createdByName} />
                </dd>
              )}
              {movement.supplierName && <dd>{movement.supplierName}</dd>}
              {movement.batchNo && <Ltr as="dd">{movement.batchNo}</Ltr>}

              {movement.unitPrice && (
                <Ltr as="dd">
                  <Money amount={movement.unitPrice} currency={clinic.data?.currency} />
                </Ltr>
              )}
            </dl>

            {movement.patientId && (
              <button
                type="button"
                data-testid="item-movement-patient"
                onClick={() => onOpenPatient(movement.patientId as string)}
                className="-my-3 cursor-pointer py-3 text-label font-medium text-primary-700 hover:underline lg:my-0 lg:mt-1 lg:py-0"
              >
                {movement.patientName}
                {movement.procedureName ? ` — ${movement.procedureName}` : ""}
              </button>
            )}

            {movement.reason && <p className="mt-1 text-label text-ink">{movement.reason}</p>}

            {canReverseMovement(can) &&
              movement.reversedAt === null &&
              movement.reversesId === null && (
                <Button
                  className="mt-2"
                  size="sm"
                  variant="ghost"
                  icon={<Icon name="reset" />}
                  data-testid="item-movement-reverse"
                  onClick={() => setReversing(movement)}
                >
                  {t("inventory.history.reverse")}
                </Button>
              )}
          </li>
        ))}
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
