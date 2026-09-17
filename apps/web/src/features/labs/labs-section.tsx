import type { JSX } from "react";

import { TabPanel, Tabs, useTabParam, type TabDefinition } from "@clinic/ui";
import { LabOrdersPage } from "@web/features/labs/lab-orders-page";
import { LabsPage } from "@web/features/labs/labs-page";

const ORDERS = "orders";
const DIRECTORY = "directory";

type LabsTab = typeof ORDERS | typeof DIRECTORY;

const TABS: readonly TabDefinition<LabsTab>[] = [
  { id: ORDERS, label: "labs.section.orders" },
  { id: DIRECTORY, label: "labs.section.directory" },
];

export function LabsSection(): JSX.Element {
  const [active, setActive] = useTabParam<LabsTab>(
    "tab",
    TABS.map((tab) => tab.id),
    ORDERS,
    ["page"],
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
        {active === ORDERS && <LabOrdersPage />}
        {active === DIRECTORY && <LabsPage />}
      </TabPanel>
    </div>
  );
}
