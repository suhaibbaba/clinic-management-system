import type { JSX } from "react";
import { TabPanel, Tabs, useTabParam, type TabDefinition } from "@clinic/ui";
import { InventoryPage } from "@web/features/inventory/inventory-page";
import { SuppliersPage } from "@web/features/inventory/suppliers-page";

const STOCK = "stock";
const SUPPLIERS = "suppliers";

type InventoryTab = typeof STOCK | typeof SUPPLIERS;

const TABS: readonly TabDefinition<InventoryTab>[] = [
  { id: STOCK, label: "inventory.section.stock" },
  { id: SUPPLIERS, label: "inventory.section.suppliers" },
];

/** A supplier only exists because of something on the shelf, so it was never a section of its own. */
export function InventorySection(): JSX.Element {
  const [active, setActive] = useTabParam<InventoryTab>(
    "tab",
    TABS.map((tab) => tab.id),
    STOCK,
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
        {active === STOCK && <InventoryPage />}
        {active === SUPPLIERS && <SuppliersPage />}
      </TabPanel>
    </div>
  );
}
