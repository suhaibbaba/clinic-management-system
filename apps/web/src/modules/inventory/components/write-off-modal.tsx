import { LOOKUP_LIST } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  FormField,
  Icon,
  Modal,
  QuantityInput,
  Select,
  Textarea,
  useToast,
} from "@clinic/ui";
import { errorToast } from "@web/shared/lib/api-error";
import { useLookupOptions } from "@web/shared/queries/lookups";
import { useWriteOff } from "@web/modules/inventory/queries";

export interface WriteOffTarget {
  readonly itemId: string;
  readonly itemName: string;
  readonly batchNo: string | null;
}

export function WriteOffModal({
  target,
  onClose,
}: {
  readonly target: WriteOffTarget | null;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const reasons = useLookupOptions(LOOKUP_LIST.WRITE_OFF_REASON);
  const writeOff = useWriteOff();
  const [quantity, setQuantity] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const reason = reasonCode || (reasons[0]?.value ?? "");
  const ready = Number(quantity || "0") > 0 && reason !== "" && !writeOff.isPending;

  const close = (): void => {
    setQuantity("");
    setReasonCode("");
    setNote("");
    setRequestId(crypto.randomUUID());
    onClose();
  };

  const submit = async (): Promise<void> => {
    if (!target || !ready) {
      return;
    }

    try {
      await writeOff.mutateAsync({
        itemId: target.itemId,
        quantity: quantity.trim(),
        reasonCode: reason,
        requestId,
        ...(target.batchNo && { batchNo: target.batchNo }),
        ...(note.trim() !== "" && { note: note.trim() }),
      });
      toast.success("inventory.writeOff.done");
      close();
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <Modal
      data-testid="write-off-modal"
      open={target !== null}
      onOpenChange={(open) => !open && close()}
      title="inventory.writeOff.title"
      description={t(
        target?.batchNo ? "inventory.writeOff.descriptionLot" : "inventory.writeOff.description",
        { item: target?.itemName ?? "", lot: target?.batchNo ?? "" },
      )}
      footer={
        <>
          <Button variant="secondary" data-testid="write-off-cancel" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            icon={<Icon name="trash" />}
            data-testid="write-off-confirm"
            isLoading={writeOff.isPending}
            aria-disabled={!ready || undefined}
            onClick={() => void submit()}
          >
            {t("inventory.writeOff.confirm")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="inventory.movement.quantity" htmlFor="write-off-quantity" required>
          <QuantityInput
            id="write-off-quantity"
            data-testid="write-off-quantity"
            placeholder="0"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </FormField>
        <FormField label="inventory.writeOff.reason" htmlFor="write-off-reason" required>
          <Select
            id="write-off-reason"
            data-testid="write-off-reason"
            value={reason}
            onChange={(event) => setReasonCode(event.target.value)}
            options={reasons}
          />
        </FormField>
      </div>
      <FormField label="inventory.notes" htmlFor="write-off-note" optional>
        <Textarea
          id="write-off-note"
          data-testid="write-off-note"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </FormField>
    </Modal>
  );
}
