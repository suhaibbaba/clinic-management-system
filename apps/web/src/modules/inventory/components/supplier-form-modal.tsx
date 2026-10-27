import { createSupplierSchema, toMinorUnits, type SupplierSummary } from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  FormField,
  Input,
  Modal,
  MoneyInput,
  PhoneInput,
  Switch,
  Textarea,
  useToast,
} from "@clinic/ui";
import { useCreateSupplier, useUpdateSupplier } from "@web/modules/inventory/queries";
import { errorToast } from "@web/shared/lib/api-error";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { capitalizeWords } from "@web/modules/inventory/lib/capitalize-words";
import { useCurrency } from "@web/shared/queries/clinic";

export function SupplierFormModal({
  open,
  onOpenChange,
  supplier,
  "data-testid": testId = "supplier-form-modal",
}: {
  readonly "data-testid"?: string | undefined;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly supplier?: SupplierSummary | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const currency = useCurrency();

  const create = useCreateSupplier();
  const update = useUpdateSupplier();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [openingBalance, setOpeningBalance] = useState("");

  const body = {
    name: name.trim(),
    phone: phone.trim() === "" ? null : phone.trim(),
    contactPerson: contactPerson.trim() === "" ? null : contactPerson.trim(),
    notes: notes.trim() === "" ? null : notes.trim(),
    isActive,
    openingBalance: openingBalance.trim() === "" ? "0" : openingBalance.trim(),
  };

  const form = useFormErrors(schemaErrors(createSupplierSchema, body));
  const { reset } = form;
  const isPending = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) {
      return;
    }

    setName(supplier?.name ?? "");
    setPhone(supplier?.phone ?? "");
    setContactPerson(supplier?.contactPerson ?? "");
    setNotes(supplier?.notes ?? "");
    setIsActive(supplier?.isActive ?? true);
    setOpeningBalance(
      supplier && toMinorUnits(supplier.openingBalance) !== 0
        ? (supplier.openingBalance.split(".")[0] ?? "")
        : "",
    );
    reset();
  }, [open, supplier, reset]);

  const submit = async (): Promise<void> => {
    if (!form.check()) {
      return;
    }

    try {
      if (supplier) {
        await update.mutateAsync({ id: supplier.id, body });
      } else {
        await create.mutateAsync(body);
      }

      toast.success(supplier ? "inventory.suppliers.updated" : "inventory.suppliers.created");
      onOpenChange(false);
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <Modal
      data-testid={testId}
      open={open}
      onOpenChange={onOpenChange}
      title={t(supplier ? "inventory.suppliers.editTitle" : "inventory.suppliers.newTitle")}
      footer={
        <>
          <Button
            variant="secondary"
            data-testid={`${testId}-cancel`}
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            data-testid={`${testId}-save`}
            aria-disabled={!form.isValid || isPending || undefined}
            isLoading={isPending}
            onClick={() => void submit()}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div ref={form.formRef} data-testid={`${testId}-form`} className="flex flex-col gap-4">
        <div onBlur={form.leave("name")}>
          <FormField
            error={form.errors["name"]}
            label="inventory.suppliers.name"
            htmlFor="supplier-name"
            required
          >
            <Input
              id="supplier-name"
              data-testid="supplier-field-name"
              autoCapitalize="words"
              value={name}
              onChange={(event) => setName(capitalizeWords(event.target.value))}
            />
          </FormField>
        </div>

        <div onBlur={form.leave("phone")}>
          <FormField
            error={form.errors["phone"]}
            label="inventory.suppliers.phone"
            htmlFor="supplier-phone"
            optional
          >
            <PhoneInput
              id="supplier-phone"
              data-testid="supplier-field-phone"
              value={phone}
              onChange={(next) => setPhone(next ?? "")}
            />
          </FormField>
        </div>

        <div onBlur={form.leave("contactPerson")}>
          <FormField
            error={form.errors["contactPerson"]}
            label="inventory.suppliers.contact"
            htmlFor="supplier-contact"
            optional
          >
            <Input
              id="supplier-contact"
              data-testid="supplier-field-contact"
              autoCapitalize="words"
              value={contactPerson}
              onChange={(event) => setContactPerson(capitalizeWords(event.target.value))}
            />
          </FormField>
        </div>

        <div onBlur={form.leave("notes")}>
          <FormField
            error={form.errors["notes"]}
            label="inventory.notes"
            htmlFor="supplier-notes"
            optional
          >
            <Textarea
              id="supplier-notes"
              data-testid="supplier-field-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </FormField>
        </div>

        <div onBlur={form.leave("openingBalance")}>
          <FormField
            error={form.errors["openingBalance"]}
            label="inventory.suppliers.openingBalance"
            hint="inventory.suppliers.openingBalanceHint"
            htmlFor="supplier-opening-balance"
            optional
          >
            <MoneyInput
              id="supplier-opening-balance"
              data-testid="supplier-field-opening-balance"
              currency={currency}
              placeholder="0"
              value={openingBalance}
              onChange={(event) => setOpeningBalance(event.target.value)}
            />
          </FormField>
        </div>

        <Switch
          checked={isActive}
          onCheckedChange={setIsActive}
          label={t("inventory.suppliers.active")}
        />
      </div>
    </Modal>
  );
}
