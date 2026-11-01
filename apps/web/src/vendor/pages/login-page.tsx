import { Button } from "@clinic/ui/components/button";
import { FormField } from "@clinic/ui/components/form-field";
import { Input } from "@clinic/ui/components/input";
import { useState, type FormEvent, type JSX } from "react";
import { useTranslation } from "react-i18next";
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
    <main id="content" className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <form
        onSubmit={submit}
        data-testid="vendor-login"
        className="flex w-full max-w-(--form-max) flex-col gap-4 rounded-card border border-line bg-surface p-6 shadow-card"
      >
        <div>
          <h1 className="text-title font-semibold text-ink">{t("vendor.signIn.title")}</h1>
          <p className="text-meta text-ink-muted">{t("vendor.signIn.subtitle")}</p>
        </div>
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
          <Input
            id="vendor-password"
            type="password"
            dir="ltr"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </FormField>
        {signIn.isError && (
          <p role="alert" className="text-label text-danger-700" data-testid="vendor-login-error">
            {t(vendorErrorKey(signIn.error))}
          </p>
        )}
        <Button type="submit" isLoading={signIn.isPending} data-testid="vendor-login-submit">
          {t("vendor.signIn.submit")}
        </Button>
      </form>
    </main>
  );
}
