import type { JSX } from "react";
import { PageHeader, TabPanel, Tabs, useTabParam } from "@clinic/ui";
import { SkeletonForm } from "@clinic/ui/components/skeleton";
import { ExpensesTab } from "@web/modules/expenses/pages/expenses-tab";
import { MonthSwitcher } from "@web/modules/payroll/components/month-switcher";
import { ProfitStatement } from "@web/modules/payroll/components/profit-statement";
import { FINANCE_TABS } from "@web/modules/payroll/constants";
import { usePayrollMonth } from "@web/modules/payroll/hooks/use-payroll-month";
import { usePayroll } from "@web/modules/payroll/queries";
import { FINANCE_TAB_CAPABILITIES } from "@web/shared/lib/navigation";
import { useSession } from "@web/shared/providers/session";

type Tab = (typeof FINANCE_TABS)[number];

export function FinancePage(): JSX.Element {
  const { can } = useSession();
  const tabs = FINANCE_TABS.filter((id) => can(FINANCE_TAB_CAPABILITIES[id]));
  const [tab, setTab] = useTabParam<Tab>("tab", tabs, tabs[0] ?? "profit", ["page"]);
  const monthState = usePayrollMonth();
  const payroll = usePayroll(monthState.month, can(FINANCE_TAB_CAPABILITIES.profit));
  const closedAt = payroll.data?.closedAt;

  return (
    <div data-testid="finance-page" className="flex flex-col gap-5">
      <PageHeader data-testid="finance-header" title="finance.title" subtitle="finance.subtitle" />

      <MonthSwitcher state={monthState} closedAt={closedAt} />

      {tabs.length > 1 && (
        <Tabs
          data-testid="finance-tabs"
          label="finance.title"
          tabs={tabs.map((id) => ({ id, label: `finance.tabs.${id}` }))}
          value={tab}
          onChange={setTab}
        />
      )}

      <TabPanel id={tab}>
        {tab === "profit" &&
          (payroll.data ? <ProfitStatement payroll={payroll.data} /> : <SkeletonForm fields={6} />)}
        {tab === "expenses" && <ExpensesTab month={monthState.month} closed={Boolean(closedAt)} />}
      </TabPanel>
    </div>
  );
}
