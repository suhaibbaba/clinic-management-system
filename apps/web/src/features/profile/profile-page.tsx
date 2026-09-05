import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema, type ChangePasswordInput } from '@clinic/shared';
import type { JSX } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Badge, Button, FormField, Input, PageHeader, useToast } from '@web/components/ui';
import { authApi } from '@web/features/auth/api';
import { useSession } from '@web/features/auth/session';
import { ApiError, errorMessageKey } from '@web/lib/api-error';

/** Own profile and password — available to every role. */
export function ProfilePage(): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const { user, logout } = useSession();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await authApi.changePassword(values);
      reset();
      toast.success('profile.passwordChanged');
      // The API revokes every session on a password change, so sign out here too.
      await logout();
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.statusCode === 401
          ? 'auth.invalidCredentials'
          : errorMessageKey(error),
      );
    }
  });

  return (
    <>
      <PageHeader title="profile.title" subtitle="profile.subtitle" />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-medium text-gray-800">{t('profile.details')}</h2>

          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-gray-500">{t('users.name')}</dt>
            <dd className="font-medium text-gray-900">{user?.name}</dd>

            <dt className="text-gray-500">{t('users.phone')}</dt>
            <dd className="font-medium text-gray-900">{user?.phone}</dd>

            <dt className="text-gray-500">{t('users.email')}</dt>
            <dd className="font-medium text-gray-900">{user?.email ?? '—'}</dd>

            <dt className="text-gray-500">{t('users.role')}</dt>
            <dd>{user && <Badge tone="info">{t(`roles.${user.role}`)}</Badge>}</dd>
          </dl>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-medium text-gray-800">{t('profile.changePassword')}</h2>

          <form className="mt-3 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            <FormField
              label="profile.currentPassword"
              htmlFor="current-password"
              error={errors.currentPassword}
              errorKey={errors.currentPassword ? 'errors.validation.passwordMin' : undefined}
            >
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                hasError={errors.currentPassword !== undefined}
                {...register('currentPassword')}
              />
            </FormField>

            <FormField
              label="profile.newPassword"
              htmlFor="new-password"
              error={errors.newPassword}
              errorKey={
                errors.newPassword?.type === 'custom'
                  ? 'errors.validation.passwordSame'
                  : errors.newPassword
                    ? 'errors.validation.passwordMin'
                    : undefined
              }
            >
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                hasError={errors.newPassword !== undefined}
                {...register('newPassword')}
              />
            </FormField>

            <Button type="submit" isLoading={isSubmitting} className="self-start">
              {t('profile.changePassword')}
            </Button>
          </form>
        </section>
      </div>
    </>
  );
}
