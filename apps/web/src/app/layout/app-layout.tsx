import { useEffect, useRef, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { Logo } from "@web/shared/components/brand/logo";
import { BackLink } from "@web/app/layout/back-link";
import { NavDrawer } from "@web/app/layout/nav-drawer";
import { createPageActionSlot, PageActionSlotProvider } from "@clinic/ui/lib/page-action-slot";
import { useIsCompactLayout, useIsMobile } from "@clinic/ui/lib/use-media-query";
import { PageErrorBoundary } from "@web/shared/components/page-error-boundary";
import { PullToRefresh } from "@web/shared/components/pwa/pull-to-refresh";
import { NotificationBell } from "@web/app/layout/notification-bell";
import { TopSearch } from "@web/app/layout/top-search";
import { UserMenu } from "@web/app/layout/user-menu";
import { WorkspaceTopBarProvider } from "@web/shared/providers/workspace-top-bar";
import { Button, Icon } from "@clinic/ui";
import {
  activeNavItem,
  canReachNavItem,
  isWorkspacePath,
  NAV_SETTINGS,
  visibleNavGroups,
  visibleSettingsItems,
  type NavGroup,
  type NavItem,
} from "@web/shared/lib/navigation";
import { useSession } from "@web/shared/providers/session";
import { useTranslationBundle } from "@web/modules/translations/queries";
import { useApplyTranslationOverrides } from "@web/modules/translations/hooks/use-translation-overrides";
import { usePendingBookingsCount } from "@web/shared/queries/booking";
import { seesPendingBookings } from "@web/shared/permissions/booking";
import { cn } from "@clinic/ui/lib/cn";
import { useClinicLogo } from "@web/shared/hooks/use-clinic-logo";
import { DASHBOARD_PATH, PATIENTS_PATH } from "@web/shared/constants/layout";

export function AppLayout(): JSX.Element {
  const overrides = useTranslationBundle(true);
  useApplyTranslationOverrides(overrides.data);

  const { t } = useTranslation();
  const { user, logout, can } = useSession();
  const { pathname } = useLocation();
  const logoUrl = useClinicLogo(user?.clinicId, user?.clinic.logoUrl);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [params] = useSearchParams();
  const [searchOpen, setSearchOpen] = useState(false);
  const searchToggle = useRef<HTMLButtonElement>(null);
  const [actionSlot] = useState(createPageActionSlot);
  const searchable = canReachNavItem(PATIENTS_PATH, user ? can : undefined);

  const groups = visibleNavGroups(user ? can : undefined);
  const settings = visibleSettingsItems(user ? can : undefined);

  const pendingBookings = usePendingBookingsCount(seesPendingBookings(can));
  const badges = { pendingBookings } as const;

  useEffect(() => {
    setDrawerOpen(false);
    setSearchOpen(false);
  }, [pathname]);

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

  const isCompact = useIsCompactLayout();
  const workspace = isWorkspacePath(pathname);

  const isMobile = useIsMobile();
  const listQuery = pathname === PATIENTS_PATH && (params.get("q") ?? "") !== "";
  const searchShown = !isMobile || searchOpen || listQuery;

  const openSearch = (): void => setSearchOpen(true);

  const closeSearch = (): void => {
    if (!isMobile || !searchOpen) {
      return;
    }

    setSearchOpen(false);
    searchToggle.current?.focus();
  };

  const topBar = (
    <header
      data-testid="app-topbar"
      data-variant={workspace ? "flat" : undefined}
      className={cn(
        "flex min-h-[70px] flex-wrap items-center gap-x-3.5",
        "max-md:content-start",
        workspace
          ? "px-4 py-3 rail:px-6"
          : "rounded-field border border-line bg-surface px-4 py-3 shadow-card",
      )}
    >
      <Button
        variant="secondary"
        size="sm"
        data-testid="app-nav-toggle"
        className="-ms-1 rail:hidden"
        aria-expanded={drawerOpen}
        onClick={() => setDrawerOpen(true)}
        icon={<Icon name="menu" />}
        aria-label={t("nav.menu")}
      />
      <div className="flex min-w-0 flex-1 basis-0 md:hidden">
        <Link
          to={DASHBOARD_PATH}
          aria-label={t("nav.backToDashboard")}
          data-testid="app-topbar-brand"
          className="block max-w-full rounded-control"
        >
          <Logo
            size="bar"
            src={logoUrl}
            name={user?.clinic.name}
            alt={t("app.title")}
            className="mx-0 [&_img]:object-left rtl:[&_img]:object-right"
          />
        </Link>
      </div>
      {searchable && (
        <div
          id="app-topbar-search"
          data-testid="app-topbar-search"
          data-state={searchShown ? "open" : "closed"}
          inert={!searchShown}
          className={cn(
            "order-last grid basis-full transition-[grid-template-rows] duration-200 ease-out",
            searchShown ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            "md:order-none md:flex md:min-w-0 md:flex-1 md:basis-auto",
          )}
        >
          <div className="-mx-1 min-h-0 overflow-hidden md:m-0 md:flex md:flex-1 md:overflow-visible">
            <div className="flex px-1 pt-3 pb-1 md:flex-1 md:p-0">
              <TopSearch onDismiss={closeSearch} />
            </div>
          </div>
        </div>
      )}
      <div
        data-testid="app-topbar-actions"
        className="ms-auto flex shrink-0 items-center gap-[9px]"
      >
        {searchable && (
          <Button
            ref={searchToggle}
            variant="secondary"
            size="sm"
            data-testid="app-search-toggle"
            className="md:hidden"
            aria-expanded={searchShown}
            aria-controls="app-topbar-search"
            aria-label={t(searchShown ? "nav.closeSearch" : "nav.openSearch")}
            icon={<Icon name={searchShown ? "x" : "search"} />}
            onClick={() => (searchShown ? closeSearch() : openSearch())}
          />
        )}
        <NotificationBell />
        <span className="contents" ref={(host) => void host?.appendChild(actionSlot)} />
      </div>
    </header>
  );

  return (
    <PageActionSlotProvider value={isCompact ? null : actionSlot}>
      <PullToRefresh />
      <a
        href="#main"
        data-testid="skip-to-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main")?.focus();
        }}
        className={cn(
          "sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[70]",
          "focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:shadow-float",
          "focus:text-label focus:font-medium focus:text-primary-700",
        )}
      >
        {t("nav.skipToContent")}
      </a>
      <div data-testid="app-layout" className="flex min-h-full flex-col rail:flex-row">
        <aside
          aria-label={t("nav.sidebar")}
          data-testid="app-rail"
          className={cn(
            "z-30 hidden shrink-0 bg-rail rail:block rail:w-[266px]",
            "rail:sticky rail:top-0 rail:h-dvh",
            "rail:border-e rail:border-line",
          )}
        >
          <div className="flex h-full flex-col px-[18px] pt-5 pb-[18px]">
            <Link
              to={DASHBOARD_PATH}
              aria-label={t("nav.backToDashboard")}
              data-testid="app-rail-brand"
              className="mb-[22px] block shrink-0 rounded-brand border border-line bg-surface px-4 py-3.5"
            >
              <Logo size="chrome" src={logoUrl} name={user?.clinic.name} alt={t("app.title")} />
            </Link>
            <div className="scroll-lane -mx-[18px] min-h-0 flex-1 overflow-y-auto px-[18px]">
              <NavList groups={groups} settings={settings} badges={badges} />
            </div>

            {user && (
              <div data-testid="app-rail-user" className="mt-auto shrink-0 pt-4">
                <UserMenu user={user} onLogout={() => void logout()} />
              </div>
            )}
          </div>
        </aside>
        <NavDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          title={t("app.title")}
          brand={
            <Link
              to={DASHBOARD_PATH}
              aria-label={t("nav.backToDashboard")}
              data-testid="nav-drawer-brand"
              className="block rounded-control"
              onClick={() => setDrawerOpen(false)}
            >
              <Logo size="chrome" src={logoUrl} name={user?.clinic.name} />
            </Link>
          }
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
          {workspace ? (
            <main
              id="main"
              tabIndex={-1}
              data-testid="app-main"
              className="flex h-dvh min-w-0 flex-1 flex-col outline-none"
            >
              <WorkspaceTopBarProvider value={topBar}>
                <PageErrorBoundary key={pathname}>
                  <Outlet />
                </PageErrorBoundary>
              </WorkspaceTopBarProvider>
            </main>
          ) : (
            <>
              <div className="sticky top-0 z-20 bg-canvas px-4 pt-4 pb-3 rail:px-[34px] rail:pt-[26px]">
                {topBar}
              </div>
              <main
                id="main"
                tabIndex={-1}
                data-testid="app-main"
                className="min-w-0 flex-1 px-4 pt-1 pb-10 outline-none rail:px-[34px] rail:pb-12"
              >
                <div className="w-full">
                  <BackLink />
                  <PageErrorBoundary key={pathname}>
                    <Outlet />
                  </PageErrorBoundary>
                </div>
              </main>
            </>
          )}
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
