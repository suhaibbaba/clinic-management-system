import {
  DEFAULT_TIME_ZONE,
  PURCHASE_DOCUMENT_STATUS,
  SUPPLIER_DOCUMENT_KIND,
  localDate,
} from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  FormField,
  Input,
  Modal,
  MoneyInput,
  Select,
  Textarea,
  useToast,
} from "@clinic/ui";
import { errorToast } from "@web/shared/lib/api-error";
import { useCurrency } from "@web/shared/queries/clinic";
import { useCreditNote, useSupplierInvoices } from "@web/modules/inventory/queries";

export function CreditNoteModal({
  supplierId,
  open,
  onClose,
}: {
  readonly supplierId: string;
  readonly open: boolean;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const currency = useCurrency();
  const invoices = useSupplierInvoices(open ? supplierId : "");
  const credit = useCreditNote();
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [supplierRef, setSupplierRef] = useState("");
  const [note, setNote] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const ready = Number(amount || "0") > 0 && !credit.isPending;

  const close = (): void => {
    setInvoiceId("");
    setAmount("");
    setSupplierRef("");
    setNote("");
    setRequestId(crypto.randomUUID());
    onClose();
  };

  const submit = async (): Promise<void> => {
    if (!ready) {
      return;
    }

    try {
      await credit.mutateAsync({
        supplierId,
        date: localDate(new Date(), DEFAULT_TIME_ZONE),
        amount: amount.trim(),
        requestId,
        ...(invoiceId !== "" && { invoiceId }),
        ...(supplierRef.trim() !== "" && { supplierRef: supplierRef.trim() }),
        ...(note.trim() !== "" && { note: note.trim() }),
      });
      toast.success("inventory.creditNote.done");
      close();
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <Modal
      data-testid="credit-note-modal"
      open={open}
      onOpenChange={(next) => !next && close()}
      title="inventory.creditNote.title"
      description={t("inventory.creditNote.description")}
      footer={
        <>
          <Button variant="secondary" data-testid="credit-note-cancel" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button
            data-testid="credit-note-confirm"
            isLoading={credit.isPending}
            aria-disabled={!ready || undefined}
            onClick={() => void submit()}
          >
            {t("inventory.creditNote.confirm")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormField label="inventory.creditNote.invoice" htmlFor="credit-note-invoice" optional>
            <Select
              id="credit-note-invoice"
              data-testid="credit-note-invoice"
              value={invoiceId}
              placeholder={t("inventory.creditNote.anyInvoice")}
              onChange={(event) => setInvoiceId(event.target.value)}
              options={(invoices.data ?? [])
                .filter(
                  (invoice) =>
                    invoice.kind !== SUPPLIER_DOCUMENT_KIND.CREDIT_NOTE &&
                    invoice.status === PURCHASE_DOCUMENT_STATUS.POSTED,
                )
                .map((invoice) => ({
                  value: invoice.id,
                  label: invoice.supplierRef
                    ? `${invoice.number} · ${invoice.supplierRef}`
                    : invoice.number,
                }))}
            />
          </FormField>
        </div>
        <FormField label="inventory.creditNote.amount" htmlFor="credit-note-amount" required>
          <MoneyInput
            cents
            id="credit-note-amount"
            data-testid="credit-note-amount"
            currency={currency}
            placeholder="0"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </FormField>
        <FormField label="inventory.purchase.supplierRef" htmlFor="credit-note-ref" optional>
          <Input
            id="credit-note-ref"
            data-testid="credit-note-ref"
            dir="ltr"
            value={supplierRef}
            onChange={(event) => setSupplierRef(event.target.value)}
          />
        </FormField>
      </div>
      <FormField label="inventory.notes" htmlFor="credit-note-note" optional>
        <Textarea
          id="credit-note-note"
          data-testid="credit-note-note"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </FormField>
    </Modal>
  );
}
