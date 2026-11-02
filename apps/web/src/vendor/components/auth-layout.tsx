import { localized, PRODUCT_NAME } from "@clinic/shared";
import { Icon, type IconName } from "@clinic/ui/components/icon";
import type { JSX, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LanguageMenu } from "@web/vendor/components/language-menu";
import { VendorLogo } from "@web/vendor/components/vendor-logo";

const POINTS: readonly { readonly icon: IconName; readonly key: string }[] = [
  { icon: "building", key: "clinics" },
  { icon: "gem", key: "plans" },
  { icon: "shield", key: "safe" },
];

export function AuthLayout({ children }: { readonly children: ReactNode }): JSX.Element {
  const { t, i18n } = useTranslation();
  const product = localized(PRODUCT_NAME, i18n.language);

  return (
    <main
      id="content"
      className="grid min-h-screen bg-canvas lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"
      data-testid="vendor-auth"
    >
      <section className="relative hidden overflow-hidden bg-primary-900 px-12 py-14 text-ink-inverse lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -end-24 -top-24 size-80 rounded-full border-[40px] border-ink-inverse/5"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -start-16 size-96 rounded-full bg-primary-700/40"
        />
        <div className="relative flex items-center gap-3">
          <VendorLogo />
          <span className="flex flex-col">
            <strong className="text-value">{product}</strong>
            <span className="text-meta text-primary-100">{t("vendor.tagline")}</span>
          </span>
        </div>
        <div className="relative flex max-w-md flex-col gap-8">
          <h1 className="text-hero font-extrabold text-balance">{t("vendor.signIn.headline")}</h1>
          <ul className="flex flex-col gap-5">
            {POINTS.map((point) => (
              <li key={point.key} className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-control bg-ink-inverse/10">
                  <Icon name={point.icon} className="size-5 text-primary-100" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <strong className="text-value">
                    {t(`vendor.signIn.points.${point.key}.title`)}
                  </strong>
                  <span className="text-label text-primary-100">
                    {t(`vendor.signIn.points.${point.key}.body`)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-meta text-primary-100">{t("vendor.signIn.private")}</p>
      </section>

      <section className="flex flex-col px-4 py-6 sm:px-8">
        <div className="flex justify-end">
          <LanguageMenu />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="flex w-full max-w-(--field-max) flex-col gap-6 rounded-card border border-line bg-surface p-7 shadow-card">
            <div className="flex flex-col items-center gap-3 text-center">
              <VendorLogo size="lg" />
              <span className="text-label font-bold text-primary-700">{product}</span>
            </div>
            {children}
          </div>
        </div>
        <p className="text-center text-meta text-ink-muted lg:hidden">
          {t("vendor.signIn.private")}
        </p>
      </section>
    </main>
  );
}
