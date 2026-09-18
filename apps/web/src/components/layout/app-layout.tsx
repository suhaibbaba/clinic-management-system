import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Logo } from "@web/components/brand/logo";
import { NavDrawer } from "@web/components/layout/nav-drawer";
import { createPageActionSlot, PageActionSlotProvider } from "@clinic/ui/lib/page-action-slot";
import { useIsMobile } from "@clinic/ui/lib/use-media-query";
import { NotificationBell } from "@web/components/layout/notification-bell";
import { TopSearch } from "@web/components/layout/top-search";
import { UserMenu } from "@web/components/layout/user-menu";
import { Button, Icon } from "@clinic/ui";
import {
  activeNavItem,
  canReachNavItem,
  NAV_SETTINGS,
  visibleNavGroups,
  visibleSettingsItems,
  type NavGroup,
  type NavItem,
} from "@web/app/navigation";
import { useSession } from "@web/features/auth/session";
import { seesPendingBookings, usePendingBookingsCount } from "@web/features/booking/queries";
import { cn } from "@clinic/ui/lib/cn";
import { useClinicLogo } from "@web/lib/use-clinic-logo";

/** The one list the bar's search leads to; the bell and the slot are the rest of the reference's bar. */
const PATIENTS = "/patients";

export function AppLayout(): JSX.Element {
  const { t } = useTranslation();
  const { user, logout, can } = useSession();
  const { pathname } = useLocation();
  const logoUrl = useClinicLogo(user?.clinicId, user?.clinic.logoUrl);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionSlot] = useState(createPageActionSlot);
  const searchable = canReachNavItem(PATIENTS, user?.role);

  const groups = visibleNavGroups(user?.role);
  const settings = visibleSettingsItems(user?.role);

  /** Asked for once here and handed to both copies of the nav list, rather than fetched twice. */
  const pendingBookings = usePendingBookingsCount(seesPendingBookings(can));
  const badges = { pendingBookings } as const;

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // `/` focuses the first search input on the page — the bar's, wherever the bar has one — and
  // never while the user is already typing.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true;

      if (event.key === "/" && !isTyping && !event.metaKey && !event.ctrlKey) {
        const search = document.querySelector<HTMLInputElement>('input[type="search"]');

        if (search) {
          event.preventDefault();
          search.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const isMobile = useIsMobile();

  return (
    <PageActionSlotProvider value={isMobile ? null : actionSlot}>
      <div data-testid="app-layout" className="flex min-h-full flex-col md:flex-row">
        {/* Desktop: a permanent rail. */}
        <aside
          data-testid="app-rail"
          className={cn(
            "z-30 hidden shrink-0 bg-rail md:block md:w-[266px]",
            "md:sticky md:top-0 md:h-dvh",
            "md:border-e md:border-line",
          )}
        >
          <div className="flex h-full flex-col px-[18px] pt-5 pb-[18px]">
            {/* The logo on its own white plate, as the reference draws it — the rail's ground is a
              tint, so a mark sitting straight on it has no edge. */}
            <div
              data-testid="app-rail-brand"
              className="mb-[22px] shrink-0 rounded-brand border border-line bg-surface px-4 py-3.5"
            >
              <Logo size="chrome" src={logoUrl} name={user?.clinic.name} alt={t("app.title")} />
            </div>

            <div className="scroll-lane min-h-0 flex-1 overflow-y-auto">
              <NavList groups={groups} settings={settings} badges={badges} />
            </div>

            {user && (
              <div data-testid="app-rail-user" className="mt-auto shrink-0 pt-4">
                <UserMenu user={user} onLogout={() => void logout()} />
              </div>
            )}
          </div>
        </aside>

        {/* Mobile: the same list, in a drawer over the page. */}
        <NavDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          title={t("app.title")}
          brand={<Logo size="chrome" src={logoUrl} name={user?.clinic.name} />}
          closeLabel={t("common.close")}
        >
          <NavList groups={groups} settings={settings} badges={badges} />

          {user && (
            <div className="mt-5">
              <UserMenu user={user} onLogout={() => void logout()} />
            </div>
          )}
        </NavDrawer>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* A floating rounded bar inside the page's padding rather than a full-bleed strip, as the
            reference draws it. The sticky wrapper carries the page ground so the bar's corners do
            not frame scrolled content, and it reserves the bar's own height either way. */}
          <div className="sticky top-0 z-20 bg-canvas px-4 pt-4 pb-4 md:px-[34px] md:pt-[26px]">
            <header
              data-testid="app-topbar"
              className={cn(
                "flex min-h-[70px] flex-wrap items-center gap-3.5",
                "rounded-card border border-line bg-surface px-4 py-3 shadow-card",
              )}
            >
              <Button
                variant="secondary"
                size="sm"
                data-testid="app-nav-toggle"
                className="-ms-1 md:hidden"
                aria-expanded={drawerOpen}
                onClick={() => setDrawerOpen(true)}
                icon={<Icon name="menu" />}
                aria-label={t("nav.menu")}
              />

              {/* Search first, actions last, in logical order: the field opens where reading begins
                  — the right in Arabic, the left in English — and the bell and the page's own
                  button sit together at the far end. `ms-auto` pins them there on a page with no
                  search field, so the pair does not drift into the middle of an empty bar. */}
              {searchable && <TopSearch />}

              {/* The reference's `.top-actions`: its own 9px pair, then the bar's 14px to the field. */}
              <div data-testid="app-topbar-actions" className="ms-auto flex items-center gap-[9px]">
                <NotificationBell />
                {/* The page's own "new …" button, portalled in. `contents` so the slot's row is this
                  one and the button sits beside the bell rather than in a box of its own. */}
                <span className="contents" ref={(host) => void host?.appendChild(actionSlot)} />
              </div>
            </header>
          </div>

          <main data-testid="app-main" className="min-w-0 flex-1 px-4 pb-10 md:px-[34px] md:pb-12">
            <div className="mx-auto w-full max-w-[1180px]">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </PageActionSlotProvider>
  );
}

function NavList({
  groups,
  settings,
  badges,
}: {
  readonly groups: readonly NavGroup[];
  readonly settings: readonly NavItem[];
  readonly badges: Readonly<Record<"pendingBookings", number>>;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <nav data-testid="nav-menu" aria-label={t("nav.menu")} className="min-w-0 flex-1">
      {groups.map((group) =>
        group.label === undefined ? (
          <ul key="loose">
            {group.items.map((item) => (
              <NavRow key={item.to} item={item} badges={badges} />
            ))}
          </ul>
        ) : (
          <NavSection key={group.label} label={group.label} items={group.items} badges={badges} />
        ),
      )}

      {settings.length > 0 && (
        <NavSection
          label={NAV_SETTINGS.label ?? ""}
          items={settings}
          badges={{ pendingBookings: 0 }}
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
  readonly badges: Readonly<Record<"pendingBookings", number>>;
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
        data-testid={`nav-item-${item.to.replace(/^\//, "").replaceAll("/", "-")}`}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "mb-0.5 flex min-h-(--control-h) cursor-pointer items-center gap-[11px] rounded-nav px-3",
          "text-label font-medium transition-[background-color,color,box-shadow] duration-150",
          isActive
            ? "nav-active-wash text-ink-inverse shadow-nav-active"
            : "text-ink-muted hover:bg-primary-100 hover:text-primary-700",
        )}
      >
        <Icon name={item.icon} className="size-[19px] shrink-0" />
        <span className="truncate">{t(item.label)}</span>

        {count > 0 && (
          <span
            data-testid={`nav-badge-${item.to.replace(/^\//, "").replaceAll("/", "-")}`}
            aria-label={t("nav.waitingCount", { count })}
            className={cn(
              // A lozenge that stays at least as wide as it is tall, so one digit is a circle and
              // three do not spill — the reference's `min-width:20px;height:20px`.
              "pill-text inline-flex items-center ms-auto h-5 min-w-5 shrink-0 justify-center",
              "rounded-pill px-1.5 text-micro font-medium tabular-nums",
              isActive ? "bg-ink-inverse text-primary-700" : "bg-danger-600 text-ink-inverse",
            )}
          >
            {count}
          </span>
        )}
      </Link>
    </li>
  );
}

function NavSection({
  label,
  items,
  badges,
}: {
  readonly label: string;
  readonly items: readonly NavItem[];
  readonly badges: Readonly<Record<"pendingBookings", number>>;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <>
      <hr className="my-3.5 mx-1 border-0 border-t border-line" />

      <div
        data-testid={`nav-section-${label}`}
        className={cn(
          "px-3 pt-1 pb-2 text-micro font-medium tracking-[0.02em] text-ink-subtle",
          "page-ltr:uppercase",
        )}
      >
        {t(label)}
      </div>

      <ul>
        {items.map((item) => (
          <NavRow key={item.to} item={item} badges={badges} />
        ))}
      </ul>
    </>
  );
}
