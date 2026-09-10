import type { JSX } from 'react';

import { TabPanel, Tabs, useTabParam, type TabDefinition } from '@web/components/ui';
import { AppointmentsPage } from '@web/features/appointments/appointments-page';
import { ConfirmedBookings } from '@web/features/appointments/confirmed-bookings';
import { useSession } from '@web/features/auth/session';
import { PendingBookingsPage } from '@web/features/booking/pending-bookings-page';
import { seesPendingBookings, usePendingBookingsCount } from '@web/features/booking/queries';

const ALL = 'all';
const PENDING = 'pending';
const CONFIRMED = 'confirmed';

type AppointmentsTab = typeof ALL | typeof PENDING | typeof CONFIRMED;

// Three tabs rather than three pages: the same appointments at three points of one process.
// `?status=` so a dashboard card, an old redirect or a pasted address lands on a named tab.
export function AppointmentsSection(): JSX.Element {
  const { user } = useSession();
  const frontDesk = seesPendingBookings(user?.role);
  const pendingCount = usePendingBookingsCount(frontDesk);

  const tabs: readonly TabDefinition<AppointmentsTab>[] = frontDesk
    ? [
        { id: ALL, label: 'appointments.tabs.all' },
        { id: PENDING, label: 'appointments.tabs.pending', count: pendingCount },
        { id: CONFIRMED, label: 'appointments.tabs.confirmed' },
      ]
    : [{ id: ALL, label: 'appointments.tabs.all' }];

  const [active, setActive] = useTabParam<AppointmentsTab>(
    'status',
    tabs.map((tab) => tab.id),
    ALL,
  );

  return (
    <div className="flex flex-col gap-5">
      {tabs.length > 1 && (
        <Tabs tabs={tabs} value={active} onChange={setActive} label="appointments.tabs.label" />
      )}

      <TabPanel id={active}>
        {active === ALL && <AppointmentsPage />}
        {active === PENDING && <PendingBookingsPage />}
        {active === CONFIRMED && <ConfirmedBookings />}
      </TabPanel>
    </div>
  );
}
