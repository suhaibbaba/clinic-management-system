import { zodResolver } from "@hookform/resolvers/zod";
import {
  LOGIN_CODE_LENGTH,
  requestLoginCodeSchema,
  verifyLoginCodeSchema,
  type RequestLoginCodeInput,
  type VerifyLoginCodeInput,
} from "@clinic/shared";
import { useState, type JSX } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button, FormField, Icon, Input, PersonName } from "@clinic/ui";
import { Logo } from "@web/shared/components/brand/logo";
import { authApi } from "@web/shared/api/auth";
import { ApiError, errorMessageKey } from "@web/shared/lib/api-error";
import { useSession } from "@web/shared/providers/session";
import { BRANDING_SCOPE, useClinicBranding } from "@web/shared/queries/clinic";
import { useClinicLogo } from "@web/shared/hooks/use-clinic-logo";
import { useCountdown } from "@web/modules/auth/hooks/use-countdown";
import { LOGIN_CODE_RESEND_SECONDS } from "@web/modules/auth/constants";
import { ellipsis } from "@web/i18n/ellipsis";

interface LocationState {
  from?: string;
}

export function LoginCodePage(): JSX.Element {
  const { t } = useTranslation();
  const { status, loginWithCode } = useSession();
  const branding = useClinicBranding();
  const logoUrl = useClinicLogo(BRANDING_SCOPE, branding.data?.logoUrl);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from;
  const [email, setEmail] = useState<string | null>(null);
  const [formErrorKey, setFormErrorKey] = useState<string | null>(null);
  const resend = useCountdown();

  const emailForm = useForm<RequestLoginCodeInput>({
    resolver: zodResolver(requestLoginCodeSchema),
    defaultValues: { email: "" },
  });

  const codeForm = useForm<VerifyLoginCodeInput>({
    resolver: zodResolver(verifyLoginCodeSchema),
    defaultValues: { email: "", code: "" },
  });

  if (status === "authenticated") {
    return <Navigate to={from ?? "/"} replace />;
  }

  const send = async (to: string): Promise<void> => {
    setFormErrorKey(null);

    try {
      await authApi.requestLoginCode({ email: to });
    } catch (error) {
      setFormErrorKey(errorMessageKey(error));
      return;
    }

    setEmail(to);
    codeForm.reset({ email: to, code: "" });
    resend.start(LOGIN_CODE_RESEND_SECONDS);
  };

  const onRequest = emailForm.handleSubmit((values) => send(values.email));

  const onVerify = codeForm.handleSubmit(async (values) => {
    setFormErrorKey(null);

    try {
      await loginWithCode(values);
      void navigate(from ?? "/", { replace: true });
    } catch (error) {
      setFormErrorKey(
        error instanceof ApiError && error.statusCode === 401
          ? "errors.auth.codeInvalid"
          : errorMessageKey(error),
      );
      codeForm.setValue("code", "");
    }
  });

  const codeField = codeForm.register("code", {
    setValueAs: (value: string) => value.replace(/\D/g, "").slice(0, LOGIN_CODE_LENGTH),
    onChange: (event: { target: { value: string } }) => {
      if (event.target.value.replace(/\D/g, "").length === LOGIN_CODE_LENGTH) {
        void onVerify();
      }
    },
  });

  const submitting = emailForm.formState.isSubmitting || codeForm.formState.isSubmitting;

  return (
    <main
      data-testid="login-code-page"
      className="flex min-h-full items-center justify-center px-4 py-12"
    >
      <div className="w-full max-w-md border border-line rounded-card bg-surface p-8 shadow-card">
        <Logo
          size="login"
          src={logoUrl}
          name={branding.data?.name}
          data-testid="login-code-logo"
          className="mb-6"
        />

        {branding.data?.name && (
          <p className="mb-1 text-value font-medium text-ink-muted">
            <PersonName name={branding.data.name} fallback="" />
          </p>
        )}

        <h1 data-testid="login-code-title" className="text-title font-medium text-primary-900">
          {t("auth.codeTitle")}
        </h1>

        {email === null ? (
          <>
            <p className="mt-1 text-value text-ink-muted">{t("auth.codeSubtitle")}</p>

            <form
              data-testid="login-code-email-form"
              className="mt-6 flex flex-col gap-4"
              onSubmit={onRequest}
              noValidate
            >
              <FormField
                label="auth.codeEmail"
                htmlFor="login-code-email"
                error={emailForm.formState.errors.email}
              >
                <Input
                  type="email"
                  dir="ltr"
                  adornment="mail"
                  id="login-code-email"
                  data-testid="login-code-email"
                  autoComplete="username"
                  hasError={emailForm.formState.errors.email !== undefined}
                  {...emailForm.register("email")}
                />
              </FormField>

              {formErrorKey !== null && (
                <p
                  role="alert"
                  data-testid="login-code-error"
                  className="rounded-panel bg-danger-50 px-3.5 py-2.5 text-value text-danger-700"
                >
                  {t(formErrorKey)}
                </p>
              )}

              <Button
                icon={<Icon name="mail" />}
                type="submit"
                data-testid="login-code-send"
                isLoading={submitting}
                className="mt-2 w-full"
              >
                {submitting ? ellipsis(t("auth.submitting")) : t("auth.codeSend")}
              </Button>
            </form>
          </>
        ) : (
          <>
            <p data-testid="login-code-sent" className="mt-1 text-value text-ink-muted">
              {t("auth.codeSentTo")}
              <bdi dir="ltr" className="font-medium text-ink">
                {email}
              </bdi>
            </p>

            <form
              data-testid="login-code-verify-form"
              className="mt-6 flex flex-col gap-4"
              onSubmit={onVerify}
              noValidate
            >
              <FormField
                label="auth.code"
                htmlFor="login-code-code"
                error={codeForm.formState.errors.code}
              >
                <Input
                  dir="ltr"
                  adornment="key"
                  id="login-code-code"
                  data-testid="login-code-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={LOGIN_CODE_LENGTH}
                  className="tabular-nums tracking-widest"
                  hasError={codeForm.formState.errors.code !== undefined}
                  {...codeField}
                />
              </FormField>

              {formErrorKey !== null && (
                <p
                  role="alert"
                  data-testid="login-code-error"
                  className="rounded-panel bg-danger-50 px-3.5 py-2.5 text-value text-danger-700"
                >
                  {t(formErrorKey)}
                </p>
              )}

              <Button
                icon={<Icon name="login" />}
                type="submit"
                data-testid="login-code-verify"
                isLoading={submitting}
                className="mt-2 w-full"
              >
                {submitting ? ellipsis(t("auth.submitting")) : t("auth.codeVerify")}
              </Button>

              {resend.seconds > 0 ? (
                <p
                  data-testid="login-code-resend-timer"
                  aria-live="polite"
                  className="text-center text-label text-ink-muted"
                >
                  {t("auth.codeResendIn", { seconds: resend.seconds })}
                </p>
              ) : (
                <Button
                  variant="secondary"
                  icon={<Icon name="send" />}
                  data-testid="login-code-resend"
                  disabled={submitting}
                  className="w-full"
                  onClick={() => void send(email)}
                >
                  {t("auth.codeResend")}
                </Button>
              )}

              <button
                type="button"
                data-testid="login-code-change-email"
                className="self-center text-label text-primary-600 underline underline-offset-4 hover:text-primary-700"
                onClick={() => {
                  setEmail(null);
                  setFormErrorKey(null);
                }}
              >
                {t("auth.codeChangeEmail")}
              </button>
            </form>
          </>
        )}

        <Link
          to="/login"
          state={location.state}
          data-testid="login-code-password-link"
          className="mt-4 block text-center text-label text-primary-600 underline underline-offset-4 hover:text-primary-700"
        >
          {t("auth.withPassword")}
        </Link>
      </div>
    </main>
  );
}
