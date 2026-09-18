import type { LabOrderRow } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Badge, EmptyState, Ltr, Table, type Column } from "@clinic/ui";
import { Money } from "@web/features/billing/money";
import { useClinic } from "@web/features/clinic/queries";
import { LAB_ORDER_FIELDS } from "@web/features/labs/fields";
import { LAB_ORDER_STATUS_STYLES } from "@web/features/labs/status";
import { formatDate } from "@web/lib/format";

export function LabOrdersTable({
  orders,
  isLoading,
  isRefreshing = false,
  onOpen,
  hideLab = false,
  "data-testid": testId = "lab-orders-table",
}: {
  readonly "data-testid"?: string | undefined;
  readonly orders: readonly LabOrderRow[];
  readonly isLoading: boolean;
  readonly isRefreshing?: boolean | undefined;
  readonly onOpen?: ((order: LabOrderRow) => void) | undefined;
  /** Dropped on a lab's own page, where every row names the same lab. */
  readonly hideLab?: boolean | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const clinic = useClinic();

  const columns: readonly Column<LabOrderRow>[] = [
    {
      key: "work",
      header: LAB_ORDER_FIELDS.work.label,
      icon: LAB_ORDER_FIELDS.work.icon,
      primary: true,
      render: (row) => (
        <span className="flex flex-col">
          <span className="font-medium text-ink">
            {row.workTypeName ?? t("labs.orders.custom")}
          </span>
          {row.teeth.length > 0 && (
            <span className="hidden md:block">
              <Ltr className="text-label text-ink-muted tabular-nums">{row.teeth.join(" · ")}</Ltr>
            </span>
          )}
        </span>
      ),
    },
    {
      key: "patient",
      header: LAB_ORDER_FIELDS.patient.label,
      icon: LAB_ORDER_FIELDS.patient.icon,
      render: (row) => (
        <span className="flex flex-col">
          <span>{row.patientName}</span>
          <Ltr className="text-label text-ink-muted">{row.patientFileNumber}</Ltr>
        </span>
      ),
    },
    {
      key: "teeth",
      header: LAB_ORDER_FIELDS.teeth.label,
      icon: LAB_ORDER_FIELDS.teeth.icon,
      hideOnDesktop: true,
      render: (row) =>
        row.teeth.length > 0 ? <Ltr className="tabular-nums">{row.teeth.join(" · ")}</Ltr> : null,
    },
    ...(hideLab
      ? []
      : [
          {
            key: "lab",
            header: LAB_ORDER_FIELDS.lab.label,
            icon: LAB_ORDER_FIELDS.lab.icon,
            render: (row: LabOrderRow) => row.labName,
          } satisfies Column<LabOrderRow>,
        ]),
    {
      key: "status",
      header: LAB_ORDER_FIELDS.status.label,
      icon: LAB_ORDER_FIELDS.status.icon,
      render: (row) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone={LAB_ORDER_STATUS_STYLES[row.status].tone} data-testid="lab-order-status">
            {t(LAB_ORDER_STATUS_STYLES[row.status].label)}
          </Badge>
          {row.isOverdue && (
            <Badge tone="danger" data-testid="lab-order-overdue">
              {t("labs.orders.overdue")}
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: "expected",
      header: LAB_ORDER_FIELDS.expected.label,
      icon: LAB_ORDER_FIELDS.expected.icon,
      hideOnMobile: true,
      render: (row) => (row.expectedAt ? <Ltr>{formatDate(row.expectedAt)}</Ltr> : "—"),
    },
    {
      key: "price",
      header: LAB_ORDER_FIELDS.price.label,
      icon: LAB_ORDER_FIELDS.price.icon,
      align: "numeric",
      render: (row) => <Money amount={row.price} currency={clinic.data?.currency} />,
    },
  ];

  return (
    <Table
      data-testid={testId}
      columns={columns}
      rows={orders}
      rowKey={(row) => row.id}
      isLoading={isLoading}
      isRefreshing={isRefreshing}
      {...(onOpen && { onRowClick: onOpen, rowLabel: (row: LabOrderRow) => row.patientName })}
      empty={
        <EmptyState
          icon="clipboard"
          data-testid={`${testId}-empty`}
          title="labs.orders.empty"
          hint="labs.orders.emptyHint"
        />
      }
    />
  );
}
