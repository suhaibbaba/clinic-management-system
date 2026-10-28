import type { JSX } from "react";
import { TabPanel, Tabs, useTabParam } from "@clinic/ui";
import { InventoryPage } from "@web/modules/inventory/pages/inventory-page";
import { SuppliersPage } from "@web/modules/inventory/pages/suppliers-page";
import { RequestsPage } from "@web/modules/inventory/pages/requests-page";
import { useSession } from "@web/shared/providers/session";
import {
  canReviewPurchases,
  canSeeStockReports,
  seesPurchaseRequests,
} from "@web/shared/permissions/inventory";
import { StockReportsPage } from "@web/modules/inventory/pages/stock-reports-page";
import { PurchaseReviewPage } from "@web/modules/inventory/pages/purchase-review-page";
import {
  INVENTORY_TABS,
  INVENTORY_TAB_REPORTS,
  INVENTORY_TAB_REQUESTS,
  INVENTORY_TAB_REVIEW,
  INVENTORY_TAB_STOCK,
  INVENTORY_TAB_SUPPLIERS,
  type InventoryTab,
} from "@web/modules/inventory/constants";

export function InventorySection(): JSX.Element {
  const { can } = useSession();
  const tabs = INVENTORY_TABS.filter(
    (tab) =>
      (tab.id !== INVENTORY_TAB_REQUESTS || seesPurchaseRequests(can)) &&
      (tab.id !== INVENTORY_TAB_REVIEW || canReviewPurchases(can)) &&
      (tab.id !== INVENTORY_TAB_REPORTS || canSeeStockReports(can)),
  );
  const [active, setActive] = useTabParam<InventoryTab>(
    "tab",
    tabs.map((tab) => tab.id),
    INVENTORY_TAB_STOCK,
    ["page"],
  );

  return (
    <div data-testid="inventory-section" className="flex flex-col gap-5">
      <Tabs
        data-testid="inventory-section-tabs"
        tabs={tabs}
        value={active}
        onChange={setActive}
        label="inventory.section.label"
      />

      <TabPanel id={active} data-testid="inventory-section-panel">
        {active === INVENTORY_TAB_STOCK && <InventoryPage />}
        {active === INVENTORY_TAB_REQUESTS && <RequestsPage />}
        {active === INVENTORY_TAB_SUPPLIERS && <SuppliersPage />}
        {active === INVENTORY_TAB_REPORTS && <StockReportsPage />}
        {active === INVENTORY_TAB_REVIEW && <PurchaseReviewPage />}
      </TabPanel>
    </div>
  );
}
