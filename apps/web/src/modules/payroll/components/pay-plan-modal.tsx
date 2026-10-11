import {
  PAY_PLAN_KINDS,
  payPlanInputSchema,
  type PayPlanKind,
  type PayrollLine,
} from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, FormField, Modal, Select, useToast } from "@clinic/ui";
import { usePlanHistory, useSetPlan } from "@web/modules/payroll/queries";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { errorToast } from "@web/shared/lib/api-error";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { formatMonth } from "@web/shared/lib/format";
import { monthsFrom } from "@web/shared/lib/months";

export function PayPlanModal({
  line,
  month,
  onClose,
}: {
  readonly line: PayrollLine | null;
  readonly month: string;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const save = useSetPlan();
  const history = usePlanHistory(line?.userId ?? null);

  const [kind, setKind] = useState<PayPlanKind>("salary");
  const [effectiveMonth, setEffectiveMonth] = useState(month);

  const body = { kind, effectiveMonth };
  const form = useFormErrors(schemaErrors(payPlanInputSchema, body));
  const { reset } = form;
  const kinds = line?.doctorId ? PAY_PLAN_KINDS : (["salary"] as const);

  useEffect(() => {
    if (line) {
      setKind(line.plan);
      setEffectiveMonth(month);
      reset();
    }
  }, [line, month, reset]);

  const submit = async (): Promise<void> => {
    if (!line || !form.check()) {
      return;
    }

    try {
      await save.mutateAsync({ userId: line.userId, body });
      toast.success("payroll.plan.saved");
      onClose();
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <Modal
      data-testid="payroll-plan-modal"
      open={line !== null}
      onOpenChange={(open) => !open && onClose()}
      title="payroll.plan.title"
      description={line?.doctorId ? "payroll.plan.about" : "payroll.plan.notDoctor"}
      footer={
        <>
          <Button variant="secondary" data-testid="payroll-plan-cancel" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            isLoading={save.isPending}
            aria-disabled={!form.isValid || save.isPending || undefined}
            data-testid="payroll-plan-save"
            onClick={() => void submit()}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div ref={form.formRef} className="flex flex-col gap-4">
        <FormField label="payroll.plan.kind" htmlFor="payroll-plan-kind">
          <Select
            id="payroll-plan-kind"
            data-testid="payroll-plan-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as PayPlanKind)}
            options={kinds.map((value) => ({ value, label: t(`payroll.plan.kinds.${value}`) }))}
          />
        </FormField>

        <FormField label="payroll.effectiveFrom" htmlFor="payroll-plan-month">
          <Select
            id="payroll-plan-month"
            data-testid="payroll-plan-month"
            value={effectiveMonth}
            onChange={(event) => setEffectiveMonth(event.target.value)}
            options={monthsFrom(month, 7).map((value) => ({ value, label: formatMonth(value) }))}
          />
        </FormField>

        {(history.data ?? []).length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-label font-medium text-ink">{t("payroll.plan.history")}</p>
            <ul className="flex flex-col gap-1">
              {history.data?.map((plan) => (
                <li
                  key={plan.id}
                  className="flex items-center justify-between rounded-panel bg-inset px-3 py-1.5 text-meta"
                >
                  <span>{formatMonth(plan.effectiveMonth)}</span>
                  <span>{t(`payroll.plan.kinds.${plan.kind}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
