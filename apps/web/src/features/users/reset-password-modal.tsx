import { zodResolver } from '@hookform/resolvers/zod';
import { resetUserPasswordSchema, type ResetUserPasswordInput, type User } from '@clinic/shared';
import { useEffect, type JSX } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button, FormField, Icon, Input, Modal, useToast } from '@web/components/ui';
import { useResetUserPassword } from '@web/features/users/queries';
import { errorMessageKey } from '@web/lib/api-error';

interface ResetPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

export function ResetPasswordModal({
  open,
  onOpenChange,
  user,
}: ResetPasswordModalProps): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const resetPassword = useResetUserPassword();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResetUserPasswordInput>({
    resolver: zodResolver(resetUserPasswordSchema),
    defaultValues: { newPassword: '' },
  });

  useEffect(() => {
    if (open) {
      reset({ newPassword: '' });
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!user) {
      return;
    }

    try {
      await resetPassword.mutateAsync({ id: user.id, newPassword: values.newPassword });
      toast.success('users.resetPasswordDone');
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="users.resetPasswordFor"
      titleValues={{ name: user?.name ?? '' }}
      footer={
        <>
          <Button icon={<Icon name="x" />} variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            icon={<Icon name="check" />}
            form="reset-password-form"
            type="submit"
            isLoading={isSubmitting}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="reset-password-form" onSubmit={onSubmit} noValidate>
        <FormField
          label="users.newPassword"
          htmlFor="reset-password"
          error={errors.newPassword}
          errorKey={errors.newPassword ? 'errors.validation.passwordMin' : undefined}
        >
          <Input
            placeholder={t('common.placeholders.password')}
            id="reset-password"
            type="password"
            autoComplete="new-password"
            hasError={errors.newPassword !== undefined}
            {...register('newPassword')}
          />
        </FormField>
      </form>
    </Modal>
  );
}
