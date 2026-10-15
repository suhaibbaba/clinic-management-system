import { LOOKUP_LIST, createExpenseSchema } from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  DatePicker,
  FormField,
  Modal,
  MoneyInput,
  Select,
  Textarea,
  useToast,
} from "@clinic/ui";
import { useCreateExpense } from "@web/modules/expenses/queries";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { errorToast } from "@web/shared/lib/api-error";
import { todayIso } from "@web/shared/lib/dates";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { useCurrency } from "@web/shared/queries/clinic";
import { useLookupOptions } from "@web/shared/queries/lookups";

export function ExpenseModal({
  open,
  onOpenChange,
  defaultDay,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly defaultDay: string;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const currency = useCurrency();
  const categories = useLookupOptions(LOOKUP_LIST.EXPENSE_CATEGORY);
  const methods = useLookupOptions(LOOKUP_LIST.PAYMENT_METHOD);
  const create = useCreateExpense();
  const today = todayIso();

  const [spentOn, setSpentOn] = useState(defaultDay);
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");

  const body = {
    spentOn,
    category,
    amount,
    method,
    note: note.trim() === "" ? null : note.trim(),
  };
  const form = useFormErrors(schemaErrors(createExpenseSchema, body));
  const { reset } = form;

  useEffect(() => {
    if (open) {
      setSpentOn(defaultDay);
      setCategory("");
      setAmount("");
      setMethod("cash");
      setNote("");
      reset();
    }
  }, [open, defaultDay, reset]);

  const submit = async (): Promise<void> => {
    if (!form.check()) {
      return;
    }

    try {
      await create.mutateAsync(body);
      toast.success("expenses.saved");
      onOpenChange(false);
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <Modal
      data-testid="expense-modal"
      open={open}
      onOpenChange={onOpenChange}
      title="expenses.add"
      footer={
        <>
          <Button
            variant="secondary"
            data-testid="expense-cancel"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            isLoading={create.isPending}
            aria-disabled={!form.isValid || create.isPending || undefined}
            data-testid="expense-save"
            onClick={() => void submit()}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div ref={form.formRef} className="flex flex-col gap-4">
        <div onBlur={form.leave("spentOn")}>
          <FormField
            label="expenses.date"
            htmlFor="expense-date"
            error={form.errors["spentOn"]}
            required
          >
            <DatePicker
              id="expense-date"
              data-testid="expense-field-date"
              label={t("expenses.date")}
              value={spentOn}
              max={today}
              hasError={form.errors["spentOn"] !== undefined}
              onChange={setSpentOn}
            />
          </FormField>
        </div>

        <div onBlur={form.leave("category")}>
          <FormField
            label="expenses.category"
            htmlFor="expense-category"
            error={form.errors["category"]}
            required
          >
            <Select
              id="expense-category"
              data-testid="expense-field-category"
              value={category}
              placeholder={t("expenses.chooseCategory")}
              onChange={(event) => setCategory(event.target.value)}
              options={categories}
            />
          </FormField>
        </div>

        <div onBlur={form.leave("amount")}>
          <FormField
            label="expenses.amount"
            htmlFor="expense-amount"
            error={form.errors["amount"]}
            required
          >
            <MoneyInput
              id="expense-amount"
              data-testid="expense-field-amount"
              currency={currency}
              placeholder="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </FormField>
        </div>

        <FormField label="labs.payment.method" htmlFor="expense-method">
          <Select
            id="expense-method"
            data-testid="expense-field-method"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            options={methods}
          />
        </FormField>

        <FormField label="labs.payment.note" htmlFor="expense-note" optional>
          <Textarea
            id="expense-note"
            data-testid="expense-field-note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </FormField>
      </div>
    </Modal>
  );
}
