import { USER_ROLE, USER_ROLES, type UserRole } from "@clinic/shared";
import type { IconName } from "@clinic/ui/components/icon";

export interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly roles: readonly UserRole[];
  readonly icon: IconName;
  readonly badge?: "pendingBookings";
  readonly also?: readonly string[];
}

export interface NavGroup {
  readonly label?: string | undefined;
  readonly items: readonly NavItem[];
}

export const ASSISTANT_ROLES: readonly UserRole[] = USER_ROLES.filter(
  (role) => role !== USER_ROLE.VISITING_DOCTOR,
);

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    items: [
      { to: "/dashboard", label: "nav.dashboard", roles: USER_ROLES, icon: "activity" },
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
    { to: "/payroll", label: "nav.payroll", roles: [USER_ROLE.ADMIN], icon: "money" },
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

export function canReachNavItem(to: string, role: UserRole | undefined): boolean {
  const item = ALL_NAV_ITEMS.find((candidate) => candidate.to === to);

  return role !== undefined && item !== undefined && visible([item], role).length === 1;
}

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

const OFF_NAV_TITLES: Readonly<Record<string, string>> = {
  "/login": "auth.loginTitle",
};

export function routeTitle(pathname: string): string | undefined {
  return OFF_NAV_TITLES[pathname] ?? activeNavItem(pathname)?.label;
}

export interface BackTarget {
  readonly to: string;
  readonly label: string;
}

const BACK_ROUTES: readonly (BackTarget & { readonly pattern: RegExp })[] = [
  { pattern: /^\/patients\/[^/]+$/, to: "/patients", label: "nav.patients" },
  { pattern: /^\/labs\/[^/]+$/, to: "/labs?tab=directory", label: "nav.labs" },
  {
    pattern: /^\/inventory\/(?:items\/[^/]+|shopping-list)$/,
    to: "/inventory",
    label: "nav.inventory",
  },
  { pattern: /^\/doctors\/[^/]+$/, to: "/users?view=doctors", label: "nav.users" },
  { pattern: /^\/profile$/, to: "/dashboard", label: "nav.dashboard" },
];

export function backTarget(pathname: string, role: UserRole | undefined): BackTarget | undefined {
  const route = BACK_ROUTES.find((candidate) => candidate.pattern.test(pathname));

  if (route === undefined || !canReachNavItem(route.to.split("?")[0] ?? route.to, role)) {
    return undefined;
  }

  return { to: route.to, label: route.label };
}
