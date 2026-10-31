import { type PurchaseRequest } from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  FormField,
  Icon,
  Ltr,
  Modal,
  PhoneInput,
  Switch,
  Textarea,
  usePersonName,
  useToast,
} from "@clinic/ui";
import { errorToast } from "@web/shared/lib/api-error";
import { formatDate } from "@web/shared/lib/format";
import { useSession } from "@web/shared/providers/session";
import { orderMessage } from "@web/modules/inventory/lib/order-message";
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
  const { user } = useSession();
  const nameOf = usePersonName();
  const senderName = nameOf(user?.name);
  const clinicName = nameOf(user?.clinic.name);
  const sending = useSendPurchaseRequest();
  const marking = useMarkRequestOrdered();
  const [to, setTo] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [withPrices, setWithPrices] = useState(false);
  const pending = sending.isPending || marking.isPending;
  const ready = Boolean(to?.trim()) && message.trim() !== "" && !pending;

  useEffect(() => {
    setTo(request?.supplierPhone ?? null);
    setMessage(
      request
        ? orderMessage(request, { name: senderName, clinic: clinicName }, (key, values = {}) =>
            t(key, values),
          )
        : "",
    );
    setWithPrices(false);
  }, [request, senderName, clinicName, t]);

  const markOrdered = async (): Promise<void> => {
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

  const send = async (): Promise<void> => {
    if (!request || !ready || !to) {
      return;
    }

    try {
      await sending.mutateAsync({
        id: request.id,
        body: { to: to.trim(), withPrices, message: message.trim() },
      });
      toast.success("inventory.requests.sent");
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
      description="inventory.requests.sendDescription"
      size="form"
      footer={
        <>
          <Button
            variant="quiet"
            className="me-auto"
            data-testid="send-request-mark"
            aria-disabled={pending || undefined}
            isLoading={marking.isPending}
            onClick={() => void markOrdered()}
          >
            {t("inventory.requests.markOrdered")}
          </Button>
          <Button variant="secondary" data-testid="send-request-cancel" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            icon={<Icon name="whatsapp" />}
            data-testid="send-request-submit"
            isLoading={sending.isPending}
            aria-disabled={!ready || undefined}
            onClick={() => void send()}
          >
            {t("inventory.requests.sendSubmit")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {request && (
          <div
            data-testid="send-request-attachment"
            className="flex items-center gap-3 rounded-card border border-line p-3"
          >
            <span className="grid size-(--control-h) shrink-0 place-items-center rounded-control bg-primary-100 text-primary-700">
              <Icon name="file" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-value font-medium text-ink">
                <bdi>{t("inventory.requests.attachment", { number: request.number })}</bdi>
              </p>
              <p className="mt-0.5 truncate text-meta text-ink-muted">
                <bdi>{request.supplierName ?? t("inventory.purchase.noSupplier")}</bdi>
                {" · "}
                {t("inventory.purchase.itemCount", { count: request.lines.length })}
                {request.neededBy && (
                  <>
                    {" · "}
                    {t("inventory.requests.neededBy")} <Ltr>{formatDate(request.neededBy)}</Ltr>
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        <FormField label="inventory.requests.whatsapp" htmlFor="send-request-to" required>
          <PhoneInput
            id="send-request-to"
            data-testid="send-request-to"
            value={to}
            onChange={setTo}
          />
        </FormField>

        <FormField
          label="inventory.requests.messageLabel"
          hint="inventory.requests.messageHint"
          htmlFor="send-request-message"
          required
        >
          <Textarea
            id="send-request-message"
            data-testid="send-request-message"
            rows={4}
            maxLength={1000}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
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
      </div>
    </Modal>
  );
}
