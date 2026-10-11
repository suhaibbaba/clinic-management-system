import {
  SETTLEMENT_LINE_STATUSES,
  addMoney,
  settlementTermsSchema,
  type SettlementLineStatus,
  type SettlementPayout,
  type SettlementTreatment,
} from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  Badge,
  Button,
  ConfirmDialog,
  DateRangePicker,
  EmptyState,
  FormField,
  Icon,
  Ltr,
  MenuItem,
  Money,
  QuantityInput,
  RowMenu,
  SegmentedControl,
  Select,
  StatCard,
  Table,
  useToast,
  type Column,
} from "@clinic/ui";
import { DoctorPayoutModal } from "@web/modules/doctors/components/doctor-payout-modal";
import { SettlementTreatmentModal } from "@web/modules/doctors/components/settlement-treatment-modal";
import {
  useReversePayout,
  useSetSettlementTerms,
  useSettlement,
} from "@web/modules/doctors/queries";
import { SETTLEMENT_STATUS_TONES } from "@web/shared/constants/settlement";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { errorToast } from "@web/shared/lib/api-error";
import { isIsoDate, todayIso } from "@web/shared/lib/dates";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { formatDate, formatMonth, moneyText } from "@web/shared/lib/format";
import { currentMonth, monthsFrom } from "@web/shared/lib/months";
import { useClinic } from "@web/shared/queries/clinic";
import { DocumentActions } from "@web/shared/components/document-actions";
import { useSession } from "@web/shared/providers/session";
import { payoutSource, settlementSource } from "@web/modules/doctors/lib/documents";

const ALL = "all";

const isStatus = (value: string | null): value is SettlementLineStatus =>
  SETTLEMENT_LINE_STATUSES.some((status) => status === value);

