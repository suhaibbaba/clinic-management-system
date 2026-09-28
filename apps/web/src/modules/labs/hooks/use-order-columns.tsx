import type { LabOrderRow, LabOrderView } from "@clinic/shared";
import { useTranslation } from "react-i18next";
import { Badge, Ltr, type Column } from "@clinic/ui";
import { useIsMobile } from "@clinic/ui/lib/use-media-query";
import { Money } from "@web/modules/billing/components/money";
import {
  hasWhen,
  NextStep,
  Patient,
  StageBadge,
  When,
  Work,
} from "@web/modules/labs/components/order-cells";
import { LAB_ORDER_FIELDS } from "@web/modules/labs/constants";
import { formatDate } from "@web/shared/lib/format";
import { LAB_ORDER_STATUS_STYLES } from "@web/modules/labs/lib/status";
import { useClinic } from "@web/modules/clinic/queries";

export function useOrderColumns(view: LabOrderView): readonly Column<LabOrderRow>[] {
  const { t } = useTranslation();
  const clinic = useClinic();
  const isMobile = useIsMobile();

  const work: Column<LabOrderRow> = {
    key: "work",
    header: LAB_ORDER_FIELDS.work.label,
    primary: true,
    render: (row) => <Work order={row} asCard={view === "open" && isMobile} />,
  };
  const patient: Column<LabOrderRow> = {
    key: "patient",
    header: LAB_ORDER_FIELDS.patient.label,
    hideOnMobile: true,
    render: (row) => <Patient order={row} />,
  };
  const lab: Column<LabOrderRow> = {
    key: "lab",
    header: LAB_ORDER_FIELDS.lab.label,
    hideOnMobile: true,
    render: (row) => <span className="whitespace-nowrap">{row.labName}</span>,
  };
  const who: Column<LabOrderRow> = {
    key: "who",
    header: LAB_ORDER_FIELDS.patient.label,
    hideOnDesktop: true,
    render: (row) => (
      <span className="flex min-w-0 flex-col">
        <span>
          <bdi>{row.patientName}</bdi>
        </span>
        <span className="truncate text-label text-ink-muted">{row.labName}</span>
      </span>
    ),
  };

  if (view === "open") {
    return [
      work,
      patient,
      lab,
      who,
      {
        key: "stage",
        header: "labs.orders.stages.label",
        hideOnMobile: true,
        render: (row) => <StageBadge order={row} />,
      },
      {
        key: "when",
        header: "labs.orders.columns.when",
        render: (row) => (hasWhen(row) ? <When order={row} /> : null),
      },
      {
        key: "step",
        header: "labs.orders.columns.next",
        actions: true,
        hideOnMobile: true,
        render: (row) => <NextStep order={row} />,
      },
    ];
  }

  return [
    work,
    patient,
    lab,
    who,
    {
      key: "status",
      header: LAB_ORDER_FIELDS.status.label,
      render: (row) => (
        <Badge tone={LAB_ORDER_STATUS_STYLES[row.status].tone} data-testid="lab-order-status">
          {t(LAB_ORDER_STATUS_STYLES[row.status].label)}
        </Badge>
      ),
    },
    {
      key: "finished",
      header: "labs.orders.columns.finished",
      render: (row) => <Ltr>{formatDate(row.fittedAt ?? row.updatedAt)}</Ltr>,
    },
    {
      key: "price",
      header: LAB_ORDER_FIELDS.price.label,
      align: "numeric",
      render: (row) => <Money amount={row.price} currency={clinic.data?.currency} />,
    },
  ];
}
