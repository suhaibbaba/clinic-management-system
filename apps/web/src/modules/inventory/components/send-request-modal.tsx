import { LOOKUP_LIST, type PurchaseRequest } from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, FormField, Icon, InfoTip, Input, Ltr, Modal, Switch, useToast } from "@clinic/ui";
import { errorToast } from "@web/shared/lib/api-error";
import { formatDate, moneyText } from "@web/shared/lib/format";
import { useCurrency } from "@web/shared/queries/clinic";
import { useLookupLabels } from "@web/shared/queries/lookups";
import { orderMessage, whatsappLink } from "@web/modules/inventory/lib/order-message";
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
  const currency = useCurrency();
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
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

  const markOrdered = async (success: string): Promise<void> => {
    if (!request) {
      return;
    }

    try {
      await marking.mutateAsync(request.id);
      toast.success(success);
      onClose();
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  const sendText = (): void => {
    if (!request || !ready) {
      return;
    }

    const text = orderMessage(request, {
      translate: (key, values) => t(key, values),
      unitLabel: (code) => unitLabel(code),
      price: withPrices ? (amount) => moneyText(amount, currency) : null,
    });

    window.open(whatsappLink(to, text), "_blank", "noopener,noreferrer");
    void markOrdered("inventory.requests.markedOrdered");
  };

  const sendPdf = async (): Promise<void> => {
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

  return (
    <Modal
      data-testid="send-request-modal"
      open={request !== null}
      onOpenChange={(next) => !next && onClose()}
      title="inventory.requests.sendTitle"
      size="form"
      footer={
        <>
          <Button
            variant="secondary"
            data-testid="send-request-mark"
            aria-disabled={pending || undefined}
            onClick={() => !pending && void markOrdered("inventory.requests.markedOrdered")}
          >
            {t("inventory.requests.markOrdered")}
          </Button>
          <span className="flex items-center gap-1">
            <Button
              variant="secondary"
              icon={<Icon name="file" />}
              data-testid="send-request-pdf"
              isLoading={sending.isPending}
              aria-disabled={!ready || undefined}
              onClick={() => void sendPdf()}
            >
              {t("inventory.requests.sendPdf")}
            </Button>
            <InfoTip label={t("common.moreInfo")}>{t("inventory.requests.sendPdfCost")}</InfoTip>
          </span>
          <Button
            icon={<Icon name="whatsapp" />}
            data-testid="send-request-text"
            aria-disabled={!ready || undefined}
            onClick={sendText}
          >
            {t("inventory.requests.sendText")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {request && (
          <dl
            data-testid="send-request-summary"
            className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-card bg-inset p-4 text-value"
          >
            <div className="min-w-0">
              <dt className="text-meta text-ink-muted">{t("inventory.movement.supplier")}</dt>
              <dd className="mt-0.5 font-medium text-ink">
                <bdi>{request.supplierName ?? t("inventory.purchase.noSupplier")}</bdi>
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-meta text-ink-muted">{t("inventory.requests.columns.number")}</dt>
              <dd className="mt-0.5 font-medium text-ink">
                <Ltr>{request.number}</Ltr>
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-meta text-ink-muted">{t("inventory.requests.columns.items")}</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {t("inventory.purchase.itemCount", { count: request.lines.length })}
              </dd>
            </div>
            {request.neededBy && (
              <div className="min-w-0">
                <dt className="text-meta text-ink-muted">{t("inventory.requests.neededBy")}</dt>
                <dd className="mt-0.5 font-medium text-ink">
                  <Ltr>{formatDate(request.neededBy)}</Ltr>
                </dd>
              </div>
            )}
          </dl>
        )}

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
      </div>
    </Modal>
  );
}
