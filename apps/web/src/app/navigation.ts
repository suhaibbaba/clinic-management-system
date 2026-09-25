import { USER_ROLE, USER_ROLES, type UserRole } from "@clinic/shared";
import type { IconName } from "@clinic/ui/components/icon";

export interface NavItem {
  readonly to: string;
  readonly label: string;
  /** Roles that see the item. `admin` always does (ROLES.md). */
  readonly roles: readonly UserRole[];
  /** Decorative — the label beside it is what is announced. */
  readonly icon: IconName;
  readonly badge?: "pendingBookings";
  /** Addresses under other paths that still belong here, e.g. one doctor's page under users. */
  readonly also?: readonly string[];
}

export interface NavGroup {
  readonly label?: string | undefined;
  readonly items: readonly NavItem[];
}

/** Every role but the visiting doctor, whose requests the assistant's endpoints refuse. */
export const ASSISTANT_ROLES: readonly UserRole[] = USER_ROLES.filter(
  (role) => role !== USER_ROLE.VISITING_DOCTOR,
);

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    items: [
      { to: "/dashboard", label: "nav.dashboard", roles: USER_ROLES, icon: "activity" },
      // What it will answer is decided per tool by the clinic's own permissions, not by hiding the
      // page.
      { to: "/assistant", label: "nav.assistant", roles: ASSISTANT_ROLES, icon: "sparkles" },
    ],
  },
  {
    label: "nav.groups.care",
    items: [
      {
        to: "/patients",
        label: "nav.patients",
        roles: [USER_ROLE.DOCTOR, USER_ROLE.VISITING_DOCTOR, USER_ROLE.RECEPTIONIST],
        icon: "users",
      },
      {
        to: "/appointments",
        label: "nav.appointments",
        roles: [USER_ROLE.DOCTOR, USER_ROLE.VISITING_DOCTOR, USER_ROLE.RECEPTIONIST],
        icon: "calendar",
        badge: "pendingBookings",
      },
    ],
  },
  {
    label: "nav.groups.stores",
    items: [
      {
        to: "/labs",
        label: "nav.labs",
        roles: [USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN],
        icon: "clipboard",
      },
      {
        to: "/inventory",
        label: "nav.inventory",
        roles: [USER_ROLE.TECHNICIAN],
        icon: "package",
      },
    ],
  },
];

export const NAV_SETTINGS: NavGroup = {
  label: "nav.settings",
  items: [
    { to: "/clinic", label: "nav.clinic", roles: [USER_ROLE.ADMIN], icon: "building" },
    {
      to: "/users",
      label: "nav.users",
      roles: [USER_ROLE.ADMIN],
      icon: "users",
      also: ["/doctors"],
    },
    { to: "/clinic/lists", label: "nav.lists", roles: [USER_ROLE.ADMIN], icon: "list" },
    { to: "/settings", label: "nav.settingsPage", roles: [USER_ROLE.ADMIN], icon: "gear" },
  ],
};

export const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

const visible = (items: readonly NavItem[], role: UserRole): readonly NavItem[] =>
  items.filter((item) => role === USER_ROLE.ADMIN || item.roles.includes(role));

export function visibleNavGroups(role: UserRole | undefined): readonly NavGroup[] {
  if (!role) {
    return [];
  }

  return NAV_GROUPS.map((group) => ({ ...group, items: visible(group.items, role) })).filter(
    (group) => group.items.length > 0,
  );
}

export function visibleSettingsItems(role: UserRole | undefined): readonly NavItem[] {
  return role ? visible(NAV_SETTINGS.items, role) : [];
}

export const ALL_NAV_ITEMS: readonly NavItem[] = [...NAV_ITEMS, ...NAV_SETTINGS.items];

/** The same table the route guards are built from, so the bar never links somewhere it would bounce. */
export function canReachNavItem(to: string, role: UserRole | undefined): boolean {
  const item = ALL_NAV_ITEMS.find((candidate) => candidate.to === to);

  return role !== undefined && item !== undefined && visible([item], role).length === 1;
}

// The longest destination that prefixes the URL: `/clinic/lists` sits under `/clinic`, and a plain
// prefix test lit two rows at once.
/** Pages that fill the viewport and carry the top bar in a column of their own. */
const WORKSPACE_PREFIXES = ["/assistant"] as const;

export const isWorkspacePath = (pathname: string): boolean =>
  WORKSPACE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export function activeNavItem(pathname: string): NavItem | undefined {
  const under = (prefix: string): boolean =>
    pathname === prefix || pathname.startsWith(`${prefix}/`);
  const depth = (item: NavItem): number =>
    Math.max(...[item.to, ...(item.also ?? [])].filter(under).map((prefix) => prefix.length));

  return ALL_NAV_ITEMS.filter((item) => [item.to, ...(item.also ?? [])].some(under)).reduce<
    NavItem | undefined
  >((best, item) => (best === undefined || depth(item) > depth(best) ? item : best), undefined);
}

/** Screens outside the sidebar still need a name in the tab. */
const OFF_NAV_TITLES: Readonly<Record<string, string>> = {
  "/login": "auth.loginTitle",
};

// The tab's fallback where a screen has no `PageHeader` to register one: a patient's file reads as
// its section rather than as a bare clinic name.
export function routeTitle(pathname: string): string | undefined {
  return OFF_NAV_TITLES[pathname] ?? activeNavItem(pathname)?.label;
}
