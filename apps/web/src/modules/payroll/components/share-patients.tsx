import type { SettlementTreatment } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, EmptyState, Icon, Ltr, Money, Table, type Column } from "@clinic/ui";
import { SETTLEMENT_STATUS_TONES } from "@web/shared/constants/settlement";
import { formatDate } from "@web/shared/lib/format";
import { useCurrency } from "@web/shared/queries/clinic";

export function SharePatients({
  treatments,
  isLoading,
  closed,
  onEdit,
}: {
  readonly treatments: readonly SettlementTreatment[];
  readonly isLoading: boolean;
  readonly closed: boolean;
  readonly onEdit: (treatment: SettlementTreatment) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const currency = useCurrency();

  const columns: Column<SettlementTreatment>[] = [
    {
      key: "patient",
      header: "payroll.patients.patient",
      primary: true,
      render: (row) => (
        <span className="flex flex-col">
          <span className="font-medium text-ink">
            {row.patientName}
            {row.fileNumber && (
              <span className="text-meta text-ink-muted">
                {" · "}
                <Ltr>#{row.fileNumber}</Ltr>
              </span>
            )}
          </span>
          <span className="text-meta text-ink-muted">
            {row.procedureName} · {formatDate(row.performedAt)}
          </span>
          {row.waivedReason && (
            <span className="text-meta text-ink-muted">
              {t("doctors.settlement.waivedBecause", { reason: row.waivedReason })}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "amount",
      header: "payroll.patients.amount",
      align: "numeric",
      render: (row) => <Money amount={row.revenue} currency={currency} />,
    },
    {
      key: "patientPaid",
      header: "payroll.patients.patientPaid",
      render: (row) => (
        <Badge
          tone={
            row.collectedPercent >= 100
              ? "success"
              : row.collectedPercent > 0
                ? "warning"
                : "danger"
          }
        >
          {row.collectedPercent >= 100
            ? t("payroll.patients.paidInFull")
            : row.collectedPercent > 0
              ? t("payroll.patients.paidPart", { percent: Math.round(row.collectedPercent) })
              : t("payroll.patients.notPaid")}
        </Badge>
      ),
    },
    {
      key: "share",
      header: "payroll.patients.share",
      align: "numeric",
      render: (row) => (
        <span className="flex flex-col items-end">
          <Money amount={row.payable} currency={currency} className="font-medium" />
          {row.split && (
            <span className="text-meta text-ink-muted">
              {t("doctors.settlement.workShare", { percent: row.workPercent })}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "doctorPaid",
      header: "payroll.patients.doctorPaid",
      render: (row) => (
        <Badge tone={SETTLEMENT_STATUS_TONES[row.status]}>
          {t(`doctors.settlement.statuses.${row.status}`)}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "common.actions",
      actions: true,
      render: (row) =>
        closed ? null : (
          <Button
            size="sm"
            variant="quiet"
            icon={<Icon name="edit" />}
            aria-label={t("payroll.patients.edit", { name: row.patientName })}
            data-testid={`share-patient-edit-${row.id}`}
            onClick={() => onEdit(row)}
          />
        ),
    },
  ];

  return (
    <section data-testid="share-patients" className="flex flex-col gap-3">
      <h2 className="text-value font-semibold text-ink">
        {t("payroll.patients.title", { count: treatments.length })}
      </h2>
      <Table
        data-testid="share-patients-table"
        columns={columns}
        rows={treatments}
        rowKey={(row) => `${row.id}:${row.doctorId}`}
        isLoading={isLoading}
        empty={
          <EmptyState
            icon="stethoscope"
            data-testid="share-patients-empty"
            title="doctors.settlement.noTreatments"
          />
        }
      />
    </section>
  );
}
