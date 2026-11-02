import { Button } from "@clinic/ui/components/button";
import { FormField } from "@clinic/ui/components/form-field";
import { Icon } from "@clinic/ui/components/icon";
import { Input } from "@clinic/ui/components/input";
import { PasswordInput } from "@clinic/ui/components/password-input";
import { useState, type FormEvent, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "@web/vendor/components/auth-layout";
import { VendorLink } from "@web/vendor/components/vendor-link";
import { vendorErrorKey } from "@web/vendor/lib/vendor-api-error";
import { vendorPath } from "@web/vendor/lib/route";
import { useSignIn } from "@web/vendor/queries";

export function LoginPage({ navigate }: { readonly navigate: (to: string) => void }): JSX.Element {
  const { t } = useTranslation();
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
    <AuthLayout>
      <form onSubmit={submit} data-testid="vendor-login" className="flex flex-col gap-5">
        <div className="flex flex-col gap-1 text-center">
          <h2 className="text-title font-extrabold text-ink">{t("vendor.signIn.title")}</h2>
          <p className="text-label text-ink-muted">{t("vendor.signIn.subtitle")}</p>
        </div>
        <FormField label="vendor.signIn.email" htmlFor="vendor-email">
          <Input
            id="vendor-email"
            type="email"
            dir="ltr"
            autoComplete="username"
            placeholder={t("vendor.signIn.emailPlaceholder")}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>
        <div className="flex flex-col gap-2">
          <FormField label="vendor.signIn.password" htmlFor="vendor-password">
            <PasswordInput
              id="vendor-password"
              dir="ltr"
              autoComplete="current-password"
              placeholder={t("vendor.signIn.passwordPlaceholder")}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </FormField>
          <VendorLink
            to={vendorPath({ kind: "forgot" })}
            navigate={navigate}
            className="self-end text-label text-primary-700 hover:underline"
            data-testid="vendor-forgot-link"
          >
            {t("vendor.signIn.forgot")}
          </VendorLink>
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
    </AuthLayout>
  );
}
