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

/**
 * Appointments, as one screen.
 *
 * The online-booking queue used to be a nav entry of its own, which meant
 * reception answered a booking on one page and then went looking for it on
 * another. They are the same appointments at three points of the same
 * process, so they are three tabs: the calendar, the ones waiting on an
 * answer, and the ones that have had it.
 *
 * `?status=` rather than a nested route, because these are views of one thing
 * rather than three things — and because the dashboard card, the redirect from
 * the old `/appointments/pending` and anyone pasting an address all need to
 * arrive on a named tab.
 *
 * The two booking tabs exist only for the roles that answer bookings (ROLES.md
 * appointments row); for everyone else this is the calendar with no strip
 * above it, which is what it was before.
 */
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
