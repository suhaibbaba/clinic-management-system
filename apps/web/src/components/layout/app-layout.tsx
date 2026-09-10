import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation } from 'react-router-dom';

import { Logo } from '@web/components/brand/logo';
import { useClinic } from '@web/features/clinic/queries';
import { Breadcrumb } from '@web/components/layout/breadcrumb';
import { NavDrawer } from '@web/components/layout/nav-drawer';
import { UserMenu } from '@web/components/layout/user-menu';
import { Button, Icon } from '@web/components/ui';
import {
  activeNavItem,
  NAV_SETTINGS,
  visibleNavGroups,
  visibleSettingsItems,
  type NavGroup,
  type NavItem,
} from '@web/app/navigation';
import { useSession } from '@web/features/auth/session';
import { seesPendingBookings, usePendingBookingsCount } from '@web/features/booking/queries';
import { cn } from '@web/lib/cn';

export function AppLayout(): JSX.Element {
  const { t } = useTranslation();
  const { user, logout } = useSession();
  const clinic = useClinic();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const groups = visibleNavGroups(user?.role);
  const settings = visibleSettingsItems(user?.role);

  /** Asked for once here and handed to both copies of the nav list, rather than fetched twice. */
  const pendingBookings = usePendingBookingsCount(seesPendingBookings(user?.role));
  const badges = { pendingBookings } as const;

  // Navigating closes the drawer. Doing it here rather than in each row's
  // onClick also covers the back button and any link inside the page.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // The bar has no search field — each page owns one — so `/` looks for the first search input, and
  // never while the user is already typing.
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
          'chrome-sidebar z-30 hidden shrink-0 md:block md:w-[236px]',
          'md:sticky md:top-0 md:h-screen md:overflow-y-auto',
          'md:border-e md:border-line',
        )}
      >
        <div className="flex h-full flex-col">
          <div className="shrink-0 border-b border-line px-3 py-3">
            <Logo size="chrome" src={clinic.data?.logoUrl} alt={t('app.title')} />
          </div>

          <div className="flex-1 overflow-y-auto px-3 pt-3 pb-3">
            <NavList groups={groups} settings={settings} badges={badges} />
          </div>

          {user && (
            <div className="shrink-0 p-3 pt-2">
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
        brand={<Logo size="chrome" src={clinic.data?.logoUrl} />}
        closeLabel={t('common.close')}
      >
        <NavList groups={groups} settings={settings} badges={badges} />

        {user && (
          <div className="mt-5">
            <UserMenu user={user} onLogout={() => void logout()} />
          </div>
        )}
      </NavDrawer>

      <div className="flex min-w-0 flex-1 flex-col bg-surface">
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

function NavList({
  groups,
  settings,
  badges,
}: {
  readonly groups: readonly NavGroup[];
  readonly settings: readonly NavItem[];
  readonly badges: Readonly<Record<'pendingBookings', number>>;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <nav aria-label={t('nav.menu')} className="min-w-0 flex-1">
      {groups.map((group, index) =>
        group.label === undefined ? (
          <ul key="loose" className="flex flex-col gap-1">
            {group.items.map((item) => (
              <NavRow key={item.to} item={item} badges={badges} />
            ))}
          </ul>
        ) : (
          <NavSection
            key={group.label}
            id={`nav-group-${index}`}
            label={group.label}
            items={group.items}
            defaultOpen={group.openByDefault}
            badges={badges}
          />
        ),
      )}

      {settings.length > 0 && (
        <NavSection
          id="nav-settings"
          label={NAV_SETTINGS.label ?? ''}
          items={settings}
          defaultOpen={NAV_SETTINGS.openByDefault}
          badges={{ pendingBookings: 0 }}
          openWithRoute
        />
      )}
    </nav>
  );
}

function NavRow({
  item,
  badges,
}: {
  readonly item: NavItem;
  readonly badges: Readonly<Record<'pendingBookings', number>>;
}): JSX.Element {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const count = item.badge ? badges[item.badge] : 0;
  // A plain `Link`: `NavLink` calls every ancestor path active, so `/clinic/lists` lit the clinic
  // row too. `activeNavItem` picks the longest match, drawn and announced alike.
  const isActive = activeNavItem(pathname)?.to === item.to;

  return (
    <li>
      <Link
        to={item.to}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          // 44px on touch, the drawn 36 on a laptop: a rail of 44px rows pushes settings off the
          // screen.
          'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-control px-2.5 lg:min-h-9',
          'text-value transition-colors duration-150',
          isActive ? 'bg-primary-600 font-medium text-ink-inverse' : 'text-ink hover:bg-surface',
        )}
      >
        <Icon
          name={item.icon}
          className={cn('shrink-0', isActive ? 'text-ink-inverse' : 'text-ink-muted')}
        />
        <span className="truncate">{t(item.label)}</span>

        {count > 0 && (
          <span
            aria-label={t('nav.waitingCount', { count })}
            className={cn(
              // A circle, not a lozenge: `aspect-square` takes the height from the width the digits
              // need, so it stays round at any count.
              'ms-auto inline-flex aspect-square min-w-5 shrink-0 items-center justify-center',
              'rounded-pill px-1.5 text-meta font-semibold tabular-nums',
              isActive ? 'bg-ink-inverse text-primary-700' : 'bg-danger-600 text-ink-inverse',
            )}
          >
            {count}
          </span>
        )}
      </Link>
    </li>
  );
}

