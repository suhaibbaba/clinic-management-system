import type { JSX } from 'react';

import { TabPanel, Tabs, useTabParam, type TabDefinition } from '@web/components/ui';
import { LabOrdersPage } from '@web/features/labs/lab-orders-page';
import { LabsPage } from '@web/features/labs/labs-page';

const ORDERS = 'orders';
const DIRECTORY = 'directory';

type LabsTab = typeof ORDERS | typeof DIRECTORY;

const TABS: readonly TabDefinition<LabsTab>[] = [
  { id: ORDERS, label: 'labs.section.orders' },
  { id: DIRECTORY, label: 'labs.section.directory' },
];

/**
 * The labs module, as one screen.
 *
 * The work in flight and the labs doing it were two nav entries answering one
 * question — "where is that crown" — from two directions. The board comes
 * first because it is what anyone opens this for; the directory is where a
 * relationship is set up and its balance settled, which is a monthly job
 * rather than a daily one.
 */
export function LabsSection(): JSX.Element {
  const [active, setActive] = useTabParam<LabsTab>(
    'tab',
    TABS.map((tab) => tab.id),
    ORDERS,
  );

  return (
    <div className="flex flex-col gap-5">
      <Tabs tabs={TABS} value={active} onChange={setActive} label="labs.section.label" />

      <TabPanel id={active}>
        {active === ORDERS && <LabOrdersPage />}
        {active === DIRECTORY && <LabsPage />}
      </TabPanel>
    </div>
  );
}
