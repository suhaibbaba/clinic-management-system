import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@clinic/shared';
import { useState, type JSX } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button, FormField, Icon, Input, PersonName } from '@clinic/ui';
import { Logo } from '@web/components/brand/logo';
import { authApi } from '@web/features/auth/api';
import { BRANDING_SCOPE, useClinicBranding } from '@web/features/clinic/queries';
import { useClinicLogo } from '@web/lib/use-clinic-logo';

export function ForgotPasswordPage(): JSX.Element {
  const { t } = useTranslation();
  const branding = useClinicBranding();
  const logoUrl = useClinicLogo(BRANDING_SCOPE, branding.data?.logoUrl);
  const navigate = useNavigate();
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  // Always the same answer, and no error path: whether an address has an account here is not
  // something an anonymous form may reveal, including by failing differently.
  const onSubmit = handleSubmit(async (values) => {
    await authApi.forgotPassword(values).catch(() => undefined);
    setSent(true);
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

        <h1 className="text-title font-medium text-primary-900">{t('auth.forgotTitle')}</h1>

        {sent ? (
          <>
            <p className="mt-1 text-value text-ink-muted">{t('auth.forgotSent')}</p>
            <Button
              className="mt-6 w-full"
              variant="secondary"
              icon={<Icon name="login" />}
              onClick={() => navigate('/login')}
            >
              {t('auth.toLogin')}
            </Button>
          </>
        ) : (
          <>
            <p className="mt-1 text-value text-ink-muted">{t('auth.forgotSubtitle')}</p>

            <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
              <FormField
                label="auth.identifier"
                htmlFor="forgot-identifier"
                error={errors.identifier}
              >
                <Input
                  placeholder={t('common.placeholders.identifier')}
                  adornment="user"
                  id="forgot-identifier"
                  autoComplete="username"
                  hasError={errors.identifier !== undefined}
                  {...register('identifier')}
                />
              </FormField>

              <Button
                icon={<Icon name="mail" />}
                type="submit"
                isLoading={isSubmitting}
                className="mt-2 w-full"
              >
                {isSubmitting ? t('auth.submitting') : t('auth.forgotSubmit')}
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