export function SettlementSection({
  doctorId,
  doctorPhone,
}: {
  readonly doctorId: string;
  readonly doctorPhone: string | null | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const { can } = useSession();
  const clinic = useClinic();
  const currency = clinic.data?.currency;
  const [params, setParams] = useSearchParams();

  const today = todayIso();
  const thisMonth = currentMonth(today);
  const from = params.get("from") ?? `${today.slice(0, 8)}01`;
  const to = params.get("to") ?? today;
  const statusParam = params.get("status");
  const status = isStatus(statusParam) ? statusParam : undefined;
  const valid = isIsoDate(from) && isIsoDate(to) && from <= to;

  const settlement = useSettlement(doctorId, { from, to, ...(status && { status }) }, valid);
  const setTerms = useSetSettlementTerms(doctorId);
  const reverse = useReversePayout(doctorId);

  const [percent, setPercent] = useState("");
  const [effectiveMonth, setEffectiveMonth] = useState(thisMonth);
  const [editing, setEditing] = useState<SettlementTreatment | null>(null);
  const [paying, setPaying] = useState(false);
  const [reversing, setReversing] = useState<SettlementPayout | null>(null);
  const [opened, setOpened] = useState<string | null>(null);

  const data = settlement.data;
  const terms = useFormErrors(
    schemaErrors(settlementTermsSchema, {
      clinicSharePercent: percent === "" ? undefined : Number(percent),
      effectiveMonth,
    }),
  );

  useEffect(() => {
    if (data) {
      setPercent(String(data.clinicSharePercent));
    }
  }, [data?.clinicSharePercent]);

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

  const saveTerms = async (): Promise<void> => {
    if (!terms.check()) {
      return;
    }

    try {
      await setTerms.mutateAsync({ clinicSharePercent: Number(percent), effectiveMonth });
      toast.success("doctors.settlement.shareSaved");
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  const columns: Column<SettlementTreatment>[] = [
    {
      key: "procedure",
      header: "chart.panel.procedure",
      primary: true,
      render: (row) => (
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
        </span>
      ),
    },
    {
      key: "amount",
      header: "doctors.settlement.amount",
      align: "numeric",
      render: (row) => <Money amount={row.revenue} currency={currency} />,
    },
    {
      key: "deductions",
      header: "doctors.settlement.deductions",
      align: "numeric",
      hideOnMobile: true,
      render: (row) => (
        <span className="flex flex-col items-end">
          <Money amount={addMoney(row.tax, row.overhead)} currency={currency} />
          <span className="text-meta text-ink-muted" dir="ltr">
            {row.taxPercent}% + {row.overheadPercent}%
          </span>
        </span>
      ),
    },
    {
      key: "materials",
      header: "doctors.settlement.materials",
      align: "numeric",
      hideOnMobile: true,
      render: (row) => (
        <span className="inline-flex items-center gap-1.5">
          <Money amount={row.materialCost} currency={currency} />
          {row.materialCostSet && <Badge tone="info">{t("doctors.settlement.adjusted")}</Badge>}
        </span>
      ),
    },
    {
      key: "percent",
      header: "doctors.settlement.clinicPercent",
      align: "numeric",
      render: (row) => (
        <span className="flex flex-col items-end">
          <span className="inline-flex items-center gap-1.5">
            <span dir="ltr">{row.clinicSharePercent}%</span>
            {row.clinicSharePercentSet && (
              <Badge tone="info">{t("doctors.settlement.adjusted")}</Badge>
            )}
          </span>
          {row.split && (
            <span className="text-meta text-ink-muted">
              {t("doctors.settlement.workShare", { percent: row.workPercent })}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "doctor",
      header: "doctors.settlement.doctorShare",
      align: "numeric",
      render: (row) => (
        <span className="flex flex-col items-end">
          <Money amount={row.payable} currency={currency} className="font-medium" />
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
      header: "doctors.settlement.status",
      render: (row) => (
        <span className="flex flex-col items-start gap-0.5">
          <Badge tone={SETTLEMENT_STATUS_TONES[row.status]}>
            {t(`doctors.settlement.statuses.${row.status}`)}
          </Badge>
          {row.status === "adjusted" && (
            <span className="text-meta text-ink-muted">
              {t("doctors.settlement.correction", {
                amount: moneyText(row.outstanding, currency),
              })}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "actions",
      header: "common.actions",
      actions: true,
      render: (row) => (
        <Button
          size="sm"
          variant="quiet"
          icon={<Icon name="edit" />}
          data-testid={`settlement-edit-${row.id}`}
          onClick={() => setEditing(row)}
        >
          {t("common.edit")}
        </Button>
      ),
    },
  ];

  return (
    <section data-testid="settlement-section" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-section font-semibold text-ink">{t("doctors.settlement.title")}</h2>
          <p className="text-meta text-ink-muted">{t("doctors.settlement.about")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DocumentActions
            data-testid="settlement-print"
            label={t("doctors.settlement.print")}
            source={
              data && valid
                ? settlementSource(
                    doctorId,
                    { from, to },
                    doctorPhone,
                    can("doctor-settlements.sendSettlement"),
                  )
                : undefined
            }
          />
          <Button
            icon={<Icon name="money" />}
            data-testid="settlement-record-payout"
            aria-disabled={(data && !data.onPercentage) || undefined}
            onClick={() => data?.onPercentage && setPaying(true)}
          >
            {t("doctors.settlement.recordPayout")}
          </Button>
        </div>
      </div>

      {data && !data.onPercentage && (
        <p
          data-testid="settlement-on-salary"
          className="rounded-panel border border-line bg-inset px-3 py-2 text-meta text-ink"
        >
          {t("doctors.settlement.onSalary")}
        </p>
      )}

      {data && (
        <p data-testid="settlement-rules" className="text-meta text-ink-muted">
          {t(`doctors.settlement.basis.${data.basis}`)} ·{" "}
          {t(`doctors.settlement.bearer.${data.labCostBearer}`)}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex w-full flex-col gap-1 text-label text-ink-muted sm:w-auto">
          {t("doctors.settlement.period")}
          <DateRangePicker
            id="settlement-period"
            data-testid="settlement-period"
            className="w-full sm:w-64"
            label={t("doctors.settlement.period")}
            value={{ from, to }}
            onChange={(range) => setParam({ from: range.from, to: range.to || range.from })}
          />
        </label>

        <div ref={terms.formRef} className="flex flex-wrap items-end gap-2">
          <div onBlur={terms.leave("clinicSharePercent")}>
            <FormField
              label="doctors.visiting.clinicShare"
              htmlFor="settlement-default-percent"
              error={terms.errors["clinicSharePercent"]}
            >
              <QuantityInput
                id="settlement-default-percent"
                data-testid="settlement-default-percent"
                className="w-28"
                value={percent}
                onChange={(event) => setPercent(event.target.value)}
              />
            </FormField>
          </div>
          <FormField label="payroll.effectiveFrom" htmlFor="settlement-rate-month">
            <Select
              id="settlement-rate-month"
              data-testid="settlement-rate-month"
              className="w-44"
              value={effectiveMonth}
              onChange={(event) => setEffectiveMonth(event.target.value)}
              options={monthsFrom(thisMonth, 7).map((value) => ({
                value,
                label: formatMonth(value),
              }))}
            />
          </FormField>
          <Button
            variant="secondary"
            data-testid="settlement-save-percent"
            isLoading={setTerms.isPending}
            aria-disabled={!terms.isValid || undefined}
            onClick={() => void saveTerms()}
          >
            {t("common.save")}
          </Button>
        </div>
      </div>

      {data && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t("doctors.settlement.revenue")}
            value={<Money amount={data.totals.revenue} currency={currency} />}
            caption={t("doctors.settlement.deductionsTotal", {
              tax: moneyText(data.totals.tax, currency),
              overhead: moneyText(data.totals.overhead, currency),
              materials: moneyText(data.totals.materials, currency),
            })}
            icon="coins"
            tone="neutral"
          />
          <StatCard
            label={t("doctors.settlement.clinicShare")}
            value={<Money amount={data.totals.clinicShare} currency={currency} />}
            icon="building"
            tone="primary"
          />
          <StatCard
            label={t("doctors.settlement.doctorShare")}
            value={<Money amount={data.totals.payable} currency={currency} />}
            caption={t("doctors.settlement.stillToPay", {
              amount: moneyText(data.totals.outstanding, currency),
            })}
            icon="stethoscope"
            tone="success"
          />
          <StatCard
            data-testid="settlement-balance"
            label={t("doctors.settlement.balance")}
            value={<Money amount={data.balance} currency={currency} />}
            caption={t("doctors.settlement.balanceCaption")}
            icon="money"
            tone="warning"
          />
        </div>
      )}

      <SegmentedControl
        data-testid="settlement-status-filter"
        label={t("doctors.settlement.status")}
        value={status ?? ALL}
        onChange={(next) => setParam({ status: next === ALL ? null : next })}
        options={[ALL, ...SETTLEMENT_LINE_STATUSES].map((value) => ({
          value,
          label: t(value === ALL ? "common.all" : `doctors.settlement.statuses.${value}`),
        }))}
      />

      <Table
        data-testid="settlement-table"
        columns={columns}
        rows={data?.treatments ?? []}
        rowKey={(row) => `${row.id}:${row.doctorId}`}
        isLoading={settlement.isPending && valid}
        empty={
          <EmptyState
            icon="stethoscope"
            data-testid="settlement-empty"
            title="doctors.settlement.noTreatments"
          />
        }
      />

      <div className="flex flex-col gap-2">
        <h3 className="text-label font-semibold text-ink">{t("doctors.settlement.payouts")}</h3>
        {data && data.payouts.length === 0 && (
          <p className="text-meta text-ink-muted">{t("doctors.settlement.noPayouts")}</p>
        )}
        <ul className="flex flex-col gap-2">
          {data?.payouts.map((payout) => (
            <li
              key={payout.id}
              data-testid={`settlement-payout-${payout.id}`}
              className="flex flex-col gap-2 rounded-panel border border-line bg-surface px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-3">
                <Money amount={payout.amount} currency={currency} className="font-medium" />
                <span className="text-meta text-ink-muted">{formatDate(payout.createdAt)}</span>
                <Badge tone="neutral">
                  {payout.items.length === 0
                    ? t("doctors.settlement.advance")
                    : t("doctors.settlement.coversTreatments", { count: payout.items.length })}
                </Badge>
                {payout.note && <span className="truncate text-meta text-ink">{payout.note}</span>}
                {payout.reversedAt !== null && (
                  <Badge tone="danger">{t("doctors.settlement.reversed")}</Badge>
                )}
                <span className="ms-auto flex items-center gap-1">
                  {payout.items.length > 0 && (
                    <Button
                      size="sm"
                      variant="quiet"
                      data-testid="settlement-payout-toggle"
                      aria-expanded={opened === payout.id}
                      onClick={() => setOpened(opened === payout.id ? null : payout.id)}
                    >
                      {t(
                        opened === payout.id
                          ? "doctors.settlement.hidePatients"
                          : "doctors.settlement.showPatients",
                      )}
                    </Button>
                  )}
                  {payout.reversesId === null && (
                    <DocumentActions
                      data-testid="settlement-payout-print"
                      label={t("doctors.settlement.printPayout")}
                      source={payoutSource(doctorId, payout.id)}
                    />
                  )}
                  {payout.reversesId === null && payout.reversedAt === null && (
                    <RowMenu label={t("doctors.settlement.payoutMenu")}>
                      <MenuItem
                        icon="reset"
                        tone="danger"
                        data-testid="settlement-payout-reverse"
                        onSelect={() => setReversing(payout)}
                      >
                        {t("doctors.settlement.reverse")}
                      </MenuItem>
                    </RowMenu>
                  )}
                </span>
              </div>

              {opened === payout.id && (
                <ul data-testid="settlement-payout-items" className="flex flex-col gap-1">
                  {payout.items.map((item) => (
                    <li
                      key={item.treatmentId}
                      className="flex items-center justify-between gap-3 rounded-panel bg-inset px-3 py-1.5 text-meta"
                    >
                      <span className="flex flex-col">
                        <span className="text-ink">
                          {item.patientName}
                          {item.fileNumber && (
                            <>
                              {" · "}
                              <Ltr>#{item.fileNumber}</Ltr>
                            </>
                          )}
                        </span>
                        <span className="text-ink-muted">
                          {item.procedureName} · {formatDate(item.performedAt)}
                        </span>
                      </span>
                      <Money amount={item.amount} currency={currency} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>

      <SettlementTreatmentModal
        doctorId={doctorId}
        treatment={editing}
        defaultPercent={data?.clinicSharePercent ?? 0}
        onClose={() => setEditing(null)}
      />

      <DoctorPayoutModal
        open={paying}
        onOpenChange={setPaying}
        doctorId={doctorId}
        balance={data?.balance ?? "0.00"}
      />

      <ConfirmDialog
        data-testid="settlement-reverse-confirm"
        open={reversing !== null}
        onOpenChange={(open) => !open && setReversing(null)}
        title="doctors.settlement.reverseTitle"
        consequences={[
          t(
            reversing && reversing.items.length > 0
              ? "doctors.settlement.reverseReleases"
              : "doctors.settlement.reverseConsequence",
            { count: reversing?.items.length ?? 0 },
          ),
        ]}
        note={{ label: t("doctors.settlement.reverseReason") }}
        confirmLabel={t("doctors.settlement.reverse")}
        onConfirm={async ({ note }) => {
          if (!reversing) {
            return;
          }

          try {
            await reverse.mutateAsync({ payoutId: reversing.id, reason: note });
            toast.success("doctors.settlement.payoutReversed");
          } catch (error) {
            toast.error(...errorToast(error));
            throw error;
          }
        }}
      />
    </section>
  );
}
