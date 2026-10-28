import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, FormField, Icon, Modal, Textarea, useToast } from "@clinic/ui";
import { errorToast } from "@web/shared/lib/api-error";
import { useVoidInvoice } from "@web/modules/inventory/queries";

export function VoidInvoiceModal({
  invoiceId,
  onClose,
}: {
  readonly invoiceId: string | null;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const reverse = useVoidInvoice();
  const [reason, setReason] = useState("");
  const tooShort = reason.trim().length < 3;

  const close = (): void => {
    setReason("");
    onClose();
  };

  const submit = async (): Promise<void> => {
    if (!invoiceId || tooShort) {
      return;
    }

    try {
      await reverse.mutateAsync({ id: invoiceId, reason: reason.trim() });
      toast.success("inventory.suppliers.invoice.voided");
      close();
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <Modal
      data-testid="supplier-invoice-void-modal"
      open={invoiceId !== null}
      onOpenChange={(open) => !open && close()}
      title="inventory.suppliers.invoice.voidTitle"
      description={t("inventory.suppliers.invoice.voidDescription")}
      footer={
        <>
          <Button variant="secondary" data-testid="supplier-invoice-void-cancel" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            icon={<Icon name="reset" />}
            data-testid="supplier-invoice-void-confirm"
            isLoading={reverse.isPending}
            aria-disabled={tooShort || reverse.isPending || undefined}
            onClick={() => void submit()}
          >
            {t("inventory.suppliers.invoice.void")}
          </Button>
        </>
      }
    >
      <FormField
        label="inventory.suppliers.invoice.voidReason"
        htmlFor="supplier-invoice-void-reason"
        required
      >
        <Textarea
          id="supplier-invoice-void-reason"
          data-testid="supplier-invoice-void-reason"
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </FormField>
    </Modal>
  );
}
