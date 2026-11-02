import { PASSWORD_MIN_LENGTH } from "@clinic/shared";
import { Button } from "@clinic/ui/components/button";
import { FormField } from "@clinic/ui/components/form-field";
import { Icon } from "@clinic/ui/components/icon";
import { PasswordInput } from "@clinic/ui/components/password-input";
import { useState, type FormEvent, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "@web/vendor/components/auth-layout";
import { VendorLink } from "@web/vendor/components/vendor-link";
import { vendorErrorKey } from "@web/vendor/lib/vendor-api-error";
import { vendorPath } from "@web/vendor/lib/route";
import { useResetPassword } from "@web/vendor/queries";

export function ResetPage({
  token,
  navigate,
}: {
  readonly token: string;
  readonly navigate: (to: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const reset = useResetPassword();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [tried, setTried] = useState(false);
  const tooShort = password.length < PASSWORD_MIN_LENGTH;
  const mismatch = password !== again;

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    setTried(true);

    if (!tooShort && !mismatch) {
      reset.mutate({ token, password });
    }
  };

  const signIn = (
    <VendorLink
      to={vendorPath({ kind: "login" })}
      navigate={navigate}
      className="self-center text-label text-primary-700 hover:underline"
    >
      {t("vendor.forgot.back")}
    </VendorLink>
  );

  if (reset.isSuccess) {
    return (
      <AuthLayout>
        <div
          className="flex flex-col items-center gap-4 text-center"
          data-testid="vendor-reset-done"
        >
          <span className="grid size-12 place-items-center rounded-full bg-success-50 text-success-700">
            <Icon name="check" className="size-6" />
          </span>
          <h2 className="text-title font-extrabold text-ink">{t("vendor.reset.doneTitle")}</h2>
          <p className="text-label text-ink-muted">{t("vendor.reset.doneBody")}</p>
          {signIn}
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form onSubmit={submit} className="flex flex-col gap-5" data-testid="vendor-reset">
        <div className="flex flex-col gap-1 text-center">
          <h2 className="text-title font-extrabold text-ink">{t("vendor.reset.title")}</h2>
          <p className="text-label text-ink-muted">
            {t("vendor.reset.subtitle", { count: PASSWORD_MIN_LENGTH })}
          </p>
        </div>
        <FormField label="vendor.reset.password" htmlFor="vendor-new-password">
          <PasswordInput
            id="vendor-new-password"
            dir="ltr"
            autoComplete="new-password"
            placeholder={t("vendor.reset.passwordPlaceholder", { count: PASSWORD_MIN_LENGTH })}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </FormField>
        <FormField label="vendor.reset.again" htmlFor="vendor-new-password-again">
          <PasswordInput
            id="vendor-new-password-again"
            dir="ltr"
            autoComplete="new-password"
            placeholder={t("vendor.reset.againPlaceholder")}
            value={again}
            onChange={(event) => setAgain(event.target.value)}
          />
        </FormField>
        {tried && (tooShort || mismatch) && (
          <p role="alert" className="text-label text-danger-700">
            {t(tooShort ? "vendor.reset.tooShort" : "vendor.reset.mismatch", {
              count: PASSWORD_MIN_LENGTH,
            })}
          </p>
        )}
        {reset.isError && (
          <p role="alert" className="text-label text-danger-700">
            {t(vendorErrorKey(reset.error))}
          </p>
        )}
        <Button type="submit" isLoading={reset.isPending} className="w-full">
          {t("vendor.reset.submit")}
        </Button>
        {signIn}
      </form>
    </AuthLayout>
  );
}
