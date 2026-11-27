import {
  PAYMENT_COLLECTOR,
  SETTLEMENT_LINE_STATUSES,
  subtractMoney,
  type OwnSettlementLine,
  type SettlementLineStatus,
} from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  Badge,
  DateRangePicker,
  EmptyState,
  Ltr,
  Money,
  PageHeader,
  SegmentedControl,
  StatCard,
  Table,
  type Column,
} from "@clinic/ui";
import { ShareCalculation } from "@web/modules/earnings/components/share-calculation";
import { netSteps, shareSteps } from "@web/modules/earnings/lib/share-steps";
import { useMyEarnings } from "@web/modules/earnings/queries";
import { SETTLEMENT_STATUS_TONES } from "@web/shared/constants/settlement";
import { ApiError } from "@web/shared/lib/api-error";
import { isIsoDate, todayIso } from "@web/shared/lib/dates";
import { formatDate, moneyText } from "@web/shared/lib/format";
import { useClinic } from "@web/shared/queries/clinic";

const ALL = "all";

const isStatus = (value: string | null): value is SettlementLineStatus =>
  SETTLEMENT_LINE_STATUSES.some((status) => status === value);

export function MyEarningsPage(): JSX.Element {
  const { t } = useTranslation();
  const clinic = useClinic();
  const currency = clinic.data?.currency;
  const [params, setParams] = useSearchParams();

  const today = todayIso();
  const from = params.get("from") ?? `${today.slice(0, 8)}01`;
  const to = params.get("to") ?? today;
  const statusParam = params.get("status");
  const status = isStatus(statusParam) ? statusParam : undefined;
  const valid = isIsoDate(from) && isIsoDate(to) && from <= to;

  const earnings = useMyEarnings({ from, to, ...(status && { status }) }, valid);
  const data = earnings.data;
  const doctorCollects = data?.collector === PAYMENT_COLLECTOR.DOCTOR;
  const noProfile = earnings.error instanceof ApiError && earnings.error.statusCode === 404;

  const setParam = (changes: Record<string, string | null>): void =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);

        for (const [key, value] of Object.entries(changes)) {
          if (value === null) {
            next.delete(key);
          } else {
            next.set(key, value);
          }
        }

        return next;
      },
      { replace: true },
    );

  const columns: Column<OwnSettlementLine>[] = [
    {
      key: "procedure",
      header: "chart.panel.procedure",
      primary: true,
      render: (row) => {
        const steps = shareSteps(row);

        return (
          <span className="flex flex-col">
            <span className="font-medium text-ink">{row.procedureName}</span>
            <span className="text-meta text-ink-muted">
              {row.patientName}
              {row.fileNumber && (
                <>
                  {" · "}
                  <Ltr>#{row.fileNumber}</Ltr>
                </>
              )}{" "}
              · {formatDate(row.performedAt)}
            </span>
            {row.waivedReason && (
              <span className="text-meta text-ink-muted">
                {t("doctors.settlement.waivedBecause", { reason: row.waivedReason })}
              </span>
            )}
            {steps && !row.waivedReason && (
              <ShareCalculation
                data-testid={`my-earnings-calculation-${row.id}`}
                revenue={row.revenue}
                share={row.doctorShare}
                currency={currency}
                {...steps}
              />
            )}
          </span>
        );
      },
    },
    {
      key: "amount",
      header: "doctors.settlement.amount",
      align: "numeric",
      hideOnMobile: data?.breakdown !== undefined,
      render: (row) => <Money amount={row.revenue} currency={currency} />,
    },
    {
      key: "share",
      header: "earnings.myShare",
      align: "numeric",
      render: (row) => (
        <span className="flex flex-col items-end">
          <Money amount={row.payable} currency={currency} className="font-medium" />
          {row.workPercent < 100 && (
            <span className="text-meta text-ink-muted">
              {t("doctors.settlement.workShare", { percent: row.workPercent })}
            </span>
          )}
          {row.collectedPercent < 100 && (
            <span className="text-meta text-ink-muted">
              {t("doctors.settlement.collectedOf", {
                percent: row.collectedPercent,
                amount: moneyText(row.doctorShare, currency),
              })}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "status",
      header: "earnings.paidToMe",
      render: (row) => (
        <span className="flex flex-col items-start gap-1">
          <Badge tone={SETTLEMENT_STATUS_TONES[row.status]}>
            {t(`doctors.settlement.statuses.${row.status}`)}
          </Badge>
          {Number(row.paid) !== 0 && Number(row.outstanding) !== 0 && (
            <span className="text-meta text-ink-muted">
              {t("earnings.paidAndLeft", {
                paid: moneyText(row.paid, currency),
                left: moneyText(row.outstanding, currency),
              })}
            </span>
          )}
        </span>
      ),
    },
  ];

  return (
    <div data-testid="my-earnings-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="my-earnings-header"
        title="earnings.title"
        subtitle="earnings.subtitle"
      />

      {noProfile ? (
        <EmptyState
          icon="stethoscope"
          data-testid="my-earnings-no-profile"
          title="earnings.noProfile"
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex w-full flex-col gap-1 text-label text-ink-muted sm:w-auto">
              {t("doctors.settlement.period")}
              <DateRangePicker
                id="my-earnings-period"
                data-testid="my-earnings-period"
                className="w-full sm:w-64"
                label={t("doctors.settlement.period")}
                value={{ from, to }}
                onChange={(range) => setParam({ from: range.from, to: range.to || range.from })}
              />
            </label>

            {!doctorCollects && (
              <SegmentedControl
                data-testid="my-earnings-status"
                label={t("earnings.paidToMe")}
                value={status ?? ALL}
                onChange={(next) => setParam({ status: next === ALL ? null : next })}
                options={[ALL, ...SETTLEMENT_LINE_STATUSES].map((value) => ({
                  value,
                  label: t(value === ALL ? "common.all" : `doctors.settlement.statuses.${value}`),
                }))}
              />
            )}
          </div>

          {data && doctorCollects && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label={t("earnings.shareInPeriod")}
                value={<Money amount={data.totals.payable} currency={currency} />}
                caption={t(`doctors.settlement.basis.${data.basis}`)}
                icon="stethoscope"
                tone="primary"
              />
              <StatCard
                data-testid="my-earnings-collected"
                label={t("earnings.collected")}
                value={<Money amount={data.held} currency={currency} />}
                icon="money"
                tone="success"
              />
              <StatCard
                data-testid="my-earnings-handed-over"
                label={t("earnings.handedOver")}
                value={<Money amount={data.remitted} currency={currency} />}
                icon="check"
                tone="success"
              />
              <StatCard
                data-testid="my-earnings-balance"
                label={t(
                  Number(data.balance) > 0 ? "earnings.dueFromClinic" : "earnings.owedToClinic",
                )}
                value={
                  <Money
                    amount={
                      Number(data.balance) > 0 ? data.balance : subtractMoney("0.00", data.balance)
                    }
                    currency={currency}
                  />
                }
                caption={t(
                  Number(data.paid) === 0 ? "earnings.owedFormula" : "earnings.owedFormulaPaid",
                  {
                    held: moneyText(data.held, currency),
                    earned: moneyText(data.earned, currency),
                    remitted: moneyText(data.remitted, currency),
                    paid: moneyText(data.paid, currency),
                  },
                )}
                icon="money"
                tone="warning"
              />
            </div>
          )}

          {data && !doctorCollects && (
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label={t("earnings.earnedInPeriod")}
                value={<Money amount={data.totals.payable} currency={currency} />}
                caption={t(`doctors.settlement.basis.${data.basis}`)}
                icon="stethoscope"
                tone="primary"
              />
              <StatCard
                label={t("earnings.paidInPeriod")}
                value={<Money amount={data.totals.paid} currency={currency} />}
                icon="check"
                tone="success"
              />
              <StatCard
                data-testid="my-earnings-balance"
                label={t("earnings.balance")}
                value={<Money amount={data.balance} currency={currency} />}
                caption={t("earnings.balanceCaption")}
                icon="money"
                tone="warning"
              />
            </div>
          )}

          {data?.breakdown && (
            <ShareCalculation
              data-testid="my-earnings-totals"
              revenue={data.breakdown.revenue}
              beforeNet={netSteps(data.breakdown)}
              net={data.breakdown.net}
              share={data.breakdown.doctorShare}
              currency={currency}
            />
          )}

          <Table
            data-testid="my-earnings-table"
            columns={doctorCollects ? columns.filter((column) => column.key !== "status") : columns}
            rows={data?.lines ?? []}
            rowKey={(row) => row.id}
            isLoading={earnings.isPending && valid}
            empty={
              <EmptyState
                icon="stethoscope"
                data-testid="my-earnings-empty"
                title="doctors.settlement.noTreatments"
              />
            }
          />

          {!(doctorCollects && data.payouts.length === 0) && (
            <div className="flex flex-col gap-2">
              <h2 className="text-label font-semibold text-ink">{t("earnings.payouts")}</h2>
              {data && data.payouts.length === 0 && (
                <p className="text-meta text-ink-muted">{t("doctors.settlement.noPayouts")}</p>
              )}
              <ul className="flex flex-col gap-2">
                {data?.payouts.map((payout) => (
                  <li
                    key={payout.id}
                    data-testid={`my-earnings-payout-${payout.id}`}
                    className="flex flex-wrap items-center gap-3 rounded-panel border border-line bg-surface px-3 py-2"
                  >
                    <Money amount={payout.amount} currency={currency} className="font-medium" />
                    <span className="text-meta text-ink-muted">{formatDate(payout.createdAt)}</span>
                    <Badge tone="neutral">
                      {payout.items.length === 0
                        ? t("doctors.settlement.advance")
                        : t("doctors.settlement.coversTreatments", { count: payout.items.length })}
                    </Badge>
                    {payout.reversedAt !== null && (
                      <Badge tone="danger">{t("doctors.settlement.reversed")}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
