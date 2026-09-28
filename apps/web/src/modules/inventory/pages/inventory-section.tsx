import type { JSX } from "react";
import { TabPanel, Tabs, useTabParam } from "@clinic/ui";
import { InventoryPage } from "@web/modules/inventory/pages/inventory-page";
import { SuppliersPage } from "@web/modules/inventory/pages/suppliers-page";
import {
  INVENTORY_TABS,
  INVENTORY_TAB_STOCK,
  INVENTORY_TAB_SUPPLIERS,
  type InventoryTab,
} from "@web/modules/inventory/constants";

export function InventorySection(): JSX.Element {
  const [active, setActive] = useTabParam<InventoryTab>(
    "tab",
    INVENTORY_TABS.map((tab) => tab.id),
    INVENTORY_TAB_STOCK,
    ["page"],
  );

  return (
    <div data-testid="inventory-section" className="flex flex-col gap-5">
      <Tabs
        data-testid="inventory-section-tabs"
        tabs={INVENTORY_TABS}
        value={active}
        onChange={setActive}
        label="inventory.section.label"
      />

      <TabPanel id={active} data-testid="inventory-section-panel">
        {active === INVENTORY_TAB_STOCK && <InventoryPage />}
        {active === INVENTORY_TAB_SUPPLIERS && <SuppliersPage />}
      </TabPanel>
    </div>
  );
}
