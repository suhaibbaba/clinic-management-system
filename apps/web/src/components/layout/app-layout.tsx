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

/**
 * The signed-in shell: a white sidebar, a white bar over the page, and the
 * content on the tinted ground beside them.
 *
 * The sidebar is captioned sections rather than one flat list, and the active
 * row is a solid blue pill — the only place navigation spends the page's
 * accent colour, and worth it: "where am I" is the question a sidebar exists
 * to answer, and a faint grey fill answered it quietly enough to be missed.
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

  const groups = visibleNavGroups(user?.role);
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
          'chrome-sidebar z-30 hidden shrink-0 md:block md:w-[236px]',
          'md:sticky md:top-0 md:h-screen md:overflow-y-auto',
          'md:border-e md:border-line',
        )}
      >
        <div className="flex h-full flex-col">
          {/*
            The mark, alone, in a band the height of the page's bar so the two
            line up — and with no rule under it. The rail is a tint against a
            white page, and a tinted surface does not need a hairline to say
            where its header stops.

            No wordmark beside it: a clinic's own logo already carries its
            name, and the app's name set in 16px next to it made two names for
            one product at the top of every screen. It is the mark's accessible
            name instead, which is the one place the app still has to say what
            it is.
          */}
          <div className="flex h-14 shrink-0 items-center px-4">
            <Logo size="sm" src={clinic.data?.logoUrl} alt={t('app.title')} />
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-3">
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
        brand={<Logo size="sm" src={clinic.data?.logoUrl} />}
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

/** The nav rows, shared by the desktop rail and the mobile drawer. */
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
          <ul key="loose" className="flex flex-col gap-0.5">
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

/** One row of the sidebar, in either half of it. */
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
  /*
   * A plain `Link` with the state worked out here rather than `NavLink`.
   *
   * `NavLink` calls every ancestor path active, so `/clinic/lists` lit both
   * the lists row and the clinic row above it — two answers to "where am I"
   * once the active row is a solid pill, and two `aria-current="page"` rows
   * for a screen reader. `activeNavItem` picks the longest match, and doing
   * it here keeps what is drawn and what is announced the same rule.
   */
  const isActive = activeNavItem(pathname)?.to === item.to;

  return (
    <li>
      <Link
        to={item.to}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          // 44px on touch, the drawn 36 on a laptop: a nav row is the
          // most-tapped target in the app and the least-tapped one on a
          // desk, and a rail of 44px rows pushes settings off the screen.
          'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-control px-2.5 lg:min-h-9',
          'text-value transition-colors duration-150',
          isActive ? 'bg-primary-600 font-medium text-ink-inverse' : 'text-ink hover:bg-surface',
        )}
      >
        {/*
          A neutral glyph outside the active pill, white inside it.

          The icons used to take the blue, on the reasoning that a row is a
          link. In a rail where one row is a solid blue pill that reasoning
          inverts: eight blue glyphs beside it are eight things competing with
          the one that answers "where am I".
        */}
        <Icon
          name={item.icon}
          className={cn('shrink-0', isActive ? 'text-ink-inverse' : 'text-ink-muted')}
        />
        <span className="truncate">{t(item.label)}</span>

        {count > 0 && (
          <span
            // The count is read out as part of the link, so the row announces
            // "appointments, 3 waiting" rather than a bare number floating
            // after it.
            aria-label={t('nav.waitingCount', { count })}
            className={cn(
              'ms-auto min-w-5 rounded-pill px-1.5 py-0.5 text-center text-meta font-semibold tabular-nums',
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

/**
 * A captioned section of the sidebar.
 *
 * The caption is the control: a 12px muted line with a chevron, which is
 * enough of a target to fold the section away and quiet enough that a rail of
 * three of them still reads as one list rather than as three panels.
 *
 * Sections people navigate with open by default. Settings does not — those are
 * the screens somebody opens on the day they set the clinic up and then twice
 * a year, and five permanent rows of them push the rows people use every day
 * off a laptop screen. Its state is deliberately *not* remembered between
 * sessions: a group that reopens itself every morning because it was opened
 * once in March defeats the point of collapsing it.
 *
 * `openWithRoute` is the one exception, and it belongs to settings: arriving
 * on the audit log from a link and finding the group shut would leave the
 * sidebar disagreeing with the page.
 */
function NavSection({
  id,
  label,
  items,
  defaultOpen,
  badges,
  openWithRoute = false,
}: {
  readonly id: string;
  /** i18n key. */
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
    <div className="mt-5 first:mt-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          // 44px on touch like every other row in the rail; drawn at 28 on a
          // laptop, where a caption that tall would read as a nav row itself.
          'flex min-h-11 w-full cursor-pointer items-center gap-1.5 rounded-control px-2.5 py-1.5 lg:min-h-7',
          'text-meta font-semibold text-ink-subtle transition-colors duration-150',
          'hover:text-ink-muted',
          // Small caps, spaced out — in Latin only. Tracking pulls Arabic
          // letters out of their joins, which is not a style but a spelling
          // mistake, and `uppercase` has nothing to do in it either way.
          'page-ltr:uppercase page-ltr:tracking-[0.08em]',
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

      <ul id={id} hidden={!open} className="mt-1 flex flex-col gap-0.5">
        {items.map((item) => (
          <NavRow key={item.to} item={item} badges={badges} />
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
        // 44px on touch (WCAG 2.5.8), back to 36 on a laptop. `lg` rather
        // than `md`: the tablet the front desk uses is 768 wide and is a
        // touch device, whatever the layout does at that width.
        'inline-flex size-11 cursor-pointer items-center justify-center rounded-pill lg:size-9',
        'text-ink-subtle transition-colors duration-150 hover:bg-inset hover:text-ink',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
      )}
    >
      <Icon name="bell" />
    </button>
  );
}
