import { USER_ROLE, USER_ROLES, type UserRole } from '@clinic/shared';

import type { IconName } from '@web/components/ui/icon';

export interface NavItem {
  readonly to: string;
  /** i18n key. */
  readonly label: string;
  /** Roles that see the item. `admin` always does (ROLES.md). */
  readonly roles: readonly UserRole[];
  /** Decorative — the label beside it is what is announced. */
  readonly icon: IconName;
  /**
   * Names a count the sidebar draws beside the label.
   *
   * A badge is a promise that something is waiting, so there is exactly one
   * and it is fed by a real query — see `AppLayout`. A decorative dot would
   * train everyone to ignore the real one.
   */
  readonly badge?: 'pendingBookings';
}

export interface NavGroup {
  /**
   * i18n key for the group's caption, or absent for the rows at the very top
   * that belong to no section and are drawn without one.
   */
  readonly label?: string | undefined;
  readonly items: readonly NavItem[];
  /**
   * Whether the group is open the first time it is drawn.
   *
   * The sections people navigate with are open; settings is not — see
   * `NAV_SETTINGS`.
   */
  readonly openByDefault: boolean;
}

/**
 * The sidebar, as sections.
 *
 * The dashboard is loose at the top because it is where every role lands and
 * nothing groups with it. Under it the destinations are captioned by what they
 * are for — the people and their times, then the two stores of things — so a
 * list of six rows reads as three short lists rather than one long one.
 *
 * A caption never repeats the row beneath it. "المرضى" over a single row also
 * reading "المرضى" is a heading that carries no information, which is why the
 * captions name the pair rather than the section.
 *
 * Everything that is set up once and rarely touched — accounts, lists, the
 * audit trail — is folded into one collapsed group at the bottom, so the list
 * people navigate with is the list of places they actually go.
 *
 * The account itself is not here at all: it lives in the menu on the avatar,
 * which is where every application of this shape puts it, and where somebody
 * looks for "sign out" without being told.
 *
 * Hiding a row is cosmetic — the API is the real boundary — but the same
 * table drives the route guards, so a hidden section is not reachable by
 * typing its URL either.
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    // Everyone lands here, and every role has a dashboard row in ROLES.md;
    // what differs is which figures the response carries, not who may look.
    // Uncaptioned, because a heading over a single row that already says
    // "dashboard" is a heading nobody reads.
    openByDefault: true,
    items: [{ to: '/dashboard', label: 'nav.dashboard', roles: USER_ROLES, icon: 'activity' }],
  },
  {
    label: 'nav.groups.care',
    openByDefault: true,
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
    openByDefault: true,
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

/**
 * The settings drawer at the bottom of the sidebar.
 *
 * Collapsed by default: these are the screens somebody opens on the day they
 * set the clinic up and then twice a year, and five permanent rows of them
 * push the rows people use every day off a laptop screen.
 *
 * Clinic details and the doctors list are readable by every role (ROLES.md
 * core matrix) and their routes still are — this only decides who is *offered*
 * the group, and offering a settings drawer to a receptionist who may change
 * nothing in it is an invitation to a locked door.
 */
export const NAV_SETTINGS: NavGroup = {
  label: 'nav.settings',
  openByDefault: false,
  items: [
    { to: '/clinic', label: 'nav.clinic', roles: [USER_ROLE.ADMIN], icon: 'building' },
    { to: '/doctors', label: 'nav.doctors', roles: [USER_ROLE.ADMIN], icon: 'stethoscope' },
    { to: '/users', label: 'nav.users', roles: [USER_ROLE.ADMIN], icon: 'shield' },
    // The lists every dropdown in the app is drawn from.
    { to: '/clinic/lists', label: 'nav.lists', roles: [USER_ROLE.ADMIN], icon: 'list' },
    { to: '/audit-log', label: 'nav.audit', roles: [USER_ROLE.ADMIN], icon: 'clipboard' },
  ],
};

/** Every destination outside settings, in sidebar order. */
export const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

const visible = (items: readonly NavItem[], role: UserRole): readonly NavItem[] =>
  items.filter((item) => role === USER_ROLE.ADMIN || item.roles.includes(role));

/** The sections a role sees, with the groups they are captioned by. */
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

/**
 * Every nav destination, flattened — what the breadcrumb reads to name the
 * section a URL belongs to, regardless of which half of the sidebar it is in.
 */
export const ALL_NAV_ITEMS: readonly NavItem[] = [...NAV_ITEMS, ...NAV_SETTINGS.items];

/**
 * The one row a URL belongs to: the longest destination that prefixes it.
 *
 * `/clinic/lists` sits under `/clinic`, so a plain "does the path start with
 * this" test matches both — which lit two rows at once the moment the active
 * row became a solid pill, and named the wrong section in the breadcrumb.
 */
export function activeNavItem(pathname: string): NavItem | undefined {
  return ALL_NAV_ITEMS.filter(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`),
  ).reduce<NavItem | undefined>(
    (best, item) => (best === undefined || item.to.length > best.to.length ? item : best),
    undefined,
  );
}
