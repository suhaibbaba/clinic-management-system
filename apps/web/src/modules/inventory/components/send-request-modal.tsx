import { type PurchaseRequest } from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, FormField, Icon, Input, Modal, Switch, useToast } from "@clinic/ui";
import { errorToast } from "@web/shared/lib/api-error";
import { useMarkRequestOrdered, useSendPurchaseRequest } from "@web/modules/inventory/queries";

export function SendRequestModal({
  request,
  mayShowPrices,
  onClose,
}: {
  readonly request: PurchaseRequest | null;
  readonly mayShowPrices: boolean;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const sending = useSendPurchaseRequest();
  const marking = useMarkRequestOrdered();
  const [to, setTo] = useState("");
  const [withPrices, setWithPrices] = useState(false);
  const pending = sending.isPending || marking.isPending;
  const ready = to.trim() !== "" && !pending;

  useEffect(() => {
    setTo(request?.supplierPhone ?? "");
    setWithPrices(false);
  }, [request]);

  const send = async (): Promise<void> => {
    if (!request || !ready) {
      return;
    }

    try {
      await sending.mutateAsync({ id: request.id, body: { to: to.trim(), withPrices } });
      toast.success("inventory.requests.sent");
      onClose();
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  const markSent = async (): Promise<void> => {
    if (!request || pending) {
      return;
    }

    try {
      await marking.mutateAsync(request.id);
      toast.success("inventory.requests.markedOrdered");
      onClose();
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <Modal
      data-testid="send-request-modal"
      open={request !== null}
      onOpenChange={(next) => !next && onClose()}
      title="inventory.requests.sendTitle"
      description={t("inventory.requests.sendDescription", {
        number: request?.number ?? "",
        supplier: request?.supplierName ?? "",
      })}
      footer={
        <>
          <Button
            variant="secondary"
            data-testid="send-request-mark"
            aria-disabled={pending || undefined}
            onClick={() => void markSent()}
          >
            {t("inventory.requests.markOrdered")}
          </Button>
          <Button
            icon={<Icon name="whatsapp" />}
            data-testid="send-request-confirm"
            isLoading={sending.isPending}
            aria-disabled={!ready || undefined}
            onClick={() => void send()}
          >
            {t("inventory.requests.send")}
          </Button>
        </>
      }
    >
      <FormField label="inventory.requests.whatsapp" htmlFor="send-request-to" required>
        <Input
          id="send-request-to"
          data-testid="send-request-to"
          dir="ltr"
          inputMode="tel"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
      </FormField>
      {mayShowPrices && (
        <Switch
          data-testid="send-request-prices"
          checked={withPrices}
          onCheckedChange={setWithPrices}
          label={t("inventory.requests.withPrices")}
        />
      )}
    </Modal>
  );
}
