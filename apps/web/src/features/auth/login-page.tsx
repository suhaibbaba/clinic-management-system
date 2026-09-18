import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Logo } from "@web/components/brand/logo";
import { useClinicBranding, BRANDING_SCOPE } from "@web/features/clinic/queries";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button, FormField, Icon, Input, PasswordInput, PersonName } from "@clinic/ui";
import { useSession } from "@web/features/auth/session";
import { ApiError, errorMessageKey } from "@web/lib/api-error";
import { useClinicLogo } from "@web/lib/use-clinic-logo";
import { ellipsis } from "@web/i18n/ellipsis";

interface LocationState {
  from?: string;
}

export function LoginPage(): JSX.Element {
  const { t } = useTranslation();
  const { status, login } = useSession();
  const branding = useClinicBranding();
  const logoUrl = useClinicLogo(BRANDING_SCOPE, branding.data?.logoUrl);
  const navigate = useNavigate();
  const location = useLocation();
  const [formErrorKey, setFormErrorKey] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  if (status === "authenticated") {
    const from = (location.state as LocationState | null)?.from;
    return <Navigate to={from ?? "/"} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormErrorKey(null);

    try {
      await login(values);
      const from = (location.state as LocationState | null)?.from;
      void navigate(from ?? "/", { replace: true });
    } catch (error) {
      // 401 here means the credentials were wrong, not that a session lapsed.
      setFormErrorKey(
        error instanceof ApiError && error.statusCode === 401
          ? "auth.invalidCredentials"
          : errorMessageKey(error),
      );
    }
  });

  return (
    <main
      data-testid="login-page"
      className="flex min-h-full items-center justify-center px-4 py-12"
    >
      <div className="w-full max-w-md border border-line rounded-card bg-surface p-8 shadow-card">
        {/* The one place the mark is shown at size; the clinic name sits in the
            heading below it, so the mark itself is decorative. */}
        <Logo
          size="login"
          src={logoUrl}
          name={branding.data?.name}
          data-testid="login-logo"
          className="mb-6"
        />

        {branding.data?.name && (
          <p className="mb-1 text-value font-medium text-ink-muted">
            <PersonName name={branding.data.name} fallback="" />
          </p>
        )}

        <h1 data-testid="login-title" className="text-title font-medium text-primary-900">
          {t("auth.loginTitle")}
        </h1>
        <p className="mt-1 text-value text-ink-muted">{t("auth.loginSubtitle")}</p>

        <form
          data-testid="login-form"
          className="mt-6 flex flex-col gap-4"
          onSubmit={onSubmit}
          noValidate
        >
          <FormField label="auth.identifier" htmlFor="identifier" error={errors.identifier}>
            <Input
              placeholder={t("common.placeholders.identifier")}
              adornment="user"
              id="identifier"
              data-testid="login-identifier"
              autoComplete="username"
              hasError={errors.identifier !== undefined}
              {...register("identifier")}
            />
          </FormField>

          <FormField
            label="auth.password"
            htmlFor="password"
            error={errors.password}
            errorKey={errors.password ? "errors.validation.passwordMin" : undefined}
          >
            <PasswordInput
              placeholder={t("common.placeholders.password")}
              id="password"
              data-testid="login-password"
              autoComplete="current-password"
              hasError={errors.password !== undefined}
              {...register("password")}
            />
          </FormField>

          {formErrorKey !== null && (
            <p
              role="alert"
              data-testid="login-error"
              className="rounded-panel bg-danger-50 px-3.5 py-2.5 text-value text-danger-700"
            >
              {t(formErrorKey)}
            </p>
          )}

          <Button
            icon={<Icon name="login" />}
            type="submit"
            data-testid="login-submit"
            isLoading={isSubmitting}
            className="mt-2 w-full"
          >
            {isSubmitting ? ellipsis(t("auth.submitting")) : t("auth.submit")}
          </Button>

          {/* Under the button rather than beside the field: it is what you reach for after the
              password has already failed you. */}
          <Link
            to="/forgot-password"
            data-testid="login-forgot-link"
            className="self-center text-label text-primary-600 underline underline-offset-4 hover:text-primary-700"
          >
            {t("auth.forgotLink")}
          </Link>
        </form>
      </div>
    </main>
  );
}
