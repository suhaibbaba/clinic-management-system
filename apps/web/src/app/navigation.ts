import { USER_ROLE, USER_ROLES, type UserRole } from '@clinic/shared';

export interface NavItem {
  readonly to: string;
  /** i18n key. */
  readonly label: string;
  /** Roles that see the item. `admin` always does (ROLES.md). */
  readonly roles: readonly UserRole[];
}

/**
 * Sidebar entries, mapped straight onto the ROLES.md core matrix.
 *
 * Hiding an item is cosmetic — the API is the real boundary — but the same
 * table also drives the route guards, so a hidden page is not reachable by
 * typing its URL either.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/patients', label: 'nav.patients', roles: USER_ROLES },
  { to: '/doctors', label: 'nav.doctors', roles: USER_ROLES },
  { to: '/clinic', label: 'nav.clinic', roles: USER_ROLES },
  { to: '/users', label: 'nav.users', roles: [USER_ROLE.ADMIN] },
  { to: '/audit-log', label: 'nav.audit', roles: [USER_ROLE.ADMIN] },
  { to: '/profile', label: 'nav.profile', roles: USER_ROLES },
];

export function visibleNavItems(role: UserRole | undefined): readonly NavItem[] {
  if (!role) {
    return [];
  }

  return NAV_ITEMS.filter((item) => role === USER_ROLE.ADMIN || item.roles.includes(role));
}
