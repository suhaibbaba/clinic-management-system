import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router-dom";
import { Badge, Button, Icon, PersonName, TabPanel, Tabs, useTabParam } from "@clinic/ui";
import { SkeletonForm } from "@clinic/ui/components/skeleton";
import {
  AdjustmentModal,
  type AdjustmentTarget,
} from "@web/modules/payroll/components/adjustment-modal";
import { MonthSwitcher } from "@web/modules/payroll/components/month-switcher";
import { PayCalculator } from "@web/modules/payroll/components/pay-calculator";
import { PayEntriesList } from "@web/modules/payroll/components/pay-entries-list";
import { PaySettingsForm } from "@web/modules/payroll/components/pay-settings-form";
import { SalaryPaymentModal } from "@web/modules/payroll/components/salary-payment-modal";
import { SharePatients } from "@web/modules/payroll/components/share-patients";
import { SharePayoutModal } from "@web/modules/payroll/components/share-payout-modal";
import { TreatmentShareModal } from "@web/modules/payroll/components/treatment-share-modal";
import { PERSON_TABS } from "@web/modules/payroll/constants";
import { usePayrollMonth } from "@web/modules/payroll/hooks/use-payroll-month";
import { settlementSource } from "@web/modules/payroll/lib/documents";
import { payActions, salaryPayLabel, sharesTreatments } from "@web/modules/payroll/lib/plans";
import { usePayRules, usePayroll, useSettlement } from "@web/modules/payroll/queries";
import { DocumentActions } from "@web/shared/components/document-actions";
import { monthDays } from "@web/shared/lib/months";
import { canSeeSettlement } from "@web/shared/permissions/doctors";
import { useSession } from "@web/shared/providers/session";
import type { SettlementTreatment } from "@clinic/shared";

type Tab = (typeof PERSON_TABS)[number];

export function PersonPayPage(): JSX.Element {
  const { t } = useTranslation();
  const { userId = "" } = useParams<{ userId: string }>();
  const { can } = useSession();
  const monthState = usePayrollMonth();
  const { month, thisMonth } = monthState;
  const [tab, setTab] = useTabParam<Tab>("tab", PERSON_TABS, "statement");

  const payroll = usePayroll(month, true);
  const line = payroll.data?.lines.find((entry) => entry.userId === userId);
  const closed = Boolean(payroll.data?.closedAt);
  const days = monthDays(month);

  const seesShares = line !== undefined && line.doctorId !== null && canSeeSettlement(can);
  const withShare = seesShares && line !== undefined && sharesTreatments(line);
  const settlement = useSettlement(line?.doctorId ?? null, days, seesShares);
  const rules = usePayRules(withShare);

  const [adjusting, setAdjusting] = useState<AdjustmentTarget | null>(null);
  const [payingSalary, setPayingSalary] = useState(false);
  const [payingShare, setPayingShare] = useState(false);
  const [editing, setEditing] = useState<SettlementTreatment | null>(null);

  if (payroll.isPending) {
    return <SkeletonForm fields={5} />;
  }

  if (!line) {
    return <Navigate to="/payroll" replace />;
  }

  const actions = payActions(line, closed);
  const share = withShare ? settlement.data : undefined;
  const rates = rules.data
    ? {
        tax: rules.data.current.taxPercent,
        overhead: rules.data.current.overheadPercent,
        clinic: share?.clinicSharePercent ?? 0,
      }
    : undefined;

  return (
    <div data-testid="person-pay-page" className="flex flex-col gap-5">
      <header
        data-testid="person-pay-header"
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="min-w-0">
          <h1 className="truncate text-title font-medium text-primary-900">
            <PersonName name={line.name} data-testid="person-pay-name" />
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-value text-ink-muted">
            <span>{t(`roles.${line.role}`)}</span>
            <Badge data-testid="person-pay-type" tone={line.plan === "salary" ? "neutral" : "info"}>
              {t(`payroll.plan.kinds.${line.plan}`)}
            </Badge>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {withShare && line.doctorId && (
            <DocumentActions
              data-testid="person-pay-print"
              label={t("doctors.settlement.print")}
              source={
                share
                  ? settlementSource(
                      line.doctorId,
                      days,
                      null,
                      can("doctor-settlements.sendSettlement"),
                    )
                  : undefined
              }
            />
          )}
          {actions.adjust && (
            <>
              <Button
                variant="secondary"
                icon={<Icon name="award" />}
                data-testid="person-pay-bonus"
                onClick={() => setAdjusting({ line, kind: "extra" })}
              >
                {t("payroll.addBonus")}
              </Button>
              <Button
                variant="secondary"
                icon={<Icon name="trend-down" />}
                data-testid="person-pay-deduction"
                onClick={() => setAdjusting({ line, kind: "cut" })}
              >
                {t("payroll.addDeduction")}
              </Button>
            </>
          )}
          {actions.payShare && withShare && (
            <Button
              icon={<Icon name="money" />}
              data-testid="person-pay-share"
              onClick={() => setPayingShare(true)}
            >
              {t("payroll.payShare")}
            </Button>
          )}
          {actions.paySalary && (
            <Button
              icon={<Icon name="money" />}
              data-testid="person-pay-salary"
              onClick={() => setPayingSalary(true)}
            >
              {t(`payroll.${salaryPayLabel(line)}`)}
            </Button>
          )}
        </div>
      </header>

      <MonthSwitcher state={monthState} closedAt={payroll.data?.closedAt} />

      <Tabs
        data-testid="person-pay-tabs"
        label="payroll.person"
        tabs={PERSON_TABS.map((id) => ({ id, label: `payroll.tabs.${id}` }))}
        value={tab}
        onChange={setTab}
      />

      <TabPanel id={tab}>
        {tab === "statement" && (
          <div className="flex flex-col gap-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,var(--form-max))_minmax(0,1fr)]">
              <PayCalculator line={line} totals={share?.totals} rates={rates} />
              <PayEntriesList line={line} payouts={share?.payouts ?? []} closed={closed} />
            </div>
            {withShare && (
              <SharePatients
                treatments={share?.treatments ?? []}
                isLoading={settlement.isPending}
                closed={closed}
                onEdit={setEditing}
              />
            )}
          </div>
        )}
        {tab === "settings" && (
          <PaySettingsForm
            line={line}
            thisMonth={thisMonth}
            clinicPercent={settlement.data?.clinicSharePercent}
          />
        )}
      </TabPanel>

      <AdjustmentModal target={adjusting} month={month} onClose={() => setAdjusting(null)} />
      <SalaryPaymentModal
        line={payingSalary ? line : null}
        month={month}
        onClose={() => setPayingSalary(false)}
      />
      {line.doctorId && (
        <>
          <SharePayoutModal
            open={payingShare}
            onOpenChange={setPayingShare}
            doctorId={line.doctorId}
            balance={share?.balance ?? "0.00"}
          />
          <TreatmentShareModal
            doctorId={line.doctorId}
            treatment={editing}
            defaultPercent={share?.clinicSharePercent ?? 0}
            onClose={() => setEditing(null)}
          />
        </>
      )}
    </div>
  );
}
