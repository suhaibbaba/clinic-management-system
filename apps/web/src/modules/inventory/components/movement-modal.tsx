import {
  LOOKUP_LIST,
  MOVEMENT_TYPE,
  adjustStockSchema,
  consumeStockSchema,
  purchaseStockSchema,
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
import { PatientPicker } from "@web/shared/components/patient-picker";
import { type PatientChoice, type PickedPatient } from "@web/shared/lib/patient-draft";
import { useLookupLabels } from "@web/shared/queries/lookups";
import { useSession } from "@web/shared/providers/session";
import { canPurchaseStock, mayRecord } from "@web/shared/permissions/inventory";
import {
  useAdjustStock,
  useConsumeStock,
  usePurchaseStock,
  useSuppliers,
} from "@web/modules/inventory/queries";
import { errorToast } from "@web/shared/lib/api-error";
import { REQUIRED, schemaErrors, type FieldErrors } from "@web/shared/lib/form-errors";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { useCurrency } from "@web/shared/queries/clinic";

export interface MovementModalProps {
  readonly "data-testid"?: string | undefined;
  readonly type: MovementType | null;
  readonly item: InventoryItemRow | undefined;
  readonly choices?: readonly InventoryItemRow[] | undefined;
  readonly onClose: () => void;
  readonly patient?: PickedPatient | undefined;
  readonly performedProcedureId?: string | undefined;
}

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
  const [restocking, setRestocking] = useState(false);

  const item = fixedItem ?? choices?.find((choice) => choice.id === pickedId);
  const mode = restocking ? MOVEMENT_TYPE.PURCHASE : type;
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

  const itemId = item?.id ?? "";
  const purchaseBody = {
    itemId,
    quantity: quantity.trim(),
    ...(unitPrice.trim() !== "" && { unitPrice: unitPrice.trim() }),
    ...(supplierId !== "" && { supplierId }),
    ...(batchNo.trim() !== "" && { batchNo: batchNo.trim() }),
    ...(expiryDate !== "" && { expiryDate }),
  };
  const consumeBody = {
    itemId,
    quantity: quantity.trim(),
    ...(linkedPatient?.kind === "existing" && { patientId: linkedPatient.patient.id }),
    ...(performedProcedureId && { performedProcedureId }),
    ...(batchNo.trim() !== "" && { batchNo: batchNo.trim() }),
    ...(reason.trim() !== "" && { reason: reason.trim() }),
  };
  const adjustBody = {
    itemId,
    quantity: `${direction === "remove" ? "-" : ""}${quantity.trim()}`,
    reason: reason.trim(),
    ...(batchNo.trim() !== "" && { batchNo: batchNo.trim() }),
  };

  const validate = (): FieldErrors => {
    if (mode === null) {
      return {};
    }

    return {
      ...(mode === MOVEMENT_TYPE.PURCHASE
        ? schemaErrors(purchaseStockSchema, purchaseBody)
        : mode === MOVEMENT_TYPE.CONSUME
          ? schemaErrors(consumeStockSchema, consumeBody)
          : schemaErrors(adjustStockSchema, adjustBody)),
      ...(quantity.trim() === "" && { quantity: REQUIRED }),
      ...(overdrawn && { quantity: { type: "too_big" } }),
      ...(belowOne && { quantity: { type: "too_small" } }),
    };
  };

  const form = useFormErrors(validate());
  const { reset } = form;

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
    reset();
  }, [type, fixedItem, patient, reset]);

  if (type === null || (!fixedItem && !choices)) {
    return null;
  }

  const busy = purchase.isPending || consume.isPending || adjust.isPending;

  const submit = async (): Promise<void> => {
    if (!form.check() || !item) {
      return;
    }

    try {
      if (mode === MOVEMENT_TYPE.PURCHASE) {
        await purchase.mutateAsync(purchaseBody);
      } else if (mode === MOVEMENT_TYPE.CONSUME) {
        await consume.mutateAsync(consumeBody);
      } else {
        await adjust.mutateAsync(adjustBody);
      }

      toast.success(`inventory.movement.recorded.${mode}`);

      if (restocking) {
        setRestocking(false);
        setQuantity("");
        setUnitPrice("");
        setBatchNo("");
        setExpiryDate("");
        reset();
        return;
      }

      onClose();
    } catch (error) {
      toast.error(...errorToast(error));
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
            aria-disabled={!form.isValid || busy || undefined}
            isLoading={busy}
            onClick={() => void submit()}
          >
            {t(`inventory.movement.submit.${mode}`)}
          </Button>
        </>
      }
    >
      <div ref={form.formRef} data-testid={`${testId}-form`} className="flex flex-col gap-4">
        {choices && (
          <div onBlur={form.leave("itemId")}>
            <FormField
              error={form.errors["itemId"]}
              label="inventory.movement.item"
              htmlFor="movement-item"
              required
            >
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
          </div>
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
        <div onBlur={form.leave("quantity")}>
          <FormField
            label="inventory.movement.quantity"
            htmlFor="movement-quantity"
            {...(item && { hint: unitLabel(item.unit) })}
            error={
              overdrawn
                ? { type: "too_big" }
                : belowOne
                  ? { type: "too_small" }
                  : form.errors["quantity"]
            }
            {...(overdrawn && { errorKey: "inventory.movement.overStock" })}
            {...(belowOne && { errorKey: "inventory.movement.atLeastOne" })}
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
        </div>
        {mode === MOVEMENT_TYPE.PURCHASE && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div onBlur={form.leave("unitPrice")}>
                <FormField
                  error={form.errors["unitPrice"]}
                  label="inventory.movement.unitPrice"
                  htmlFor="movement-price"
                  optional
                >
                  <MoneyInput
                    id="movement-price"
                    data-testid="movement-field-price"
                    currency={currency}
                    placeholder="0"
                    value={unitPrice}
                    onChange={(event) => setUnitPrice(event.target.value)}
                  />
                </FormField>
              </div>
              <div onBlur={form.leave("supplierId")}>
                <FormField
                  error={form.errors["supplierId"]}
                  label="inventory.movement.supplier"
                  htmlFor="movement-supplier"
                  optional
                >
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
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div onBlur={form.leave("batchNo")}>
                <FormField
                  error={form.errors["batchNo"]}
                  label="inventory.movement.batchNo"
                  htmlFor="movement-batch"
                  optional
                >
                  <Input
                    id="movement-batch"
                    data-testid="movement-field-batch"
                    dir="ltr"
                    placeholder="LX-2451"
                    value={batchNo}
                    onChange={(event) => setBatchNo(event.target.value)}
                  />
                </FormField>
              </div>
              <div onBlur={form.leave("expiryDate")}>
                <FormField
                  error={form.errors["expiryDate"]}
                  label="inventory.movement.expiry"
                  htmlFor="movement-expiry"
                  optional
                >
                  <DatePicker
                    id="movement-expiry"
                    data-testid="movement-field-expiry"
                    label={t("inventory.movement.expiry")}
                    value={expiryDate}
                    onChange={setExpiryDate}
                  />
                </FormField>
              </div>
            </div>
          </>
        )}
        {mode === MOVEMENT_TYPE.CONSUME && !performedProcedureId && (
          <div onBlur={form.leave("patientId")}>
            <FormField
              error={form.errors["patientId"]}
              label="inventory.movement.patient"
              htmlFor="movement-patient"
              optional
            >
              <PatientPicker
                id="movement-patient"
                allowNew={false}
                value={linkedPatient}
                onChange={setLinkedPatient}
              />
            </FormField>
          </div>
        )}
        {mode === MOVEMENT_TYPE.CONSUME && performedProcedureId && (
          <p
            data-testid={`${testId}-linked-procedure`}
            className="rounded-panel bg-inset px-3 py-2 text-label text-ink-muted"
          >
            {t("inventory.movement.linkedToProcedure")}
          </p>
        )}
        <div onBlur={form.leave("reason")}>
          <FormField
            error={form.errors["reason"]}
            label={
              mode === MOVEMENT_TYPE.ADJUST
                ? "inventory.movement.reason"
                : "inventory.movement.note"
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
        </div>
        {!mayRecord(mode ?? type, can) && (
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
