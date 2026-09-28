import type { JSX } from "react";
import { TabPanel, Tabs, useTabParam, type TabDefinition } from "@clinic/ui";
import { LabOrdersDone } from "@web/pages/labs/lab-orders-done";
import { LabOrdersPage } from "@web/pages/labs/lab-orders-page";
import { LabsPage } from "@web/pages/labs/labs-page";
import { LABS_TAB_DIRECTORY, LABS_TAB_DONE, LABS_TAB_ORDERS } from "@web/constants/labs";

type LabsTab = typeof LABS_TAB_ORDERS | typeof LABS_TAB_DONE | typeof LABS_TAB_DIRECTORY;

const TABS: readonly TabDefinition<LabsTab>[] = [
  { id: LABS_TAB_ORDERS, label: "labs.section.orders" },
  { id: LABS_TAB_DONE, label: "labs.section.done" },
  { id: LABS_TAB_DIRECTORY, label: "labs.section.directory" },
];

export function LabsSection(): JSX.Element {
  const [active, setActive] = useTabParam<LabsTab>(
    "tab",
    TABS.map((tab) => tab.id),
    LABS_TAB_ORDERS,
    ["page", "stage", "overdue", "from", "to", "sort", "dir", "order"],
  );

  return (
    <div data-testid="labs-section" className="flex flex-col gap-5">
      <Tabs
        data-testid="labs-section-tabs"
        tabs={TABS}
        value={active}
        onChange={setActive}
        label="labs.section.label"
      />

      <TabPanel id={active} data-testid="labs-section-panel">
        {active === LABS_TAB_ORDERS && <LabOrdersPage />}
        {active === LABS_TAB_DONE && <LabOrdersDone />}
        {active === LABS_TAB_DIRECTORY && <LabsPage />}
      </TabPanel>
    </div>
  );
}
