import { SITE_SECTION, type SiteSection } from "@clinic/shared";
import { useEffect, useRef, useState, type JSX } from "react";
import { createPortal } from "react-dom";
import { cx } from "@web/booking/ui";
import { PortalUserMenu } from "@web/site/components/portal/portal-user-menu";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteLink } from "@web/site/components/site-link";
import { SiteLogo } from "@web/site/components/site-logo";
import { useBookable } from "@web/site/hooks/use-bookable";
import { useMeasuredHeight } from "@web/site/hooks/use-measured-height";
import { usePortal } from "@web/site/hooks/use-portal";
import { useSite } from "@web/site/hooks/use-site";
import { nameIn } from "@web/site/lib/text";
import { SITE_PATH, type SitePageRoute } from "@web/site/route";
import { SiteTopBar } from "@web/site/sections/site-top-bar";

const LINKS: readonly {
  readonly to: string;
  readonly label: string;
  readonly section: SiteSection | null;
  readonly pages: readonly SitePageRoute["kind"][];
}[] = [
  { to: "/", label: "nav.home", section: null, pages: ["home"] },
  {
    to: SITE_PATH.SERVICES,
    label: "nav.services",
    section: SITE_SECTION.SERVICES,
    pages: ["services"],
  },
  {
    to: SITE_PATH.DOCTORS,
    label: "nav.doctors",
    section: SITE_SECTION.DOCTORS,
    pages: ["doctors", "doctor"],
  },
  { to: SITE_PATH.ABOUT, label: "nav.about", section: SITE_SECTION.ABOUT, pages: ["about"] },
  {
    to: SITE_PATH.CONTACT,
    label: "nav.contact",
    section: SITE_SECTION.CONTACT,
    pages: ["contact"],
  },
];

