import {
  LOOKUP_LIST,
  MOVEMENT_TYPE,
  toThousandths,
  type InventoryItemRow,
  type MovementType,
} from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  DatePicker,
  FormField,
  Icon,
  Input,
  Ltr,
  Modal,
  MoneyInput,
  QuantityInput,
  Select,
  Textarea,
  useToast,
} from "@clinic/ui";
import {
  PatientPicker,
  type PatientChoice,
  type PickedPatient,
} from "@web/features/appointments/patient-picker";
import { useLookupLabels } from "@web/features/lookups/queries";
import { useSession, type Can } from "@web/features/auth/session";
import {
  canAdjustStock,
  canConsumeStock,
  canPurchaseStock,
} from "@web/features/inventory/permissions";
import {
  useAdjustStock,
  useConsumeStock,
  usePurchaseStock,
  useSuppliers,
} from "@web/features/inventory/queries";
import { errorMessageKey } from "@web/lib/api-error";
import { useCurrency } from "@web/features/clinic/queries";

/** Which permission each form asks for, as a lookup. */
export const mayRecord = (type: MovementType, can: Can): boolean =>
  ({
    [MOVEMENT_TYPE.PURCHASE]: canPurchaseStock,
    [MOVEMENT_TYPE.CONSUME]: canConsumeStock,
    [MOVEMENT_TYPE.ADJUST]: canAdjustStock,
  })[type](can);

export interface MovementModalProps {
  readonly "data-testid"?: string | undefined;
  readonly type: MovementType | null;
  readonly item: InventoryItemRow | undefined;
  readonly choices?: readonly InventoryItemRow[] | undefined;
  readonly onClose: () => void;
  readonly patient?: PickedPatient | undefined;
  readonly performedProcedureId?: string | undefined;
}

