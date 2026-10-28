import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, FormField, Icon, Modal, Textarea, useToast } from "@clinic/ui";
import { errorToast } from "@web/shared/lib/api-error";
import { useBlockLot, useLiftLotBlock } from "@web/modules/inventory/queries";

export interface LotBlockTarget {
  readonly itemId: string;
  readonly batchNo: string;
  readonly blockId: string | null;
}

export function LotBlockModal({
  target,
  onClose,
}: {
  readonly target: LotBlockTarget | null;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const block = useBlockLot();
  const lift = useLiftLotBlock();
  const [reason, setReason] = useState("");
  const lifting = target?.blockId !== null && target?.blockId !== undefined;
  const pending = block.isPending || lift.isPending;
  const ready = reason.trim().length >= 3 && !pending;

  const close = (): void => {
    setReason("");
    onClose();
  };

  const submit = async (): Promise<void> => {
    if (!target || !ready) {
      return;
    }

    try {
      if (target.blockId) {
        await lift.mutateAsync({ id: target.blockId, reason: reason.trim() });
        toast.success("inventory.lotBlock.lifted");
      } else {
        await block.mutateAsync({
          itemId: target.itemId,
          body: { batchNo: target.batchNo, reason: reason.trim() },
        });
        toast.success("inventory.lotBlock.blocked");
      }
      close();
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <Modal
      data-testid="lot-block-modal"
      open={target !== null}
      onOpenChange={(open) => !open && close()}
      title={lifting ? "inventory.lotBlock.liftTitle" : "inventory.lotBlock.blockTitle"}
      description={t(
        lifting ? "inventory.lotBlock.liftDescription" : "inventory.lotBlock.blockDescription",
        { lot: target?.batchNo ?? "" },
      )}
      footer={
        <>
          <Button variant="secondary" data-testid="lot-block-cancel" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button
            variant={lifting ? "primary" : "danger"}
            icon={<Icon name={lifting ? "check" : "lock"} />}
            data-testid="lot-block-confirm"
            isLoading={pending}
            aria-disabled={!ready || undefined}
            onClick={() => void submit()}
          >
            {t(lifting ? "inventory.lotBlock.lift" : "inventory.lotBlock.block")}
          </Button>
        </>
      }
    >
      <FormField label="inventory.lotBlock.reason" htmlFor="lot-block-reason" required>
        <Textarea
          id="lot-block-reason"
          data-testid="lot-block-reason"
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </FormField>
    </Modal>
  );
}
