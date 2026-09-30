import {
  createPayrollAdjustmentSchema,
  type PayrollAdjustmentKind,
  type PayrollLine,
} from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, FormField, Input, Modal, MoneyInput, useToast } from "@clinic/ui";
import { useAdjustPay } from "@web/modules/payroll/queries";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { errorToast } from "@web/shared/lib/api-error";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { useCurrency } from "@web/shared/queries/clinic";

export interface AdjustmentTarget {
  readonly line: PayrollLine;
  readonly kind: PayrollAdjustmentKind;
}

export function AdjustmentModal({
  target,
  month,
  onClose,
}: {
  readonly target: AdjustmentTarget | null;
  readonly month: string;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const currency = useCurrency();
  const save = useAdjustPay(month);

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const body = {
    userId: target?.line.userId ?? "",
    kind: target?.kind ?? "extra",
    amount,
    reason,
  };
  const form = useFormErrors(schemaErrors(createPayrollAdjustmentSchema, body));
  const { reset } = form;

  useEffect(() => {
    if (target) {
      setAmount("");
      setReason("");
      reset();
    }
  }, [target, reset]);

  const submit = async (): Promise<void> => {
    if (!target || !form.check()) {
      return;
    }

    try {
      await save.mutateAsync(body);
      toast.success(target.kind === "cut" ? "payroll.cutSaved" : "payroll.extraSaved");
      onClose();
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <Modal
      data-testid="payroll-adjustment-modal"
      open={target !== null}
      onOpenChange={(open) => !open && onClose()}
      title={target?.kind === "cut" ? "payroll.addCut" : "payroll.addExtra"}
      footer={
        <>
          <Button variant="secondary" data-testid="payroll-adjustment-cancel" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            isLoading={save.isPending}
            aria-disabled={!form.isValid || save.isPending || undefined}
            data-testid="payroll-adjustment-save"
            onClick={() => void submit()}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div ref={form.formRef} className="flex flex-col gap-4">
        <div onBlur={form.leave("amount")}>
          <FormField
            label="payroll.amount"
            htmlFor="payroll-adjustment-amount"
            error={form.errors["amount"]}
            required
          >
            <MoneyInput
              id="payroll-adjustment-amount"
              data-testid="payroll-field-adjustment-amount"
              currency={currency}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </FormField>
        </div>

        <div onBlur={form.leave("reason")}>
          <FormField
            label="payroll.reason"
            htmlFor="payroll-adjustment-reason"
            error={form.errors["reason"]}
            required
          >
            <Input
              id="payroll-adjustment-reason"
              data-testid="payroll-field-adjustment-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}
