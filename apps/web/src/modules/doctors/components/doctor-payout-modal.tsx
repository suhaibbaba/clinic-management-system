import {
  LOOKUP_LIST,
  addMoney,
  createSettlementPayoutSchema,
  type CreateSettlementPayoutInput,
} from "@clinic/shared";
import { useEffect, useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  EmptyState,
  FormField,
  Ltr,
  Modal,
  MoneyInput,
  SegmentedControl,
  Select,
  Switch,
  Textarea,
  useToast,
} from "@clinic/ui";
import { Money } from "@web/shared/components/money";
import { useLookupOptions } from "@web/shared/queries/lookups";
import { useCurrency } from "@web/shared/queries/clinic";
import { useRecordPayout, useSettlement } from "@web/modules/doctors/queries";
import { PAYOUT_MODES, SETTLEMENT_ALL_TIME_FROM } from "@web/modules/doctors/constants";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { errorToast } from "@web/shared/lib/api-error";
import { todayIso } from "@web/shared/lib/dates";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { formatDate } from "@web/shared/lib/format";

type PayoutMode = (typeof PAYOUT_MODES)[number];

export function DoctorPayoutModal({
  open,
  onOpenChange,
  doctorId,
  balance,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly doctorId: string;
  readonly balance: string;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const currency = useCurrency();
  const methods = useLookupOptions(LOOKUP_LIST.PAYMENT_METHOD);
  const record = useRecordPayout(doctorId);
  const owed = useSettlement(doctorId, { from: SETTLEMENT_ALL_TIME_FROM, to: todayIso() }, open);

  const [mode, setMode] = useState<PayoutMode>("treatments");
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");

  const lines = useMemo(
    () => (owed.data?.treatments ?? []).filter((line) => Number(line.outstanding) !== 0),
    [owed.data],
  );
  const chosen = lines.filter((line) => !skipped.has(line.id));
  const total = chosen.reduce((sum, line) => addMoney(sum, line.outstanding), "0.00");

  const body: CreateSettlementPayoutInput = {
    method,
    note: note.trim() === "" ? null : note,
    ...(mode === "treatments"
      ? { treatmentIds: chosen.map((line) => line.id) }
      : { treatmentIds: [], amount }),
  };
  const form = useFormErrors(schemaErrors(createSettlementPayoutSchema, body));
  const { reset } = form;
  const payable = mode === "advance" || Number(total) > 0;

  useEffect(() => {
    if (open) {
      setMode("treatments");
      setSkipped(new Set());
      setAmount("");
      setMethod("cash");
      setNote("");
      reset();
    }
  }, [open, reset]);

  const toggle = (id: string, on: boolean): void =>
    setSkipped((current) => {
      const next = new Set(current);

      if (on) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });

  const submit = async (): Promise<void> => {
    if (!form.check() || !payable) {
      return;
    }

    try {
      await record.mutateAsync(body);
      toast.success("doctors.settlement.payoutRecorded");
      onOpenChange(false);
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <Modal
      data-testid="doctor-payout-modal"
      open={open}
      onOpenChange={onOpenChange}
      title="doctors.settlement.recordPayout"
      footer={
        <>
          <Button
            variant="secondary"
            data-testid="doctor-payout-cancel"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            isLoading={record.isPending}
            aria-disabled={!form.isValid || !payable || record.isPending || undefined}
            data-testid="doctor-payout-save"
            onClick={() => void submit()}
          >
            {mode === "treatments"
              ? t("doctors.settlement.payAmount", { count: chosen.length })
              : t("common.save")}
          </Button>
        </>
      }
    >
      <div ref={form.formRef} className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between rounded-panel bg-inset px-3 py-2">
          <span className="text-label text-ink-muted">{t("doctors.settlement.balance")}</span>
          <Money amount={balance} currency={currency} className="font-medium" />
        </div>

        <SegmentedControl
          data-testid="doctor-payout-mode"
          label={t("doctors.settlement.payoutKind")}
          value={mode}
          onChange={(next) => setMode(next)}
          options={PAYOUT_MODES.map((value) => ({
            value,
            label: t(`doctors.settlement.payoutModes.${value}`),
          }))}
        />

        {mode === "treatments" ? (
          <div className="flex flex-col gap-2">
            {lines.length === 0 && !owed.isPending ? (
              <EmptyState
                icon="stethoscope"
                data-testid="doctor-payout-nothing"
                title="doctors.settlement.nothingOwed"
              />
            ) : (
              <ul
                data-testid="doctor-payout-lines"
                className="flex max-h-80 flex-col gap-1 overflow-y-auto"
              >
                {lines.map((line) => (
                  <li
                    key={line.id}
                    data-testid={`doctor-payout-line-${line.id}`}
                    className="flex items-center gap-3 rounded-panel bg-inset px-3 py-1.5"
                  >
                    <Switch
                      checked={!skipped.has(line.id)}
                      onCheckedChange={(on) => toggle(line.id, on)}
                      label={`${line.patientName} · ${line.procedureName}`}
                      hideLabel
                    />
                    <span className="flex min-w-0 flex-1 flex-col text-meta">
                      <span className="truncate text-ink">
                        {line.patientName}
                        {line.fileNumber && (
                          <>
                            {" · "}
                            <Ltr>#{line.fileNumber}</Ltr>
                          </>
                        )}
                      </span>
                      <span className="truncate text-ink-muted">
                        {line.procedureName} · {formatDate(line.performedAt)}
                        {line.status === "adjusted" &&
                          ` · ${t("doctors.settlement.statuses.adjusted")}`}
                      </span>
                    </span>
                    <Money amount={line.outstanding} currency={currency} />
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-baseline justify-between px-3">
              <span className="text-label text-ink-muted">
                {t("doctors.settlement.payoutTotal")}
              </span>
              <Money
                data-testid="doctor-payout-total"
                amount={total}
                currency={currency}
                className="font-semibold"
              />
            </div>
          </div>
        ) : (
          <div onBlur={form.leave("amount")}>
            <FormField
              label="doctors.settlement.amount"
              htmlFor="doctor-payout-amount"
              hint="doctors.settlement.advanceHint"
              error={form.errors["amount"] ?? form.errors["treatmentIds"]}
              required
            >
              <MoneyInput
                id="doctor-payout-amount"
                data-testid="doctor-payout-field-amount"
                currency={currency}
                placeholder="0"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </FormField>
          </div>
        )}

        <FormField label="labs.payment.method" htmlFor="doctor-payout-method">
          <Select
            id="doctor-payout-method"
            data-testid="doctor-payout-field-method"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            options={methods}
          />
        </FormField>

        <FormField label="labs.payment.note" htmlFor="doctor-payout-note" optional>
          <Textarea
            id="doctor-payout-note"
            data-testid="doctor-payout-field-note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </FormField>
      </div>
    </Modal>
  );
}
