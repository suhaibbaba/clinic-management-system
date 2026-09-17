import { zodResolver } from "@hookform/resolvers/zod";
import { setPasswordSchema, type SetPasswordInput } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { Button, FormField, Icon, PasswordInput, PersonName } from "@clinic/ui";
import { Logo } from "@web/components/brand/logo";
import { authApi } from "@web/features/auth/api";
import { BRANDING_SCOPE, useClinicBranding } from "@web/features/clinic/queries";
import { errorMessageKey } from "@web/lib/api-error";
import { useClinicLogo } from "@web/lib/use-clinic-logo";

export function SetPasswordPage({ purpose }: { purpose: "activate" | "reset" }): JSX.Element {
  const { t } = useTranslation();
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const branding = useClinicBranding();
  const logoUrl = useClinicLogo(BRANDING_SCOPE, branding.data?.logoUrl);
  const [formErrorKey, setFormErrorKey] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetPasswordInput>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { token },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormErrorKey(null);

    try {
      await authApi.setPassword(values);
      setDone(true);
    } catch (error) {
      setFormErrorKey(errorMessageKey(error));
    }
  });

  return (
    <main className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md border border-line rounded-card bg-surface p-8 shadow-card">
        <Logo size="login" src={logoUrl} name={branding.data?.name} className="mb-6" />

        {branding.data?.name && (
          <p className="mb-1 text-value font-medium text-ink-muted">
            <PersonName name={branding.data.name} fallback="" />
          </p>
        )}

        <h1 className="text-title font-medium text-primary-900">
          {t(purpose === "activate" ? "auth.activateTitle" : "auth.resetTitle")}
        </h1>

        {done ? (
          <>
            <p className="mt-1 text-value text-ink-muted">{t("auth.passwordSet")}</p>
            <Button
              className="mt-6 w-full"
              icon={<Icon name="login" />}
              onClick={() => navigate("/login")}
            >
              {t("auth.toLogin")}
            </Button>
          </>
        ) : (
          <>
            <p className="mt-1 text-value text-ink-muted">{t("auth.setPasswordSubtitle")}</p>

            <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
              <FormField
                label="auth.newPassword"
                htmlFor="new-password"
                error={errors.password}
                errorKey={errors.password ? "errors.validation.passwordMin" : undefined}
              >
                <PasswordInput
                  placeholder={t("common.placeholders.password")}
                  id="new-password"
                  autoComplete="new-password"
                  hasError={errors.password !== undefined}
                  {...register("password")}
                />
              </FormField>

              {formErrorKey !== null && (
                <p
                  role="alert"
                  className="rounded-panel bg-danger-50 px-3.5 py-2.5 text-value text-danger-700"
                >
                  {t(formErrorKey)}
                </p>
              )}

              <Button
                icon={<Icon name="check" />}
                type="submit"
                isLoading={isSubmitting}
                className="mt-2 w-full"
              >
                {isSubmitting ? t("auth.submitting") : t("auth.setPassword")}
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
