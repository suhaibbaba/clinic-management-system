import type { JSX } from "react";
import { TabPanel, useTabParam, type TabDefinition } from "@clinic/ui";
import { SectionViews } from "@web/components/layout/section-views";
import { DoctorsPage } from "@web/features/doctors/doctors-page";
import { UsersPage } from "@web/features/users/users-page";

export const USERS_VIEW = "users";
export const DOCTORS_VIEW = "doctors";

type UsersView = typeof USERS_VIEW | typeof DOCTORS_VIEW;

const VIEWS: readonly TabDefinition<UsersView>[] = [
  { id: USERS_VIEW, label: "nav.users" },
  { id: DOCTORS_VIEW, label: "nav.doctors" },
];

export function UsersSection(): JSX.Element {
  // `view`, not `tab`: the page it opens may already keep a tab of its own.
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
