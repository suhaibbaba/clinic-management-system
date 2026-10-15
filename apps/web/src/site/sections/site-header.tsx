import { SITE_SECTION, type SiteLanguage, type SiteSection } from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { cx } from "@web/booking/ui";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteLink } from "@web/site/components/site-link";
import { SiteLogo } from "@web/site/components/site-logo";
import { SITE_LANGUAGE_LABELS, SITE_LANGUAGE_SHORT, SITE_PARAM } from "@web/site/constants";
import { useBookable } from "@web/site/hooks/use-bookable";
import { useSite } from "@web/site/hooks/use-site";
import { nameIn } from "@web/site/lib/text";
import { SITE_PATH, type SitePageRoute } from "@web/site/route";

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
  const { site, language, t, page, setParams } = useSite();
  const [open, setOpen] = useState(false);
  const other: SiteLanguage = language === "ar" ? "en" : "ar";
  const name = nameIn(site.clinic.name, language);
  const links = LINKS.filter(
    (link) => link.section === null || site.content.sections.includes(link.section),
  );
  const bookable = useBookable();

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

    root.style.overflow = "hidden";
    window.addEventListener("keydown", close);

    return () => {
      root.style.overflow = "";
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <header
      data-testid="site-header"
      className="sticky top-0 z-30 border-b border-line/50 bg-surface/85 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 lg:py-4">
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
          <button
            type="button"
            lang={other}
            data-testid="site-language"
            aria-label={t("nav.switchLanguage", { language: SITE_LANGUAGE_LABELS[other] })}
            onClick={() => setParams({ [SITE_PARAM.LANGUAGE]: other === "ar" ? null : other })}
            className="pill-text inline-flex min-h-(--control-h) cursor-pointer items-center rounded-pill px-3 text-label font-medium text-ink-muted hover:bg-primary-50 hover:text-primary-700"
          >
            {SITE_LANGUAGE_SHORT[other]}
          </button>

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
            type="button"
            data-testid="site-menu"
            aria-expanded={open}
            aria-controls="site-menu-panel"
            aria-label={t("nav.menu")}
            onClick={() => setOpen((value) => !value)}
            className="inline-flex size-(--control-h) cursor-pointer items-center justify-center rounded-control text-ink-muted hover:bg-primary-50 lg:hidden"
          >
            <SiteIcon name={open ? "x" : "menu"} />
          </button>
        </div>
      </div>

      {open && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          data-testid="site-menu-backdrop"
          onClick={() => setOpen(false)}
          className="absolute inset-x-0 top-full h-dvh cursor-default bg-primary-900/30 backdrop-blur-sm lg:hidden"
        />
      )}

      <nav
        id="site-menu-panel"
        aria-label={t("nav.label")}
        data-testid="site-menu-panel"
        className={cx(
          "absolute inset-x-0 top-full border-t border-line bg-surface shadow-float lg:hidden",
          !open && "hidden",
        )}
      >
        <ul className="mx-auto flex max-w-6xl flex-col px-4 py-2">
          {links.map((link) => (
            <li key={link.to}>
              <SiteLink
                to={link.to}
                onClick={() => setOpen(false)}
                {...(link.pages.includes(page.kind) && {
                  "aria-current": "page" as const,
                })}
                className="block rounded-control px-3 py-3 text-value font-medium text-ink hover:bg-primary-50 aria-[current=page]:bg-primary-50 aria-[current=page]:text-primary-800"
              >
                {t(link.label)}
              </SiteLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
