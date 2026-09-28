import type { JSX } from "react";
import { TabPanel, Tabs, useTabParam, type TabDefinition } from "@clinic/ui";
import { AppointmentsPage } from "@web/modules/appointments/pages/appointments-page";
import { ConfirmedBookings } from "@web/modules/appointments/components/confirmed-bookings";
import { useSession } from "@web/shared/providers/session";
import { PendingBookingsPage } from "@web/modules/booking/pages/pending-bookings-page";
import { usePendingBookingsCount } from "@web/modules/booking/queries";
import { seesPendingBookings } from "@web/modules/booking/permissions";
import {
  APPOINTMENTS_VIEW_ALL,
  APPOINTMENTS_VIEW_CONFIRMED,
  APPOINTMENTS_VIEW_PENDING,
} from "@web/modules/appointments/constants";

type AppointmentsTab =
  | typeof APPOINTMENTS_VIEW_ALL
  | typeof APPOINTMENTS_VIEW_PENDING
  | typeof APPOINTMENTS_VIEW_CONFIRMED;

export function AppointmentsSection(): JSX.Element {
  const { can } = useSession();
  const frontDesk = seesPendingBookings(can);
  const pendingCount = usePendingBookingsCount(frontDesk);

  const tabs: readonly TabDefinition<AppointmentsTab>[] = frontDesk
    ? [
        { id: APPOINTMENTS_VIEW_ALL, label: "appointments.tabs.all" },
        { id: APPOINTMENTS_VIEW_PENDING, label: "appointments.tabs.pending", count: pendingCount },
        { id: APPOINTMENTS_VIEW_CONFIRMED, label: "appointments.tabs.confirmed" },
      ]
    : [{ id: APPOINTMENTS_VIEW_ALL, label: "appointments.tabs.all" }];

  const [active, setActive] = useTabParam<AppointmentsTab>(
    "status",
    tabs.map((tab) => tab.id),
    APPOINTMENTS_VIEW_ALL,
    ["page"],
  );

  return (
    <div data-testid="appointments-section" className="flex flex-col gap-5">
      {tabs.length > 1 && (
        <Tabs
          data-testid="appointments-section-tabs"
          tabs={tabs}
          value={active}
          onChange={setActive}
          label="appointments.tabs.label"
        />
      )}

      <TabPanel id={active} data-testid="appointments-section-panel">
        {active === APPOINTMENTS_VIEW_ALL && <AppointmentsPage />}
        {active === APPOINTMENTS_VIEW_PENDING && <PendingBookingsPage />}
        {active === APPOINTMENTS_VIEW_CONFIRMED && <ConfirmedBookings />}
      </TabPanel>
    </div>
  );
}
