import type { JSX } from "react";
import { PageHeader, TabPanel, useTabParam, type TabDefinition } from "@clinic/ui";
import { SkeletonForm } from "@clinic/ui/components/skeleton";
import { ExpensesTab } from "@web/modules/expenses/pages/expenses-tab";
import { MonthSwitcher } from "@web/modules/payroll/components/month-switcher";
import { ProfitStatement } from "@web/modules/payroll/components/profit-statement";
import { FINANCE_TABS } from "@web/modules/payroll/constants";
import { usePayrollMonth } from "@web/modules/payroll/hooks/use-payroll-month";
import { PayrollPage } from "@web/modules/payroll/pages/payroll-page";
import { usePayroll } from "@web/modules/payroll/queries";
import { SectionViews } from "@web/shared/components/layout/section-views";
import { FINANCE_TAB_CAPABILITIES } from "@web/shared/lib/navigation";
import { useSession } from "@web/shared/providers/session";

type Tab = (typeof FINANCE_TABS)[number];

const VIEWS: readonly TabDefinition<Tab>[] = [
  { id: "payroll", label: "nav.payroll" },
  { id: "profit", label: "finance.tabs.profit" },
  { id: "expenses", label: "finance.tabs.expenses" },
];

export function FinancePage(): JSX.Element {
  const { can } = useSession();
  const tabs = FINANCE_TABS.filter((id) => can(FINANCE_TAB_CAPABILITIES[id]));
  const [tab, setTab] = useTabParam<Tab>("tab", tabs, tabs[0] ?? "payroll", ["page"]);
  const monthState = usePayrollMonth();
  const payroll = usePayroll(
    monthState.month,
    tab !== "payroll" && can(FINANCE_TAB_CAPABILITIES.profit),
  );
  const closedAt = payroll.data?.closedAt;

  return (
    <div data-testid="finance-page" className="flex flex-col gap-5">
      {tabs.length > 1 && (
        <SectionViews
          data-testid="finance-tabs"
          views={VIEWS.filter((view) => tabs.includes(view.id))}
          value={tab}
          onChange={setTab}
          label="nav.finance"
        />
      )}

      <TabPanel id={tab} className="flex flex-col gap-5">
        {tab === "payroll" ? (
          <PayrollPage />
        ) : (
          <>
            <PageHeader
              data-testid="finance-header"
              title="finance.title"
              subtitle="finance.subtitle"
            />

            <MonthSwitcher state={monthState} closedAt={closedAt} />

            {tab === "profit" &&
              (payroll.data ? (
                <ProfitStatement payroll={payroll.data} />
              ) : (
                <SkeletonForm fields={6} />
              ))}
            {tab === "expenses" && (
              <ExpensesTab month={monthState.month} closed={Boolean(closedAt)} />
            )}
          </>
        )}
      </TabPanel>
    </div>
  );
}
