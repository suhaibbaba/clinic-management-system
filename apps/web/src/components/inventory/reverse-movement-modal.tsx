import type { StockMovementRow } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, Icon, Modal, Textarea, useToast } from "@clinic/ui";
import { errorMessageKey } from "@web/lib/api-error";
import { useReverseMovement } from "@web/queries/inventory";

export function ReverseMovementModal({
  movement,
  onClose,
}: {
  readonly movement: StockMovementRow | null;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const reverse = useReverseMovement();
  const [reason, setReason] = useState("");

  const close = (): void => {
    setReason("");
    onClose();
  };

  const submit = async (): Promise<void> => {
    if (!movement) {
      return;
    }

    try {
      await reverse.mutateAsync({ id: movement.id, reason: reason.trim() });
      toast.success("inventory.movement.reversed");
      close();
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <Modal
      data-testid="movement-reverse-modal"
      open={movement !== null}
      onOpenChange={(open) => !open && close()}
      title="inventory.history.reverseTitle"
      description={t("inventory.history.reverseDescription")}
      footer={
        <>
          <Button variant="secondary" data-testid="movement-reverse-cancel" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            icon={<Icon name="reset" />}
            data-testid="movement-reverse-confirm"
            isLoading={reverse.isPending}
            disabled={reason.trim().length < 3}
            onClick={() => void submit()}
          >
            {t("inventory.history.reverse")}
          </Button>
        </>
      }
    >
      <label htmlFor="reverse-reason" className="mb-1.5 block text-label font-medium text-ink">
        {t("inventory.movement.reason")}
      </label>
      <Textarea
        id="reverse-reason"
        data-testid="movement-reverse-reason"
        rows={3}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
    </Modal>
  );
}
