import { languageDefinition } from "@clinic/shared";
import { Button } from "@clinic/ui/components/button";
import { FormField } from "@clinic/ui/components/form-field";
import { Icon, type IconName } from "@clinic/ui/components/icon";
import { Input } from "@clinic/ui/components/input";
import { PasswordInput } from "@clinic/ui/components/password-input";
import { cn } from "@clinic/ui/lib/cn";
import { useState, type FormEvent, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { VendorLogo } from "@web/vendor/components/vendor-logo";
import { changeVendorLanguage, VENDOR_LANGUAGES } from "@web/vendor/i18n";
import { vendorErrorKey } from "@web/vendor/lib/vendor-api-error";
import { vendorPath } from "@web/vendor/lib/route";
import { useSignIn } from "@web/vendor/queries";

const POINTS: readonly { readonly icon: IconName; readonly key: string }[] = [
  { icon: "building", key: "clinics" },
  { icon: "gem", key: "plans" },
  { icon: "shield", key: "safe" },
];

export function LoginPage({ navigate }: { readonly navigate: (to: string) => void }): JSX.Element {
  const { t, i18n } = useTranslation();
  const signIn = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    signIn.mutate(
      { email, password },
      { onSuccess: () => navigate(vendorPath({ kind: "clinics" })) },
    );
  };

  return (
    <main
      id="content"
      className="grid min-h-screen bg-canvas lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"
      data-testid="vendor-login-page"
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
            <strong className="text-value">{t("vendor.title")}</strong>
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
        <div className="flex justify-end gap-1" role="group" aria-label={t("vendor.nav.language")}>
          {VENDOR_LANGUAGES.map((language) => (
            <button
              key={language}
              type="button"
              aria-pressed={i18n.language === language}
              onClick={() => changeVendorLanguage(language)}
              className={cn(
                "min-h-(--control-h-sm) cursor-pointer rounded-pill px-3 text-label",
                i18n.language === language
                  ? "bg-primary-100 font-bold text-primary-700"
                  : "text-ink-muted hover:bg-inset",
              )}
            >
              {languageDefinition(language).nativeName}
            </button>
          ))}
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <form
            onSubmit={submit}
            data-testid="vendor-login"
            className="flex w-full max-w-(--form-max) flex-col gap-6 rounded-card border border-line bg-surface p-8 shadow-card"
          >
            <div className="flex flex-col items-center gap-4 text-center">
              <VendorLogo size="lg" />
              <div className="flex flex-col gap-1">
                <h2 className="text-title font-extrabold text-ink">{t("vendor.signIn.title")}</h2>
                <p className="text-label text-ink-muted">{t("vendor.signIn.subtitle")}</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <FormField label="vendor.signIn.email" htmlFor="vendor-email">
                <Input
                  id="vendor-email"
                  type="email"
                  dir="ltr"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </FormField>
              <FormField label="vendor.signIn.password" htmlFor="vendor-password">
                <PasswordInput
                  id="vendor-password"
                  dir="ltr"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </FormField>
            </div>

            {signIn.isError && (
              <p
                role="alert"
                className="flex items-center gap-2 rounded-panel bg-danger-50 px-3 py-2.5 text-label text-danger-700"
                data-testid="vendor-login-error"
              >
                <Icon name="alert" className="size-4 shrink-0" />
                {t(vendorErrorKey(signIn.error))}
              </p>
            )}

            <Button
              type="submit"
              isLoading={signIn.isPending}
              icon={<Icon name="login" />}
              className="w-full"
              data-testid="vendor-login-submit"
            >
              {t("vendor.signIn.submit")}
            </Button>
          </form>
        </div>

        <p className="text-center text-meta text-ink-muted lg:hidden">
          {t("vendor.signIn.private")}
        </p>
      </section>
    </main>
  );
}
