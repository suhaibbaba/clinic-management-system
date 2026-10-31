import {
  LOOKUP_LIST,
  MOVEMENT_TYPE,
  adjustStockSchema,
  consumeStockSchema,
  toThousandths,
  type InventoryItemRow,
} from "@clinic/shared";
import { useEffect, useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  FormField,
  Ltr,
  Modal,
  QuantityInput,
  Select,
  Textarea,
  usePersonName,
  useToast,
} from "@clinic/ui";
import { PatientPicker } from "@web/shared/components/patient-picker";
import { type PatientChoice, type PickedPatient } from "@web/shared/lib/patient-draft";
import { useLookupLabels } from "@web/shared/queries/lookups";
import { useDoctors } from "@web/shared/queries/doctors";
import { useSession } from "@web/shared/providers/session";
import { mayRecord } from "@web/shared/permissions/inventory";
import { useAdjustStock, useConsumeStock } from "@web/modules/inventory/queries";
import { type UsageMovementType } from "@web/modules/inventory/constants";
import { errorToast } from "@web/shared/lib/api-error";
import { REQUIRED, schemaErrors, type FieldErrors } from "@web/shared/lib/form-errors";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";

export interface MovementModalProps {
  readonly "data-testid"?: string | undefined;
  readonly type: UsageMovementType | null;
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
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
  const toast = useToast();
  const { user, can } = useSession();
  const doctorName = usePersonName();
  const doctors = useDoctors({ limit: 100 });
  const ownDoctorId = useMemo(
    () => doctors.data?.items.find((doctor) => doctor.userId === user?.id)?.id ?? "",
    [doctors.data, user?.id],
  );

  const consume = useConsumeStock();
  const adjust = useAdjustStock();

  const [quantity, setQuantity] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [reason, setReason] = useState("");
  const [direction, setDirection] = useState<"add" | "remove">("remove");
  const [linkedPatient, setLinkedPatient] = useState<PatientChoice | null>(null);
  const [doctorId, setDoctorId] = useState("");
  const [pickedId, setPickedId] = useState("");

  const item = fixedItem ?? choices?.find((choice) => choice.id === pickedId);
  const takingOff =
    type === MOVEMENT_TYPE.CONSUME || (type === MOVEMENT_TYPE.ADJUST && direction === "remove");
  const overdrawn =
    takingOff &&
    item !== undefined &&
    quantity.trim() !== "" &&
    toThousandths(quantity.trim()) > toThousandths(item.quantity);

  const belowOne =
    type === MOVEMENT_TYPE.ADJUST &&
    direction === "remove" &&
    quantity.trim() !== "" &&
    toThousandths(quantity.trim()) < 1000;

  const itemId = item?.id ?? "";
  const consumeBody = {
    itemId,
    quantity: quantity.trim(),
    requestId,
    ...(linkedPatient?.kind === "existing" && { patientId: linkedPatient.patient.id }),
    ...(doctorId !== "" && { doctorId }),
    ...(performedProcedureId && { performedProcedureId }),
    ...(reason.trim() !== "" && { reason: reason.trim() }),
  };
  const adjustBody = {
    itemId,
    quantity: `${direction === "remove" ? "-" : ""}${quantity.trim()}`,
    reason: reason.trim(),
    requestId,
  };

  const validate = (): FieldErrors => {
    if (type === null) {
      return {};
    }

    return {
      ...(type === MOVEMENT_TYPE.CONSUME
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
    setPickedId("");
    setRequestId(crypto.randomUUID());
    setReason("");
    setDirection("remove");
    setLinkedPatient(patient ? { kind: "existing", patient } : null);
    setDoctorId(patient?.assignedDoctorId ?? "");
    reset();
  }, [type, fixedItem, patient, reset]);

  useEffect(() => {
    if (type !== null && ownDoctorId !== "") {
      setDoctorId(ownDoctorId);
    }
  }, [type, ownDoctorId]);

  if (type === null || (!fixedItem && !choices)) {
    return null;
  }

  const busy = consume.isPending || adjust.isPending;

  const choosePatient = (choice: PatientChoice | null): void => {
    setLinkedPatient(choice);

    if (ownDoctorId === "" && choice?.kind === "existing" && choice.patient.assignedDoctorId) {
      setDoctorId(choice.patient.assignedDoctorId);
    }
  };

  const submit = async (): Promise<void> => {
    if (!form.check() || !item) {
      return;
    }

    try {
      if (type === MOVEMENT_TYPE.CONSUME) {
        await consume.mutateAsync(consumeBody);
      } else {
        await adjust.mutateAsync(adjustBody);
      }

      toast.success(`inventory.movement.recorded.${type}`);
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
          ? t(`inventory.movement.title.${type}`, { item: item.name })
          : t("inventory.movement.consumeFromVisit")
      }
      description={
        choices
          ? t("inventory.movement.consumeFromVisitDescription")
          : t(`inventory.movement.description.${type}`)
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
            {t(`inventory.movement.submit.${type}`)}
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

        {type === MOVEMENT_TYPE.ADJUST && (
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
        {type === MOVEMENT_TYPE.CONSUME && !performedProcedureId && (
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
                onChange={choosePatient}
              />
            </FormField>
          </div>
        )}
        {type === MOVEMENT_TYPE.CONSUME && !performedProcedureId && (
          <div onBlur={form.leave("doctorId")}>
            <FormField
              error={form.errors["doctorId"]}
              label="inventory.movement.doctor"
              htmlFor="movement-doctor"
              optional
            >
              <Select
                id="movement-doctor"
                data-testid="movement-field-doctor"
                value={doctorId}
                placeholder={t("inventory.movement.selectDoctor")}
                onChange={(event) => setDoctorId(event.target.value)}
                options={(doctors.data?.items ?? [])
                  .filter((doctor) => doctor.user.isActive || doctor.id === doctorId)
                  .map((doctor) => ({ value: doctor.id, label: doctorName(doctor.user.name) }))}
              />
            </FormField>
          </div>
        )}
        {type === MOVEMENT_TYPE.CONSUME && performedProcedureId && (
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
              type === MOVEMENT_TYPE.ADJUST
                ? "inventory.movement.reason"
                : "inventory.movement.note"
            }
            htmlFor="movement-reason"
            {...(type === MOVEMENT_TYPE.ADJUST
              ? { required: true, hint: t("inventory.movement.reasonHint") }
              : { optional: true })}
          >
            <Textarea
              id="movement-reason"
              data-testid="movement-field-reason"
              rows={2}
              placeholder={
                type === MOVEMENT_TYPE.ADJUST ? t("inventory.movement.reasonPlaceholder") : ""
              }
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
        </div>
        {!mayRecord(type, can) && (
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
