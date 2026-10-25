import type { SettlementTreatment } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Badge, Button, EmptyState, Icon, Ltr, Money, Table, type Column } from "@clinic/ui";
import { groupByCollection, sumMoney } from "@web/modules/payroll/lib/share-groups";
import { SETTLEMENT_STATUS_TONES } from "@web/shared/constants/settlement";
import { formatDate } from "@web/shared/lib/format";
import { canOpenPatientFile } from "@web/shared/permissions/patients";
import { useSession } from "@web/shared/providers/session";
import { useCurrency } from "@web/shared/queries/clinic";

const FIGURE = "w-28";
const STATUS = "w-36";

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
  const { can } = useSession();
  const currency = useCurrency();
  const groups = groupByCollection(treatments);
  const opensFile = canOpenPatientFile(can);

  const columns = (waiting: boolean): Column<SettlementTreatment>[] => [
    {
      key: "patient",
      header: "payroll.patients.patient",
      primary: true,
      render: (row) => (
        <span className="flex flex-col">
          <span className="font-medium text-ink">
            {opensFile ? (
              <Link
                to={`/patients/${row.patientId}`}
                data-testid={`share-patient-open-${row.id}`}
                className="text-primary-600 transition-colors duration-150 hover:text-primary-700"
              >
                {row.patientName}
              </Link>
            ) : (
              row.patientName
            )}
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
      className: FIGURE,
      render: (row) => <Money amount={row.revenue} currency={currency} />,
    },
    {
      key: "patientPaid",
      header: "payroll.patients.patientPaid",
      className: STATUS,
      render: (row) =>
        row.collectedPercent >= 100 ? (
          <Badge tone="success">{t("payroll.patients.paidInFull")}</Badge>
        ) : (
          <Badge tone={row.collectedPercent > 0 ? "warning" : "danger"}>
            {row.collectedPercent > 0
              ? t("payroll.patients.paidPart", { percent: Math.round(row.collectedPercent) })
              : t("payroll.patients.notPaid")}
          </Badge>
        ),
    },
    {
      key: "share",
      header: waiting ? "payroll.patients.shareWhenPaid" : "payroll.patients.share",
      align: "numeric",
      className: FIGURE,
      render: (row) => (
        <span className="flex flex-col">
          <Money
            amount={waiting ? row.doctorShare : row.payable}
            currency={currency}
            className="font-medium"
          />
          {waiting && Number(row.payable) > 0 && (
            <span className="text-meta text-success-700">
              {t("payroll.patients.readySoFar")} <Money amount={row.payable} currency={currency} />
            </span>
          )}
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
      className: STATUS,
      render: (row) =>
        waiting ? null : Number(row.revenue) === 0 ? (
          <Badge tone="neutral">{t("payroll.patients.noPrice")}</Badge>
        ) : (
          <Badge tone={SETTLEMENT_STATUS_TONES[row.status]}>
            {t(`doctors.settlement.statuses.${row.status}`)}
          </Badge>
        ),
    },
    {
      key: "actions",
      header: "common.actions",
      actions: true,
      besideTitleOnMobile: true,
      className: "w-16",
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

  if (!isLoading && treatments.length === 0) {
    return (
      <EmptyState
        icon="stethoscope"
        data-testid="share-patients-empty"
        title="doctors.settlement.noTreatments"
      />
    );
  }

  return (
    <section data-testid="share-patients" className="flex flex-col gap-6">
      <ShareGroup
        data-testid="share-patients-collected"
        title={t("payroll.patients.collectedTitle")}
        tone="success"
        count={groups.collected.length}
        total={sumMoney(groups.collected, (row) => row.payable)}
      >
        <Table
          data-testid="share-patients-collected-table"
          columns={columns(false)}
          rows={groups.collected}
          rowKey={(row) => `${row.id}:${row.doctorId}`}
          isLoading={isLoading}
          empty={
            <EmptyState
              icon="clock"
              data-testid="share-patients-collected-empty"
              title="payroll.patients.noneCollected"
            />
          }
        />
      </ShareGroup>

      {groups.waiting.length > 0 && (
        <ShareGroup
          data-testid="share-patients-waiting"
          title={t("payroll.patients.waitingTitle")}
          tone="danger"
          count={groups.waiting.length}
          total={sumMoney(groups.waiting, (row) => row.doctorShare)}
          hint={t("payroll.patients.waitingHint")}
        >
          <Table
            data-testid="share-patients-waiting-table"
            columns={columns(true)}
            rows={groups.waiting}
            rowKey={(row) => `${row.id}:${row.doctorId}`}
          />
        </ShareGroup>
      )}
    </section>
  );
}

function ShareGroup({
  title,
  tone,
  count,
  total,
  hint,
  children,
  "data-testid": testId,
}: {
  readonly title: string;
  readonly tone: "success" | "danger";
  readonly count: number;
  readonly total: string;
  readonly hint?: string;
  readonly children: JSX.Element;
  readonly "data-testid": string;
}): JSX.Element {
  const { t } = useTranslation();
  const currency = useCurrency();

  return (
    <div data-testid={testId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-value font-semibold text-ink">
          <Badge tone={tone}>{title}</Badge>
          {t("payroll.patients.treatments", { count })}
        </h2>
        <span className="text-label text-ink-muted">
          {t("payroll.patients.shareTotal")}{" "}
          <Money amount={total} currency={currency} className="font-semibold text-ink" />
        </span>
      </div>
      {hint && <p className="text-meta text-ink-muted">{hint}</p>}
      {children}
    </div>
  );
}
