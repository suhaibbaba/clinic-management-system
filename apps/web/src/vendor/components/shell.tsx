import { languageDefinition } from "@clinic/shared";
import { Icon } from "@clinic/ui/components/icon";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "@clinic/ui/components/menu";
import { cn } from "@clinic/ui/lib/cn";
import { useState, type FormEvent, type JSX, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { VendorLink } from "@web/vendor/components/vendor-link";
import { VENDOR_PARAM } from "@web/vendor/constants";
import { changeVendorLanguage, VENDOR_LANGUAGES } from "@web/vendor/i18n";
import { profileInitials } from "@web/vendor/lib/clinic-actions";
import { vendorPath } from "@web/vendor/lib/route";
import { useSignOut, useVendorSession } from "@web/vendor/queries";

export function Shell({
  section,
  navigate,
  search = "",
  children,
}: {
  readonly section: "clinics" | "plans";
  readonly navigate: (to: string) => void;
  readonly search?: string;
  readonly children: ReactNode;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const session = useVendorSession();
  const signOut = useSignOut();
  const [query, setQuery] = useState(search);
  const profile = session.data;
  const tab = (target: "clinics" | "plans"): string =>
    cn(
      "inline-flex min-h-(--control-h) items-center rounded-control px-3.5 text-label",
      target === section
        ? "bg-ink-inverse/15 font-bold text-ink-inverse"
        : "text-primary-100 hover:bg-ink-inverse/10 hover:text-ink-inverse",
    );
  const find = (event: FormEvent): void => {
    event.preventDefault();
    const text = query.trim();

    navigate(
      `${vendorPath({ kind: "clinics" })}${text ? `?${VENDOR_PARAM.SEARCH}=${encodeURIComponent(text)}` : ""}`,
    );
  };

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2"
      >
        {t("vendor.nav.skip")}
      </a>
      <header className="bg-primary-900 text-ink-inverse" data-testid="vendor-header">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2">
          <VendorLink
            to={vendorPath({ kind: "clinics" })}
            navigate={navigate}
            className="flex items-center gap-2.5 text-ink-inverse no-underline"
          >
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-control bg-primary-500 text-value font-extrabold"
            >
              {t("vendor.brandMark")}
            </span>
            <span className="flex flex-col">
              <strong className="text-value">{t("vendor.title")}</strong>
              <span className="text-meta text-primary-100">{t("vendor.tagline")}</span>
            </span>
          </VendorLink>

          <nav className="flex gap-1" aria-label={t("vendor.nav.label")}>
            <VendorLink
              to={vendorPath({ kind: "clinics" })}
              navigate={navigate}
              className={tab("clinics")}
              data-testid="vendor-nav-clinics"
            >
              {t("vendor.nav.clinics")}
            </VendorLink>
            <VendorLink
              to={vendorPath({ kind: "plans" })}
              navigate={navigate}
              className={tab("plans")}
              data-testid="vendor-nav-plans"
            >
              {t("vendor.nav.plans")}
            </VendorLink>
          </nav>

          <form role="search" onSubmit={find} className="min-w-48 flex-1">
            <label className="flex min-h-(--control-h) items-center gap-2 rounded-control bg-ink-inverse/10 px-3">
              <Icon name="search" className="size-4 text-primary-100" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label={t("vendor.clinics.search")}
                placeholder={t("vendor.clinics.search")}
                className="min-w-0 flex-1 bg-transparent text-label text-ink-inverse placeholder:text-primary-100"
                data-testid="vendor-header-search"
              />
            </label>
          </form>

          <Menu>
            <MenuTrigger
              className="flex min-h-(--control-h) cursor-pointer items-center gap-2.5 rounded-control px-2 hover:bg-ink-inverse/10"
              data-testid="vendor-account"
            >
              <span
                aria-hidden="true"
                className="grid size-9 place-items-center rounded-full bg-primary-100 text-label font-bold text-primary-700"
              >
                {profileInitials(profile?.name ?? "")}
              </span>
              <span className="flex flex-col text-start max-sm:hidden">
                <span className="text-label font-bold">{profile?.name}</span>
                <span className="text-meta text-primary-100" dir="ltr">
                  {profile?.email}
                </span>
              </span>
              <Icon name="chevron-down" className="size-4 text-primary-100" />
            </MenuTrigger>
            <MenuContent align="end">
              <MenuLabel>{t("vendor.nav.language")}</MenuLabel>
              {VENDOR_LANGUAGES.map((language) => (
                <MenuItem
                  key={language}
                  icon="language"
                  onSelect={() => changeVendorLanguage(language)}
                  trailing={
                    i18n.language === language ? (
                      <Icon name="check" className="size-4" />
                    ) : undefined
                  }
                >
                  {languageDefinition(language).nativeName}
                </MenuItem>
              ))}
              <MenuSeparator />
              <MenuItem
                icon="logout"
                tone="danger"
                data-testid="vendor-sign-out"
                onSelect={() =>
                  signOut.mutate(undefined, {
                    onSettled: () => navigate(vendorPath({ kind: "login" })),
                  })
                }
              >
                {t("vendor.nav.signOut")}
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </header>
      <main id="content" className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-7">
        {children}
      </main>
    </div>
  );
}
