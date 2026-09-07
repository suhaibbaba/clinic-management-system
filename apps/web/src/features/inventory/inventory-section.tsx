import type { JSX } from 'react';

import { TabPanel, Tabs, useTabParam, type TabDefinition } from '@web/components/ui';
import { InventoryPage } from '@web/features/inventory/inventory-page';
import { SuppliersPage } from '@web/features/inventory/suppliers-page';

const STOCK = 'stock';
const SUPPLIERS = 'suppliers';

type InventoryTab = typeof STOCK | typeof SUPPLIERS;

const TABS: readonly TabDefinition<InventoryTab>[] = [
  { id: STOCK, label: 'inventory.section.stock' },
  { id: SUPPLIERS, label: 'inventory.section.suppliers' },
];

/**
 * The store cupboard and the people it is filled from.
 *
 * A supplier only ever exists because of something on the shelf, so it was
 * never a section of its own — it is the other half of this one.
 */
export function InventorySection(): JSX.Element {
  const [active, setActive] = useTabParam<InventoryTab>(
    'tab',
    TABS.map((tab) => tab.id),
    STOCK,
  );

  return (
    <div className="flex flex-col gap-5">
      <Tabs tabs={TABS} value={active} onChange={setActive} label="inventory.section.label" />

      <TabPanel id={active}>
        {active === STOCK && <InventoryPage />}
        {active === SUPPLIERS && <SuppliersPage />}
      </TabPanel>
    </div>
  );
}
