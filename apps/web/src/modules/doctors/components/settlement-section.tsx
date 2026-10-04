import {
  settlementTermsSchema,
  subtractMoney,
  type StaffPayment,
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
  MenuItem,
  Money,
  QuantityInput,
  RowMenu,
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
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { errorToast } from "@web/shared/lib/api-error";
import { isIsoDate, todayIso } from "@web/shared/lib/dates";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { formatDate, moneyText } from "@web/shared/lib/format";
import { useClinic } from "@web/shared/queries/clinic";
import { DocumentActions } from "@web/shared/components/document-actions";
import { useSession } from "@web/shared/providers/session";
import { settlementSource } from "@web/modules/doctors/lib/documents";

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
  const from = params.get("from") ?? `${today.slice(0, 8)}01`;
  const to = params.get("to") ?? today;
  const valid = isIsoDate(from) && isIsoDate(to) && from <= to;

  const settlement = useSettlement(doctorId, { from, to }, valid);
  const setTerms = useSetSettlementTerms(doctorId);
  const reverse = useReversePayout(doctorId);

  const [percent, setPercent] = useState("");
  const [editing, setEditing] = useState<SettlementTreatment | null>(null);
  const [paying, setPaying] = useState(false);
  const [reversing, setReversing] = useState<StaffPayment | null>(null);

  const data = settlement.data;
  const terms = useFormErrors(
    schemaErrors(settlementTermsSchema, {
      clinicSharePercent: percent === "" ? undefined : Number(percent),
    }),
  );

  useEffect(() => {
    if (data) {
      setPercent(String(data.clinicSharePercent));
    }
  }, [data?.clinicSharePercent]);

  const setRange = (nextFrom: string, nextTo: string): void =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("from", nextFrom);
        next.set("to", nextTo);
        return next;
      },
      { replace: true },
    );

  const saveTerms = async (): Promise<void> => {
    if (!terms.check()) {
      return;
    }

    try {
      await setTerms.mutateAsync(Number(percent));
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
            {row.patientName} · {formatDate(row.performedAt)}
          </span>
        </span>
      ),
    },
    {
      key: "amount",
      header: "doctors.settlement.amount",
      align: "numeric",
      render: (row) => (
        <Money amount={subtractMoney(row.price, row.discount)} currency={currency} />
      ),
    },
    {
      key: "materials",
      header: "doctors.settlement.materials",
      align: "numeric",
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
        <span className="inline-flex items-center gap-1.5">
          <span dir="ltr">{row.clinicSharePercent}%</span>
          {row.clinicSharePercentSet && (
            <Badge tone="info">{t("doctors.settlement.adjusted")}</Badge>
          )}
        </span>
      ),
    },
    {
      key: "clinic",
      header: "doctors.settlement.clinicShare",
      align: "numeric",
      render: (row) => <Money amount={row.clinicShare} currency={currency} />,
    },
    {
      key: "doctor",
      header: "doctors.settlement.doctorShare",
      align: "numeric",
      render: (row) => <Money amount={row.doctorShare} currency={currency} />,
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
            onClick={() => setPaying(true)}
          >
            {t("doctors.settlement.recordPayout")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex w-full flex-col gap-1 text-label text-ink-muted sm:w-auto">
          {t("doctors.settlement.period")}
          <DateRangePicker
            id="settlement-period"
            data-testid="settlement-period"
            className="w-full sm:w-64"
            label={t("doctors.settlement.period")}
            value={{ from, to }}
            onChange={(range) => setRange(range.from, range.to || range.from)}
          />
        </label>

        <div ref={terms.formRef} className="flex items-end gap-2">
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
          <Button
            variant="secondary"
            data-testid="settlement-save-percent"
            isLoading={setTerms.isPending}
            aria-disabled={
              !terms.isValid || percent === String(data?.clinicSharePercent) || undefined
            }
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
            caption={t("doctors.settlement.materialsTotal", {
              amount: moneyText(data.totals.materials, currency),
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
            value={<Money amount={data.totals.doctorShare} currency={currency} />}
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

      <Table
        data-testid="settlement-table"
        columns={columns}
        rows={data?.treatments ?? []}
        rowKey={(row) => row.id}
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
              className="flex items-center gap-3 rounded-panel border border-line bg-surface px-3 py-2"
            >
              <Money amount={payout.amount} currency={currency} className="font-medium" />
              <span className="text-meta text-ink-muted">{formatDate(payout.createdAt)}</span>
              {payout.note && <span className="truncate text-meta text-ink">{payout.note}</span>}
              {payout.reversedAt !== null && (
                <Badge tone="danger">{t("doctors.settlement.reversed")}</Badge>
              )}
              {payout.reversesId === null && payout.reversedAt === null && (
                <span className="ms-auto">
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
                </span>
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
        consequences={[t("doctors.settlement.reverseConsequence")]}
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
