import type { JSX } from "react";
import { TabPanel, useTabParam, type TabDefinition } from "@clinic/ui";
import { SectionViews } from "@web/components/layout/section-views";
import { DoctorsPage } from "@web/pages/doctors/doctors-page";
import { UsersPage } from "@web/pages/users/users-page";
import { DOCTORS_VIEW, USERS_VIEW } from "@web/constants/users";

type UsersView = typeof USERS_VIEW | typeof DOCTORS_VIEW;

const VIEWS: readonly TabDefinition<UsersView>[] = [
  { id: USERS_VIEW, label: "nav.users" },
  { id: DOCTORS_VIEW, label: "nav.doctors" },
];

export function UsersSection(): JSX.Element {
  const [active, setActive] = useTabParam<UsersView>(
    "view",
    VIEWS.map((view) => view.id),
    USERS_VIEW,
    ["page", "perPage"],
  );

  return (
    <div data-testid="users-section" className="flex flex-col gap-5">
      <SectionViews
        data-testid="users-section-views"
        views={VIEWS}
        value={active}
        onChange={setActive}
        label="nav.users"
      />

      <TabPanel id={active} data-testid="users-section-panel">
        {active === USERS_VIEW && <UsersPage />}
        {active === DOCTORS_VIEW && <DoctorsPage />}
      </TabPanel>
    </div>
  );
}