export function SiteHeader(): JSX.Element {
  const { site, language, languages, t, page } = useSite();
  const [open, setOpen] = useState(false);
  const account = usePortal();
  const name = nameIn(site.clinic.name, language, languages);
  const links = LINKS.filter(
    (link) => link.section === null || site.content.sections.includes(link.section),
  );
  const bookable = useBookable();
  const portal = site.content.sections.includes(SITE_SECTION.PORTAL);
  const header = useRef<HTMLElement>(null);
  const height = useMeasuredHeight(header);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (height === undefined) {
      return;
    }

    const root = document.documentElement;

    root.style.setProperty("--site-sticky-top", `${height}px`);

    return () => {
      root.style.removeProperty("--site-sticky-top");
    };
  }, [height]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const close = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    const root = document.documentElement;
    const opener = trigger.current;

    root.style.overflow = "hidden";
    panel.current?.focus({ preventScroll: true });
    window.addEventListener("keydown", close);

    return () => {
      root.style.overflow = "";
      window.removeEventListener("keydown", close);
      opener?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <header
      ref={header}
      data-testid="site-header"
      className="sticky top-0 z-30 border-b border-line/50 bg-surface/90 backdrop-blur-md"
    >
      <SiteTopBar />
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <SiteLink
          to="/"
          data-testid="site-brand"
          className="flex max-w-52 min-w-0 shrink items-center lg:max-w-60"
        >
          <SiteLogo url={site.clinic.logoUrl} name={name} />
        </SiteLink>

        <nav aria-label={t("nav.label")} className="ms-auto hidden lg:block">
          <ul className="flex items-center gap-2">
            {links.map((link) => {
              const current = link.pages.includes(page.kind);

              return (
                <li key={link.to}>
                  <SiteLink
                    to={link.to}
                    data-testid={`site-nav-${link.label.split(".")[1]}`}
                    {...(current && { "aria-current": "page" as const })}
                    className={cx(
                      "relative inline-flex px-3 py-2 text-value font-medium transition-colors",
                      "after:absolute after:inset-x-3 after:-bottom-1 after:h-0.5 after:rounded-pill after:transition-transform after:duration-200",
                      current
                        ? "font-bold text-primary-900 after:scale-x-100 after:bg-primary-600"
                        : "text-ink-muted after:scale-x-0 after:bg-primary-600 hover:text-primary-700",
                    )}
                  >
                    {t(link.label)}
                  </SiteLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ms-auto flex shrink-0 items-center gap-2 lg:ms-0">
          {portal && account.state.status === "ready" && (
            <PortalUserMenu
              account={account.state.account}
              onSignOut={() => void account.signOut()}
            />
          )}

          {portal && account.state.status !== "ready" && (
            <SiteLink
              to={SITE_PATH.ACCOUNT}
              data-testid="site-header-account"
              aria-label={t("nav.account")}
              {...(page.kind === "account" && { "aria-current": "page" as const })}
              className="pill-text inline-flex min-h-(--control-h) items-center gap-2 rounded-pill px-3 text-label font-medium text-primary-800 hover:bg-primary-50 aria-[current=page]:bg-primary-50"
            >
              <SiteIcon name="user" />
              <span aria-hidden className="hidden xl:inline">
                {t("nav.account")}
              </span>
            </SiteLink>
          )}

          {bookable && (
            <SiteLink
              to={SITE_PATH.BOOKING}
              data-testid="site-header-book"
              className="pill-text inline-flex min-h-(--control-h) items-center gap-2 rounded-pill bg-primary-600 px-4 text-label font-medium text-ink-inverse shadow-nav-active transition-colors hover:bg-primary-700 max-[23rem]:px-3 sm:px-6"
            >
              <SiteIcon name="calendar" />
              <span className="max-[23rem]:sr-only">{t("nav.book")}</span>
            </SiteLink>
          )}

          <button
            ref={trigger}
            type="button"
            data-testid="site-menu"
            aria-expanded={open}
            aria-controls="site-menu-panel"
            aria-label={t("nav.menu")}
            onClick={() => setOpen(true)}
            className="inline-flex size-(--control-h) cursor-pointer items-center justify-center rounded-control text-ink-muted hover:bg-primary-50 lg:hidden"
          >
            <SiteIcon name="menu" />
          </button>
        </div>
      </div>

      {createPortal(
        <div className="lg:hidden">
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            data-testid="site-menu-backdrop"
            onClick={() => setOpen(false)}
            className={cx(
              "fixed inset-0 z-40 cursor-default bg-primary-900/40 backdrop-blur-sm transition-opacity duration-300",
              open ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          />
          <div
            ref={panel}
            id="site-menu-panel"
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.menu")}
            data-testid="site-menu-panel"
            tabIndex={-1}
            inert={!open}
            className={cx(
              "fixed inset-y-0 end-0 z-50 flex w-[min(20rem,86vw)] flex-col bg-surface shadow-drawer transition-[translate,visibility] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
              open
                ? "visible translate-x-0"
                : "invisible ltr:translate-x-full rtl:-translate-x-full",
            )}
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <span className="flex max-w-44 min-w-0 items-center">
                <SiteLogo url={site.clinic.logoUrl} name={name} />
              </span>
              <button
                type="button"
                data-testid="site-menu-close"
                aria-label={t("nav.close")}
                onClick={() => setOpen(false)}
                className="inline-flex size-(--control-h) shrink-0 cursor-pointer items-center justify-center rounded-pill text-ink-muted hover:bg-primary-50 hover:text-primary-800"
              >
                <SiteIcon name="x" />
              </button>
            </div>
            <nav aria-label={t("nav.label")} className="flex-1 overflow-y-auto px-3 py-4">
              <ul className="flex flex-col gap-1">
                {links.map((link, position) => (
                  <li
                    key={link.to}
                    style={{ transitionDelay: open ? `${120 + position * 45}ms` : "0ms" }}
                    className={cx(
                      "transition-[opacity,translate] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
                    )}
                  >
                    <SiteLink
                      to={link.to}
                      onClick={() => setOpen(false)}
                      {...(link.pages.includes(page.kind) && {
                        "aria-current": "page" as const,
                      })}
                      className="flex items-center justify-between rounded-control px-4 py-3 text-value font-medium text-ink hover:bg-primary-50 aria-[current=page]:bg-primary-50 aria-[current=page]:font-bold aria-[current=page]:text-primary-800"
                    >
                      {t(link.label)}
                      <SiteIcon name="chevron-end" className="size-4 text-ink-subtle" />
                    </SiteLink>
                  </li>
                ))}
              </ul>
            </nav>
            {bookable && (
              <div className="border-t border-line p-4">
                <SiteLink
                  to={SITE_PATH.BOOKING}
                  onClick={() => setOpen(false)}
                  data-testid="site-menu-book"
                  className="pill-text flex min-h-(--control-h) items-center justify-center gap-2 rounded-pill bg-primary-600 px-6 text-label font-medium text-ink-inverse shadow-nav-active hover:bg-primary-700"
                >
                  <SiteIcon name="calendar" />
                  {t("nav.book")}
                </SiteLink>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </header>
  );
}
