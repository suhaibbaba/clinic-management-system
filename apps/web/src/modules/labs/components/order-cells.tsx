import { LAB_ORDER_STATUS, labOrderStage, type LabOrderRow } from "@clinic/shared";
import { differenceInCalendarDays } from "date-fns";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Ltr, useToast } from "@clinic/ui";
import { cn } from "@clinic/ui/lib/cn";
import { errorMessageKey } from "@web/shared/lib/api-error";
import { formatDate } from "@web/shared/lib/format";
import { availableSteps, LAB_ORDER_STAGE_TONES } from "@web/modules/labs/lib/status";
import { useSession } from "@web/shared/providers/session";
import { useLabOrderStep } from "@web/modules/labs/queries";

export function StageBadge({ order }: { readonly order: LabOrderRow }): JSX.Element | null {
  const { t } = useTranslation();
  const stage = labOrderStage(order.status);

  if (stage === null) {
    return null;
  }

  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <Badge tone={LAB_ORDER_STAGE_TONES[stage]} data-testid="lab-order-stage">
        {t(`labs.orders.stages.${stage}`)}
      </Badge>
      {order.status === LAB_ORDER_STATUS.RETURNED && (
        <Badge tone="danger" data-testid="lab-order-returned">
          {t("labs.status.returned")}
        </Badge>
      )}
    </span>
  );
}

export function Work({
  order,
  asCard = false,
}: {
  readonly order: LabOrderRow;
  readonly asCard?: boolean;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <span className="flex min-w-0 flex-col gap-1">
      <bdi className="whitespace-nowrap font-medium text-ink">
        {order.workTypeName ?? t("labs.orders.custom")}
      </bdi>
      {order.teeth.length > 0 && (
        <span className="flex items-baseline gap-1.5 text-label font-normal text-ink-muted">
          <span>{t("labs.orders.teeth", { count: order.teeth.length })}</span>
          <Ltr className="tabular-nums text-ink">{order.teeth.join(" · ")}</Ltr>
        </span>
      )}
      {asCard && (
        <span className="relative z-10 mt-2 flex flex-wrap items-center gap-2">
          <StageBadge order={order} />
          <span className="ms-auto shrink-0">
            <NextStep order={order} />
          </span>
        </span>
      )}
    </span>
  );
}

export function Patient({ order }: { readonly order: LabOrderRow }): JSX.Element {
  return (
    <span className="flex min-w-0 flex-col">
      <span>
        <bdi>{order.patientName}</bdi>
      </span>
      <Ltr className="text-label text-ink-muted">{order.patientFileNumber}</Ltr>
    </span>
  );
}

export function When({ order }: { readonly order: LabOrderRow }): JSX.Element | null {
  const { t } = useTranslation();

  if (order.status === LAB_ORDER_STATUS.RECEIVED && order.receivedAt) {
    return (
      <span className="flex flex-col whitespace-nowrap text-label">
        <span className="text-ink-muted">{t("labs.orders.when.received")}</span>
        <Ltr className="text-ink">{formatDate(order.receivedAt)}</Ltr>
      </span>
    );
  }

  if (!order.expectedAt) {
    return null;
  }

  const days = differenceInCalendarDays(new Date(order.expectedAt), new Date());
  const text =
    days < 0
      ? t("labs.orders.when.late", { count: -days })
      : days === 0
        ? t("labs.orders.when.today")
        : t("labs.orders.when.in", { count: days });

  return (
    <span data-testid="lab-order-when" className="flex flex-col whitespace-nowrap text-label">
      <span
        className={cn(
          "font-medium",
          order.isOverdue ? "text-danger-600" : days <= 0 ? "text-warning-700" : "text-ink",
        )}
      >
        {text}
      </span>
      <Ltr className="text-ink-muted">{formatDate(order.expectedAt)}</Ltr>
    </span>
  );
}

export const hasWhen = (order: LabOrderRow): boolean =>
  (order.status === LAB_ORDER_STATUS.RECEIVED && order.receivedAt !== null) ||
  order.expectedAt !== null;

export function NextStep({ order }: { readonly order: LabOrderRow }): JSX.Element | null {
  const { t } = useTranslation();
  const { can } = useSession();
  const toast = useToast();
  const step = useLabOrderStep();
  const [moving, setMoving] = useState(false);

  const next = availableSteps(order.status, can).find((candidate) => candidate.step !== "cancel");

  if (!next) {
    return null;
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      data-testid={`lab-order-step-${next.step}`}
      isLoading={moving}
      onClick={async () => {
        setMoving(true);
        try {
          await step.mutateAsync({ id: order.id, step: next.step });
          toast.success("labs.order.moved");
        } catch (error) {
          toast.error(errorMessageKey(error));
        } finally {
          setMoving(false);
        }
      }}
    >
      {t(next.label)}
    </Button>
  );
}
