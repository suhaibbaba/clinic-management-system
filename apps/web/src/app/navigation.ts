import { USER_ROLE, USER_ROLES, type UserRole } from '@clinic/shared';

import type { IconName } from '@web/components/ui/icon';

export interface NavItem {
  readonly to: string;
  readonly label: string;
  /** Roles that see the item. `admin` always does (ROLES.md). */
  readonly roles: readonly UserRole[];
  /** Decorative — the label beside it is what is announced. */
  readonly icon: IconName;
  // There is exactly one badge and it is fed by a real query: a decorative dot would train everyone
  // to ignore the real one.
  readonly badge?: 'pendingBookings';
}

export interface NavGroup {
  readonly label?: string | undefined;
  readonly items: readonly NavItem[];
}

// Hiding a row is cosmetic — the API is the boundary — but this same table drives the route guards,
// so a hidden section is not reachable by typing its URL either.
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    items: [{ to: '/dashboard', label: 'nav.dashboard', roles: USER_ROLES, icon: 'activity' }],
  },
  {
    label: 'nav.groups.care',
    items: [
      {
        to: '/patients',
        label: 'nav.patients',
        roles: [USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST],
        icon: 'users',
      },
      {
        to: '/appointments',
        label: 'nav.appointments',
        roles: [USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST],
        icon: 'calendar',
        // Online bookings are the only thing in this app that arrives while
        // nobody is looking, so the count sits on the section that answers it.
        badge: 'pendingBookings',
      },
    ],
  },
  {
    label: 'nav.groups.stores',
    items: [
      {
        to: '/labs',
        label: 'nav.labs',
        roles: [USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN],
        icon: 'clipboard',
      },
      {
        to: '/inventory',
        label: 'nav.inventory',
        roles: [USER_ROLE.TECHNICIAN],
        icon: 'package',
      },
    ],
  },
];

// A group like any other in the rail. This decides who is offered it, not who may read its routes.
export const NAV_SETTINGS: NavGroup = {
  label: 'nav.settings',
  items: [
    { to: '/clinic', label: 'nav.clinic', roles: [USER_ROLE.ADMIN], icon: 'building' },
    { to: '/doctors', label: 'nav.doctors', roles: [USER_ROLE.ADMIN], icon: 'stethoscope' },
    { to: '/users', label: 'nav.users', roles: [USER_ROLE.ADMIN], icon: 'shield' },
    { to: '/clinic/lists', label: 'nav.lists', roles: [USER_ROLE.ADMIN], icon: 'list' },
    { to: '/audit-log', label: 'nav.audit', roles: [USER_ROLE.ADMIN], icon: 'clipboard' },
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
export function activeNavItem(pathname: string): NavItem | undefined {
  return ALL_NAV_ITEMS.filter(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`),
  ).reduce<NavItem | undefined>(
    (best, item) => (best === undefined || item.to.length > best.to.length ? item : best),
    undefined,
  );
}

/** Screens outside the sidebar still need a name in the tab. */
const OFF_NAV_TITLES: Readonly<Record<string, string>> = {
  '/login': 'auth.loginTitle',
};

// The tab's fallback where a screen has no `PageHeader` to register one: a patient's file reads as
// its section rather than as a bare clinic name.
export function routeTitle(pathname: string): string | undefined {
  return OFF_NAV_TITLES[pathname] ?? activeNavItem(pathname)?.label;
}
