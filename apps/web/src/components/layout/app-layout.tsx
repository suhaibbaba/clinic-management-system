import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { Logo } from '@web/components/brand/logo';
import { Breadcrumb } from '@web/components/layout/breadcrumb';
import { NavDrawer } from '@web/components/layout/nav-drawer';
import { UserMenu } from '@web/components/layout/user-menu';
import { Button, Icon } from '@web/components/ui';
import { visibleNavItems } from '@web/app/navigation';
import { useSession } from '@web/features/auth/session';
import { seesPendingBookings, usePendingBookingsCount } from '@web/features/booking/queries';
import { cn } from '@web/lib/cn';

/**
 * The signed-in shell: a translucent sidebar, a frosted top bar, and the page
 * on the grey ground beside them.
 *
 * The sidebar is a flat list — no chips, no card per row. An active item is a
 * faint grey fill and a heavier weight, which answers "where am I" without
 * spending the page's one accent colour on navigation. The icons take the
 * blue, because a row is a link.
 *
 * The sidebar lists only what the role can reach. That is presentation: the
 * matching route guard and, above all, the API enforce the same rule.
 */
export function AppLayout(): JSX.Element {
  const { t } = useTranslation();
  const { user, logout } = useSession();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const items = visibleNavItems(user?.role);

  /*
   * The one number in the chrome.
   *
   * Online bookings are the only thing in the app that arrives while nobody is
   * looking — everything else happens because somebody at the desk did it — so
   * it is the only thing that earns a badge. Asked for once here and handed to
   * both copies of the nav list, rather than fetched twice.
   */
  const pendingBookings = usePendingBookingsCount(seesPendingBookings(user?.role));
  const badges = { pendingBookings } as const;

  // Navigating closes the drawer. Doing it here rather than in each row's
  // onClick also covers the back button and any link inside the page.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  /*
   * `/` focuses the page's own search.
   *
   * The top bar has no search field in this design — each page owns one — so
   * the shortcut looks for the first search input on the page rather than
   * holding a ref to one. Never while the user is already typing somewhere,
   * which would swallow the slash out of an address or a note.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true;

      if (event.key === '/' && !isTyping && !event.metaKey && !event.ctrlKey) {
        const search = document.querySelector<HTMLInputElement>('input[type="search"]');

        if (search) {
          event.preventDefault();
          search.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      {/* Desktop: a permanent rail. */}
      <aside
        className={cn(
          'chrome-sidebar z-30 hidden shrink-0 md:block md:w-[250px]',
          'md:sticky md:top-0 md:h-screen md:overflow-y-auto',
          'md:border-e md:border-line',
        )}
      >
        <div className="flex h-full flex-col px-3 py-4">
          <div className="mb-6 flex items-center gap-2.5 px-3">
            <Logo size="sm" />
            <span className="text-value font-semibold tracking-[-0.03em] text-ink">
              {t('app.title')}
            </span>
          </div>

          <NavList items={items} badges={badges} />

          {user && (
            <div className="mt-6 border-t border-line pt-3">
              <UserMenu user={user} onLogout={() => void logout()} />
            </div>
          )}
        </div>
      </aside>

      {/* Mobile: the same list, in a drawer over the page. */}
      <NavDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={t('app.title')}
        closeLabel={t('common.close')}
      >
        <NavList items={items} badges={badges} />

        {user && (
          <div className="mt-4 border-t border-line pt-3">
            <UserMenu user={user} onLogout={() => void logout()} />
          </div>
        )}
      </NavDrawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="chrome-bar sticky top-0 z-20 border-b border-line">
          <div className="flex h-14 items-center gap-3 px-4 md:px-8">
            <Button
              variant="ghost"
              size="sm"
              className="-ms-2 md:hidden"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
              icon={<Icon name="menu" />}
              aria-label={t('nav.menu')}
            />

            <Breadcrumb />

            <div className="ms-auto flex items-center gap-1">
              <NotificationBell />
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-[1180px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

/** The nav rows, shared by the desktop rail and the mobile drawer. */
function NavList({
  items,
  badges,
}: {
  readonly items: ReturnType<typeof visibleNavItems>;
  readonly badges: Readonly<Record<'pendingBookings', number>>;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <nav aria-label={t('nav.menu')} className="min-w-0 flex-1">
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                cn(
                  // 44px tall: a nav row is the most-tapped target in the app.
                  'flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-3 py-2',
                  'text-value transition-colors duration-150',
                  isActive ? 'chrome-active font-semibold text-ink' : 'text-ink hover:bg-inset',
                )
              }
            >
              <Icon name={item.icon} className="text-primary-600" />
              <span className="truncate">{t(item.label)}</span>

              {item.badge && badges[item.badge] > 0 && (
                <span
                  // The count is read out as part of the link, so the row
                  // announces "pending bookings, 3" rather than a bare number
                  // floating after it.
                  aria-label={t('nav.waitingCount', { count: badges[item.badge] })}
                  className="ms-auto min-w-6 rounded-pill bg-primary-600 px-1.5 py-0.5 text-center text-label font-semibold text-ink-inverse tabular-nums"
                >
                  {badges[item.badge]}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * The bell.
 *
 * No feed behind it yet — notifications are a phase-2 module — so it carries
 * no count and says so, rather than a decorative red dot that would train
 * everyone to ignore the real one when it arrives.
 */
function NotificationBell(): JSX.Element {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      disabled
      aria-label={t('nav.notificationsEmpty')}
      title={t('nav.notificationsEmpty')}
      className={cn(
        'inline-flex size-9 cursor-pointer items-center justify-center rounded-pill',
        'text-ink-subtle transition-colors duration-150 hover:bg-inset hover:text-ink',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
      )}
    >
      <Icon name="bell" />
    </button>
  );
}
