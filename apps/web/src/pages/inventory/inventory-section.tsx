import type { JSX } from "react";
import { TabPanel, Tabs, useTabParam, type TabDefinition } from "@clinic/ui";
import { InventoryPage } from "@web/pages/inventory/inventory-page";
import { SuppliersPage } from "@web/pages/inventory/suppliers-page";
import { INVENTORY_TAB_STOCK, INVENTORY_TAB_SUPPLIERS } from "@web/constants/inventory";

type InventoryTab = typeof INVENTORY_TAB_STOCK | typeof INVENTORY_TAB_SUPPLIERS;

const TABS: readonly TabDefinition<InventoryTab>[] = [
  { id: INVENTORY_TAB_STOCK, label: "inventory.section.stock" },
  { id: INVENTORY_TAB_SUPPLIERS, label: "inventory.section.suppliers" },
];

export function InventorySection(): JSX.Element {
  const [active, setActive] = useTabParam<InventoryTab>(
    "tab",
    TABS.map((tab) => tab.id),
    INVENTORY_TAB_STOCK,
    ["page"],
  );

  return (
    <div data-testid="inventory-section" className="flex flex-col gap-5">
      <Tabs
        data-testid="inventory-section-tabs"
        tabs={TABS}
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
