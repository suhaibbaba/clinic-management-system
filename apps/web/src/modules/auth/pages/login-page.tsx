import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useForm } from "react-hook-form";
import { revealFirstError } from "@web/shared/lib/form-errors";
import { useTranslation } from "react-i18next";
import { Logo } from "@web/shared/components/brand/logo";
import { useClinicBranding, BRANDING_SCOPE } from "@web/shared/queries/clinic";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button, FormField, Icon, Input, PasswordInput, PersonName } from "@clinic/ui";
import { useSession } from "@web/shared/providers/session";
import { ApiError, errorMessageKey } from "@web/shared/lib/api-error";
import { useClinicLogo } from "@web/shared/hooks/use-clinic-logo";
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
    formState: { errors, isSubmitting, isValid },
  } = useForm<LoginInput>({
    mode: "onTouched",
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  if (status === "authenticated") {
    const from = (location.state as LocationState | null)?.from;
    return <Navigate to={from ?? "/"} replace />;
  }

  const onSubmit = handleSubmit(
    async (values) => {
      setFormErrorKey(null);

      try {
        await login(values);
        const from = (location.state as LocationState | null)?.from;
        void navigate(from ?? "/", { replace: true });
      } catch (error) {
        setFormErrorKey(
          error instanceof ApiError && error.statusCode === 401
            ? "auth.invalidCredentials"
            : errorMessageKey(error),
        );
      }
    },
    () => revealFirstError(),
  );

  return (
    <main
      data-testid="login-page"
      className="flex min-h-full items-center justify-center px-4 py-12"
    >
      <div className="w-full max-w-md border border-line rounded-card bg-surface p-8 shadow-card">
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
            aria-disabled={!isValid || isSubmitting || undefined}
            data-testid="login-submit"
            isLoading={isSubmitting}
            className="mt-2 w-full"
          >
            {isSubmitting ? ellipsis(t("auth.submitting")) : t("auth.submit")}
          </Button>

          <Button
            variant="secondary"
            icon={<Icon name="mail" />}
            data-testid="login-code-link"
            className="w-full"
            onClick={() => void navigate("/login/code", { state: location.state })}
          >
            {t("auth.codeLink")}
          </Button>

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
