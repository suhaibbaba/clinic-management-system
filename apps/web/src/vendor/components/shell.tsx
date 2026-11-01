import { Button } from "@clinic/ui/components/button";
import { Select } from "@clinic/ui/components/select";
import { cn } from "@clinic/ui/lib/cn";
import type { JSX, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { VendorLink } from "@web/vendor/components/vendor-link";
import { changeVendorLanguage, VENDOR_LANGUAGES } from "@web/vendor/i18n";
import { vendorPath } from "@web/vendor/lib/route";
import { useSignOut } from "@web/vendor/queries";

export function Shell({
  section,
  navigate,
  children,
}: {
  readonly section: "clinics" | "plans";
  readonly navigate: (to: string) => void;
  readonly children: ReactNode;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const signOut = useSignOut();
  const tab = (target: "clinics" | "plans"): string =>
    cn(
      "inline-flex min-h-(--control-h) items-center rounded-field px-3 font-medium",
      target === section ? "bg-primary-100 text-primary-700" : "text-ink-muted hover:bg-inset",
    );

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <strong className="text-title text-ink">{t("vendor.title")}</strong>
          <nav className="flex gap-1" aria-label={t("vendor.title")}>
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
          <div className="ms-auto flex items-center gap-2">
            <Select
              aria-label={t("vendor.title")}
              value={i18n.language}
              onChange={(event) => changeVendorLanguage(event.target.value)}
              options={VENDOR_LANGUAGES.map((language) => ({
                value: language,
                label: language.toUpperCase(),
              }))}
              data-testid="vendor-language"
            />
            <Button
              variant="secondary"
              data-testid="vendor-sign-out"
              onClick={() =>
                signOut.mutate(undefined, {
                  onSettled: () => navigate(vendorPath({ kind: "login" })),
                })
              }
            >
              {t("vendor.nav.signOut")}
            </Button>
          </div>
        </div>
      </header>
      <main id="content" className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