// Settings starts collapsed, and its state is deliberately not remembered — a group that reopens
// every morning because it was opened once in March is not collapsed.
function NavSection({
  id,
  label,
  items,
  defaultOpen,
  badges,
  openWithRoute = false,
}: {
  readonly id: string;
  readonly label: string;
  readonly items: readonly NavItem[];
  readonly defaultOpen: boolean;
  readonly badges: Readonly<Record<'pendingBookings', number>>;
  readonly openWithRoute?: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const holdsCurrent =
    openWithRoute &&
    items.some((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
  const [open, setOpen] = useState(defaultOpen || holdsCurrent);

  // Navigating into the group opens it; navigating out leaves it as the user
  // left it, because closing a drawer somebody just opened is rude.
  useEffect(() => {
    if (holdsCurrent) {
      setOpen(true);
    }
  }, [holdsCurrent]);

  return (
    <div className="mt-4 border-t border-line pt-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          // 44px on touch like every other row in the rail; drawn at 28 on a
          // laptop, where a caption that tall would read as a nav row itself.
          'flex min-h-11 w-full cursor-pointer items-center gap-1.5 rounded-control px-2.5 py-1.5 lg:min-h-7',
          'text-meta font-medium text-ink-subtle transition-colors duration-150',
          'hover:text-ink-muted',
          // Small caps and tracking in Latin only: tracking pulls Arabic letters out of their
          // joins, which is a spelling mistake rather than a style.
          'page-ltr:uppercase page-ltr:tracking-[0.06em]',
        )}
      >
        <span className="truncate">{t(label)}</span>
        <Icon
          name="chevron-down"
          className={cn(
            'ms-auto size-3.5 shrink-0 transition-transform duration-150',
            !open && '-rotate-90 rtl:rotate-90',
          )}
        />
      </button>

      <ul id={id} hidden={!open} className="mt-1 flex flex-col gap-1">
        {items.map((item) => (
          <NavRow key={item.to} item={item} badges={badges} />
        ))}
      </ul>
    </div>
  );
}

// No feed behind it yet, so it carries no count: a decorative red dot would train everyone to
// ignore the real one.
function NotificationBell(): JSX.Element {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      disabled
      aria-label={t('nav.notificationsEmpty')}
      title={t('nav.notificationsEmpty')}
      className={cn(
        // 44px on touch (WCAG 2.5.8), 36 on a laptop. `lg` rather than `md`: the front desk's
        // tablet is 768 wide and is a touch device.
        'inline-flex size-11 cursor-pointer items-center justify-center rounded-pill lg:size-9',
        'text-ink-subtle transition-colors duration-150 hover:bg-inset hover:text-ink',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
      )}
    >
      <Icon name="bell" />
    </button>
  );
}
