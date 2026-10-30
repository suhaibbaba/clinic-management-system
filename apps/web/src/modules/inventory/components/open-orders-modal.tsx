import type { OpenOrderLine } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, Modal } from "@clinic/ui";
import { OpenOrderNotice } from "@web/modules/inventory/components/open-order-notice";
import { OPEN_ORDER_WAIT_SECONDS } from "@web/modules/inventory/constants";
import { useCountdown } from "@web/modules/inventory/hooks/use-countdown";

export interface FlaggedLine {
  readonly key: string;
  readonly itemName: string;
  readonly orders: readonly OpenOrderLine[];
}

export function OpenOrdersModal({
  lines,
  onCancel,
  onContinue,
}: {
  readonly lines: readonly FlaggedLine[] | null;
  readonly onCancel: () => void;
  readonly onContinue: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const left = useCountdown(OPEN_ORDER_WAIT_SECONDS, lines !== null);
  const waiting = left > 0;

  return (
    <Modal
      data-testid="open-orders-modal"
      open={lines !== null}
      onOpenChange={(next) => !next && onCancel()}
      title="inventory.purchase.openOrdersTitle"
      description={t("inventory.purchase.openOrdersDescription")}
      footer={
        <>
          <Button variant="secondary" data-testid="open-orders-cancel" onClick={onCancel}>
            {t("inventory.purchase.openOrdersBack")}
          </Button>
          <Button
            data-testid="open-orders-continue"
            aria-disabled={waiting || undefined}
            onClick={() => !waiting && onContinue()}
          >
            {waiting
              ? t("inventory.purchase.openOrdersWait", { seconds: left })
              : t("inventory.purchase.openOrdersContinue")}
          </Button>
        </>
      }
    >
      <ul data-testid="open-orders-lines" className="flex flex-col divide-y divide-line">
        {(lines ?? []).map((line) => (
          <li key={line.key} data-testid="open-orders-line" className="py-2">
            <bdi className="font-medium text-ink">{line.itemName}</bdi>
            <OpenOrderNotice orders={line.orders} onReceive={undefined} />
          </li>
        ))}
      </ul>
    </Modal>
  );
}
