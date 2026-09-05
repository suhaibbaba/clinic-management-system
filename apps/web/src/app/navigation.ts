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
}

/**
 * Sidebar entries, mapped straight onto the ROLES.md core matrix.
 *
 * Hiding an item is cosmetic — the API is the real boundary — but the same
 * table also drives the route guards, so a hidden page is not reachable by
 * typing its URL either.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/patients', label: 'nav.patients', roles: USER_ROLES, icon: 'users' },
  {
    to: '/billing/overdue',
    label: 'nav.overdue',
    roles: [USER_ROLE.ADMIN, USER_ROLE.RECEPTIONIST],
    icon: 'money',
  },
  { to: '/doctors', label: 'nav.doctors', roles: USER_ROLES, icon: 'stethoscope' },
  { to: '/clinic', label: 'nav.clinic', roles: USER_ROLES, icon: 'gear' },
  { to: '/users', label: 'nav.users', roles: [USER_ROLE.ADMIN], icon: 'shield' },
  { to: '/audit-log', label: 'nav.audit', roles: [USER_ROLE.ADMIN], icon: 'clipboard' },
  { to: '/profile', label: 'nav.profile', roles: USER_ROLES, icon: 'user' },
];

export function visibleNavItems(role: UserRole | undefined): readonly NavItem[] {
  if (!role) {
    return [];
  }

  return NAV_ITEMS.filter((item) => role === USER_ROLE.ADMIN || item.roles.includes(role));
}