// Fields are switched on the type rather than half disabled: the three share only a quantity. The
// sign is never a field — "how many did you use" is positive and stored negative.
export function MovementModal({
  type,
  item: fixedItem,
  choices,
  onClose,
  patient,
  performedProcedureId,
  "data-testid": testId = "movement-modal",
}: MovementModalProps): JSX.Element | null {
  const { t } = useTranslation();
  const currency = useCurrency();
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
  const toast = useToast();
  const { can } = useSession();

  const purchase = usePurchaseStock();
  const consume = useConsumeStock();
  const adjust = useAdjustStock();

  const suppliers = useSuppliers({ limit: 100 });

  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [reason, setReason] = useState("");
  const [direction, setDirection] = useState<"add" | "remove">("remove");
  const [linkedPatient, setLinkedPatient] = useState<PatientChoice | null>(null);
  const [pickedId, setPickedId] = useState("");
  // Restocking is a purchase of the item in hand, recorded without leaving the use it was for.
  const [restocking, setRestocking] = useState(false);

  const item = fixedItem ?? choices?.find((choice) => choice.id === pickedId);

  useEffect(() => {
    if (type === null) {
      return;
    }

    setQuantity("");
    setUnitPrice("");
    setPickedId("");
    setRestocking(false);
    setSupplierId(fixedItem?.defaultSupplierId ?? "");
    setBatchNo("");
    setExpiryDate("");
    setReason("");
    setDirection("remove");
    setLinkedPatient(patient ? { kind: "existing", patient } : null);
  }, [type, fixedItem, patient]);

  if (type === null || (!fixedItem && !choices)) {
    return null;
  }

  const mode = restocking ? MOVEMENT_TYPE.PURCHASE : type;
  // A use, or a correction taking stock off, cannot take more than the shelf holds.
  const takingOff =
    mode === MOVEMENT_TYPE.CONSUME || (mode === MOVEMENT_TYPE.ADJUST && direction === "remove");
  const overdrawn =
    takingOff &&
    item !== undefined &&
    quantity.trim() !== "" &&
    toThousandths(quantity.trim()) > toThousandths(item.quantity);

  const belowOne =
    mode === MOVEMENT_TYPE.ADJUST &&
    direction === "remove" &&
    quantity.trim() !== "" &&
    toThousandths(quantity.trim()) < 1000;

  const busy = purchase.isPending || consume.isPending || adjust.isPending;
  const canSubmit =
    item !== undefined &&
    quantity.trim() !== "" &&
    !overdrawn &&
    !belowOne &&
    (type !== MOVEMENT_TYPE.ADJUST || reason.trim().length >= 3);

  const submit = async (): Promise<void> => {
    if (!item) {
      return;
    }

    try {
      if (mode === MOVEMENT_TYPE.PURCHASE) {
        await purchase.mutateAsync({
          itemId: item.id,
          quantity: quantity.trim(),
          ...(unitPrice.trim() !== "" && { unitPrice: unitPrice.trim() }),
          ...(supplierId !== "" && { supplierId }),
          ...(batchNo.trim() !== "" && { batchNo: batchNo.trim() }),
          ...(expiryDate !== "" && { expiryDate }),
        });
      } else if (mode === MOVEMENT_TYPE.CONSUME) {
        await consume.mutateAsync({
          itemId: item.id,
          quantity: quantity.trim(),
          ...(linkedPatient?.kind === "existing" && { patientId: linkedPatient.patient.id }),
          ...(performedProcedureId && { performedProcedureId }),
          ...(batchNo.trim() !== "" && { batchNo: batchNo.trim() }),
          ...(reason.trim() !== "" && { reason: reason.trim() }),
        });
      } else {
        await adjust.mutateAsync({
          itemId: item.id,
          quantity: `${direction === "remove" ? "-" : ""}${quantity.trim()}`,
          reason: reason.trim(),
          ...(batchNo.trim() !== "" && { batchNo: batchNo.trim() }),
        });
      }

      toast.success(`inventory.movement.recorded.${mode}`);

      if (restocking) {
        setRestocking(false);
        setQuantity("");
        setUnitPrice("");
        setBatchNo("");
        setExpiryDate("");
        return;
      }

      onClose();
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <Modal
      data-testid={testId}
      open
      onOpenChange={(open) => !open && onClose()}
      title={
        item
          ? t(`inventory.movement.title.${mode}`, { item: item.name })
          : t("inventory.movement.consumeFromVisit")
      }
      description={
        choices
          ? t("inventory.movement.consumeFromVisitDescription")
          : t(`inventory.movement.description.${mode}`)
      }
      footer={
        <>
          <Button variant="secondary" data-testid={`${testId}-cancel`} onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            data-testid={`${testId}-save`}
            disabled={!canSubmit}
            isLoading={busy}
            onClick={() => void submit()}
          >
            {t(`inventory.movement.submit.${mode}`)}
          </Button>
        </>
      }
    >
      <div data-testid={`${testId}-form`} className="flex flex-col gap-4">
        {choices && (
          <FormField label="inventory.movement.item" htmlFor="movement-item" required>
            <Select
              searchable
              id="movement-item"
              data-testid="movement-field-item"
              value={pickedId}
              placeholder={t("inventory.movement.selectItem")}
              onChange={(event) => setPickedId(event.target.value)}
              options={choices.map((choice) => ({
                value: choice.id,
                label: `${choice.name} — ${choice.quantity} ${unitLabel(choice.unit)}`,
              }))}
            />
          </FormField>
        )}
        {item && (
          <div
            data-testid={`${testId}-on-hand`}
            className="flex items-baseline justify-between rounded-panel bg-inset px-3 py-2"
          >
            <span className="text-label text-ink-muted">{t("inventory.movement.onHand")}</span>
            <span className="flex items-baseline gap-1.5">
              <Ltr className="font-medium tabular-nums text-ink">{item.quantity}</Ltr>
              <span className="text-label text-ink-muted">{unitLabel(item.unit)}</span>
            </span>
          </div>
        )}

        {item && type === MOVEMENT_TYPE.CONSUME && canPurchaseStock(can) && (
          <Button
            size="sm"
            variant="quiet"
            className="-mt-2 self-start"
            icon={<Icon name={restocking ? "chevron-start" : "plus"} />}
            data-testid={`${testId}-restock`}
            onClick={() => {
              setRestocking(!restocking);
              setQuantity("");
              setSupplierId(item.defaultSupplierId ?? "");
            }}
          >
            {t(restocking ? "inventory.movement.backToUse" : "inventory.movement.restock")}
          </Button>
        )}
        {mode === MOVEMENT_TYPE.ADJUST && (
          <FormField label="inventory.movement.direction" htmlFor="movement-direction">
            <Select
              id="movement-direction"
              data-testid="movement-field-direction"
              value={direction}
              onChange={(event) => setDirection(event.target.value as "add" | "remove")}
              options={[
                { value: "remove", label: t("inventory.movement.directions.remove") },
                { value: "add", label: t("inventory.movement.directions.add") },
              ]}
            />
          </FormField>
        )}
        <FormField
          label="inventory.movement.quantity"
          htmlFor="movement-quantity"
          {...(item && { hint: unitLabel(item.unit) })}
          {...(overdrawn && {
            error: { type: "too_big" },
            errorKey: "inventory.movement.overStock",
          })}
          {...(belowOne && {
            error: { type: "too_small" },
            errorKey: "inventory.movement.atLeastOne",
          })}
          required
        >
          <QuantityInput
            id="movement-quantity"
            data-testid="movement-field-quantity"
            placeholder="0"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </FormField>
        {mode === MOVEMENT_TYPE.PURCHASE && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="inventory.movement.unitPrice" htmlFor="movement-price" optional>
                <MoneyInput
                  id="movement-price"
                  data-testid="movement-field-price"
                  currency={currency}
                  placeholder="0"
                  value={unitPrice}
                  onChange={(event) => setUnitPrice(event.target.value)}
                />
              </FormField>
              <FormField label="inventory.movement.supplier" htmlFor="movement-supplier" optional>
                <Select
                  id="movement-supplier"
                  data-testid="movement-field-supplier"
                  value={supplierId}
                  placeholder={t("inventory.movement.selectSupplier")}
                  onChange={(event) => setSupplierId(event.target.value)}
                  options={(suppliers.data?.items ?? []).map((supplier) => ({
                    value: supplier.id,
                    label: supplier.name,
                  }))}
                />
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="inventory.movement.batchNo" htmlFor="movement-batch" optional>
                <Input
                  id="movement-batch"
                  data-testid="movement-field-batch"
                  dir="ltr"
                  placeholder="LX-2451"
                  value={batchNo}
                  onChange={(event) => setBatchNo(event.target.value)}
                />
              </FormField>
              <FormField label="inventory.movement.expiry" htmlFor="movement-expiry" optional>
                <DatePicker
                  id="movement-expiry"
                  data-testid="movement-field-expiry"
                  label={t("inventory.movement.expiry")}
                  value={expiryDate}
                  onChange={setExpiryDate}
                />
              </FormField>
            </div>
          </>
        )}
        {mode === MOVEMENT_TYPE.CONSUME && !performedProcedureId && (
          <FormField label="inventory.movement.patient" htmlFor="movement-patient" optional>
            <PatientPicker
              id="movement-patient"
              allowNew={false}
              value={linkedPatient}
              onChange={setLinkedPatient}
            />
          </FormField>
        )}
        {mode === MOVEMENT_TYPE.CONSUME && performedProcedureId && (
          <p
            data-testid={`${testId}-linked-procedure`}
            className="rounded-panel bg-inset px-3 py-2 text-label text-ink-muted"
          >
            {t("inventory.movement.linkedToProcedure")}
          </p>
        )}
        <FormField
          label={
            mode === MOVEMENT_TYPE.ADJUST ? "inventory.movement.reason" : "inventory.movement.note"
          }
          htmlFor="movement-reason"
          {...(mode === MOVEMENT_TYPE.ADJUST
            ? { required: true, hint: t("inventory.movement.reasonHint") }
            : { optional: true })}
        >
          <Textarea
            id="movement-reason"
            data-testid="movement-field-reason"
            rows={2}
            placeholder={
              mode === MOVEMENT_TYPE.ADJUST ? t("inventory.movement.reasonPlaceholder") : ""
            }
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </FormField>
        {!mayRecord(mode, can) && (
          <p
            role="alert"
            data-testid={`${testId}-not-allowed`}
            className="text-label text-danger-600"
          >
            {t("inventory.movement.notAllowed")}
          </p>
        )}
      </div>
    </Modal>
  );
}
