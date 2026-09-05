import { USER_ROLE } from '@clinic/shared';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';

import { Badge, Button } from '@web/components/ui';
import { visibleNavItems } from '@web/app/navigation';
import { useSession } from '@web/features/auth/session';
import { cn } from '@web/lib/cn';

/**
 * Sidebar + header shell for every signed-in screen.
 *
 * The sidebar lists only what the role can reach. That is presentation: the
 * matching route guard and, above all, the API enforce the same rule.
 */
export function AppLayout(): JSX.Element {
  const { t } = useTranslation();
  const { user, logout } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = visibleNavItems(user?.role);

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {t('nav.menu')}
          </Button>
          <span className="text-sm font-semibold text-gray-900">{t('app.title')}</span>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">{user.name}</span>
              <Badge tone={user.role === USER_ROLE.ADMIN ? 'info' : 'neutral'}>
                {t(`roles.${user.role}`)}
              </Badge>
            </div>
          )}

          <Button variant="secondary" size="sm" onClick={() => void logout()}>
            {t('nav.logout')}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <nav
          aria-label={t('nav.menu')}
          className={cn(
            'border-b border-gray-200 bg-white p-3 md:w-56 md:border-b-0 md:border-e',
            mobileOpen ? 'block' : 'hidden md:block',
          )}
        >
          <ul className="flex flex-col gap-1">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'block rounded-md px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-brand-50 font-medium text-brand-700'
                        : 'text-gray-700 hover:bg-gray-100',
                    )
                  }
                >
                  {t(item.label)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
