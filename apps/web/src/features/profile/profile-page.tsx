import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema, personName, type ChangePasswordInput } from '@clinic/shared';
import type { JSX } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  Avatar,
  Badge,
  Button,
  EmailLink,
  FormField,
  Icon,
  Input,
  PageHeader,
  PersonName,
  PhoneLink,
  useToast,
} from '@web/components/ui';
import { authApi } from '@web/features/auth/api';
import { useSession } from '@web/features/auth/session';
import { ApiError, errorMessageKey } from '@web/lib/api-error';

/** Own profile and password — available to every role. */
export function ProfilePage(): JSX.Element {
  const { t, i18n } = useTranslation();
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

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-card bg-surface shadow-card p-4">
          <h2 className="text-section font-semibold text-ink">{t('profile.details')}</h2>

          {/*
            Read-only here: a staff photo is set by the admin on the users
            screen, which is where accounts are managed (ROLES.md). This is
            where somebody sees the face the rest of the clinic sees.
          */}
          <div className="mt-3 flex items-center gap-3">
            <Avatar
              name={personName(user?.name, i18n.language)}
              tintKey={user?.id ?? ''}
              src={user?.photoUrl}
              className="size-16"
            />
            <PersonName name={user?.name} className="text-value font-medium text-ink" />
          </div>

          {/* The summary box the drawers and the patient file use: a 12px
              caption over the value, two to a row. */}
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-value">
            <div className="min-w-0">
              <dt className="text-meta text-ink-muted">{t('users.name')}</dt>
              <dd className="mt-0.5 font-medium text-ink">
                <PersonName name={user?.name} showBoth />
              </dd>
            </div>

            <div className="min-w-0">
              <dt className="text-meta text-ink-muted">{t('users.phone')}</dt>
              <dd className="mt-0.5 font-medium">
                <PhoneLink value={user?.phone} />
              </dd>
            </div>

            <div className="min-w-0">
              <dt className="text-meta text-ink-muted">{t('users.email')}</dt>
              <dd className="mt-0.5 font-medium">
                <EmailLink value={user?.email} />
              </dd>
            </div>

            <div className="min-w-0">
              <dt className="text-meta text-ink-muted">{t('users.role')}</dt>
              <dd className="mt-0.5">
                {user && <Badge tone="info">{t(`roles.${user.role}`)}</Badge>}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-card bg-surface shadow-card p-4">
          <h2 className="text-section font-semibold text-ink">{t('profile.changePassword')}</h2>

          <form className="mt-3 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            <FormField
              label="profile.currentPassword"
              htmlFor="current-password"
              error={errors.currentPassword}
              errorKey={errors.currentPassword ? 'errors.validation.passwordMin' : undefined}
            >
              <Input
                placeholder={t('common.placeholders.password')}
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
                placeholder={t('common.placeholders.password')}
                id="new-password"
                type="password"
                autoComplete="new-password"
                hasError={errors.newPassword !== undefined}
                {...register('newPassword')}
              />
            </FormField>

            <Button
              icon={<Icon name="key" />}
              type="submit"
              isLoading={isSubmitting}
              className="self-start"
            >
              {t('profile.changePassword')}
            </Button>
          </form>
        </section>
      </div>
    </>
  );
}
