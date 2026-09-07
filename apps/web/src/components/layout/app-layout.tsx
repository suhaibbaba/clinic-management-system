import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { Logo } from '@web/components/brand/logo';
import { useClinic } from '@web/features/clinic/queries';
import { Breadcrumb } from '@web/components/layout/breadcrumb';
import { NavDrawer } from '@web/components/layout/nav-drawer';
import { UserMenu } from '@web/components/layout/user-menu';
import { Button, Icon } from '@web/components/ui';
import {
  NAV_SETTINGS,
  visibleNavItems,
  visibleSettingsItems,
  type NavItem,
} from '@web/app/navigation';
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
  // The clinic's own mark in the chrome; the bundled one until they upload it.
  const clinic = useClinic();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const items = visibleNavItems(user?.role);
  const settings = visibleSettingsItems(user?.role);

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
            <Logo size="sm" src={clinic.data?.logoUrl} />
            <span className="text-value font-semibold tracking-[-0.03em] text-ink">
              {t('app.title')}
            </span>
          </div>

          <NavList items={items} settings={settings} badges={badges} />

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
        <NavList items={items} settings={settings} badges={badges} />

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
  settings,
  badges,
}: {
  readonly items: readonly NavItem[];
  readonly settings: readonly NavItem[];
  readonly badges: Readonly<Record<'pendingBookings', number>>;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <nav aria-label={t('nav.menu')} className="min-w-0 flex-1">
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => (
          <NavRow key={item.to} item={item} badges={badges} />
        ))}
      </ul>

      {settings.length > 0 && <SettingsGroup items={settings} />}
    </nav>
  );
}

/** One row of the sidebar, in either half of it. */
function NavRow({
  item,
  badges,
  nested = false,
}: {
  readonly item: NavItem;
  readonly badges: Readonly<Record<'pendingBookings', number>>;
  readonly nested?: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const count = item.badge ? badges[item.badge] : 0;

  return (
    <li>
      <NavLink
        to={item.to}
        className={({ isActive }) =>
          cn(
            // 44px tall: a nav row is the most-tapped target in the app.
            'flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-3 py-2',
            'text-value transition-colors duration-150',
            // Indented under the group's own row, so the hierarchy is visible
            // without a second border or a background.
            nested && 'ms-3',
            isActive ? 'chrome-active font-semibold text-ink' : 'text-ink hover:bg-inset',
          )
        }
      >
        <Icon name={item.icon} className={cn(nested ? 'text-ink-subtle' : 'text-primary-600')} />
        <span className="truncate">{t(item.label)}</span>

        {count > 0 && (
          <span
            // The count is read out as part of the link, so the row announces
            // "appointments, 3 waiting" rather than a bare number floating
            // after it.
            aria-label={t('nav.waitingCount', { count })}
            className="ms-auto min-w-6 rounded-pill bg-danger-600 px-1.5 py-0.5 text-center text-label font-semibold text-ink-inverse tabular-nums"
          >
            {count}
          </span>
        )}
      </NavLink>
    </li>
  );
}

/**
 * The settings drawer at the foot of the sidebar.
 *
 * Collapsed by default and *not* remembered between sessions: these are the
 * screens somebody opens on the day they set the clinic up and then twice a
 * year, and a group that reopens itself every morning because it was opened
 * once in March defeats the point of collapsing it.
 *
 * It does open by itself when one of its own pages is showing — arriving on
 * the audit log from a link and finding the group shut would leave the sidebar
 * disagreeing with the page.
 */
function SettingsGroup({ items }: { readonly items: readonly NavItem[] }): JSX.Element {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const holdsCurrent = items.some(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`),
  );
  const [open, setOpen] = useState(holdsCurrent);

  // Navigating into the group opens it; navigating out leaves it as the user
  // left it, because closing a drawer somebody just opened is rude.
  useEffect(() => {
    if (holdsCurrent) {
      setOpen(true);
    }
  }, [holdsCurrent]);

  return (
    <div className="mt-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="nav-settings"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-control px-3 py-2',
          'text-value text-ink transition-colors duration-150 hover:bg-inset',
        )}
      >
        <Icon name={NAV_SETTINGS.icon} className="text-primary-600" />
        <span className="truncate">{t(NAV_SETTINGS.label)}</span>
        <Icon
          name="chevron-down"
          className={cn(
            'ms-auto text-ink-subtle transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>

      <ul id="nav-settings" hidden={!open} className="mt-0.5 flex flex-col gap-0.5">
        {items.map((item) => (
          <NavRow key={item.to} item={item} badges={{ pendingBookings: 0 }} nested />
        ))}
      </ul>
    </div>
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
