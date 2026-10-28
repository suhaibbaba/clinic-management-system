import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, FormField, Modal, Textarea, useToast } from "@clinic/ui";
import { errorToast } from "@web/shared/lib/api-error";
import { useCancelRequest } from "@web/modules/inventory/queries";

export function CancelRequestModal({
  requestId,
  onClose,
}: {
  readonly requestId: string | null;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const cancel = useCancelRequest();
  const [reason, setReason] = useState("");
  const ready = reason.trim().length >= 3 && !cancel.isPending;

  const close = (): void => {
    setReason("");
    onClose();
  };

  const submit = async (): Promise<void> => {
    if (!requestId || !ready) {
      return;
    }

    try {
      await cancel.mutateAsync({ id: requestId, reason: reason.trim() });
      toast.success("inventory.requests.cancelled");
      close();
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <Modal
      data-testid="cancel-request-modal"
      open={requestId !== null}
      onOpenChange={(next) => !next && close()}
      title="inventory.requests.cancelTitle"
      description={t("inventory.requests.cancelDescription")}
      footer={
        <>
          <Button variant="secondary" data-testid="cancel-request-back" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            data-testid="cancel-request-confirm"
            isLoading={cancel.isPending}
            aria-disabled={!ready || undefined}
            onClick={() => void submit()}
          >
            {t("inventory.requests.cancel")}
          </Button>
        </>
      }
    >
      <FormField label="inventory.requests.cancelReason" htmlFor="cancel-request-reason" required>
        <Textarea
          id="cancel-request-reason"
          data-testid="cancel-request-reason"
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </FormField>
    </Modal>
  );
}
