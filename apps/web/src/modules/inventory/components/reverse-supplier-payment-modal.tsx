import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, FormField, Icon, Modal, Textarea, useToast } from "@clinic/ui";
import { errorToast } from "@web/shared/lib/api-error";
import { useReverseSupplierPayment } from "@web/modules/inventory/queries";

export function ReverseSupplierPaymentModal({
  paymentId,
  onClose,
}: {
  readonly paymentId: string | null;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const reverse = useReverseSupplierPayment();
  const [reason, setReason] = useState("");
  const tooShort = reason.trim().length < 3;

  const close = (): void => {
    setReason("");
    onClose();
  };

  const submit = async (): Promise<void> => {
    if (!paymentId || tooShort) {
      return;
    }

    try {
      await reverse.mutateAsync({ id: paymentId, reason: reason.trim() });
      toast.success("inventory.suppliers.payment.reversed");
      close();
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <Modal
      data-testid="supplier-payment-reverse-modal"
      open={paymentId !== null}
      onOpenChange={(open) => !open && close()}
      title="inventory.suppliers.payment.reverseTitle"
      description={t("inventory.suppliers.payment.reverseDescription")}
      footer={
        <>
          <Button variant="secondary" data-testid="supplier-payment-reverse-cancel" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            icon={<Icon name="reset" />}
            data-testid="supplier-payment-reverse-confirm"
            isLoading={reverse.isPending}
            aria-disabled={tooShort || reverse.isPending || undefined}
            onClick={() => void submit()}
          >
            {t("inventory.suppliers.payment.reverse")}
          </Button>
        </>
      }
    >
      <FormField
        label="inventory.suppliers.payment.reverseReason"
        htmlFor="supplier-payment-reverse-reason"
        required
      >
        <Textarea
          id="supplier-payment-reverse-reason"
          data-testid="supplier-payment-reverse-reason"
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </FormField>
    </Modal>
  );
}
