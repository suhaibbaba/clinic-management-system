import { DEFAULT_LANGUAGE, languageCodeSchema } from "@clinic/shared";
import { Button } from "@clinic/ui/components/button";
import { FormField } from "@clinic/ui/components/form-field";
import { Icon } from "@clinic/ui/components/icon";
import { Input } from "@clinic/ui/components/input";
import { useState, type FormEvent, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "@web/vendor/components/auth-layout";
import { VendorLink } from "@web/vendor/components/vendor-link";
import { vendorErrorKey } from "@web/vendor/lib/vendor-api-error";
import { vendorPath } from "@web/vendor/lib/route";
import { useForgotPassword } from "@web/vendor/queries";

export function ForgotPage({ navigate }: { readonly navigate: (to: string) => void }): JSX.Element {
  const { t, i18n } = useTranslation();
  const forgot = useForgotPassword();
  const [email, setEmail] = useState("");

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    forgot.mutate({
      email,
      language: languageCodeSchema.catch(DEFAULT_LANGUAGE).parse(i18n.language),
    });
  };

  const back = (
    <VendorLink
      to={vendorPath({ kind: "login" })}
      navigate={navigate}
      className="self-center text-label text-primary-700 hover:underline"
    >
      {t("vendor.forgot.back")}
    </VendorLink>
  );

  return (
    <AuthLayout>
      {forgot.isSuccess ? (
        <div
          className="flex flex-col items-center gap-4 text-center"
          data-testid="vendor-forgot-sent"
        >
          <span className="grid size-12 place-items-center rounded-full bg-success-50 text-success-700">
            <Icon name="mail" className="size-6" />
          </span>
          <h2 className="text-title font-extrabold text-ink">{t("vendor.forgot.sentTitle")}</h2>
          <p className="text-label text-ink-muted">{t("vendor.forgot.sentBody", { email })}</p>
          {back}
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-5" data-testid="vendor-forgot">
          <div className="flex flex-col gap-1 text-center">
            <h2 className="text-title font-extrabold text-ink">{t("vendor.forgot.title")}</h2>
            <p className="text-label text-ink-muted">{t("vendor.forgot.subtitle")}</p>
          </div>
          <FormField label="vendor.signIn.email" htmlFor="vendor-forgot-email">
            <Input
              id="vendor-forgot-email"
              type="email"
              dir="ltr"
              autoComplete="username"
              placeholder={t("vendor.signIn.emailPlaceholder")}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </FormField>
          {forgot.isError && (
            <p role="alert" className="text-label text-danger-700">
              {t(vendorErrorKey(forgot.error))}
            </p>
          )}
          <Button
            type="submit"
            isLoading={forgot.isPending}
            icon={<Icon name="send" />}
            className="w-full"
          >
            {t("vendor.forgot.submit")}
          </Button>
          {back}
        </form>
      )}
    </AuthLayout>
  );
}
