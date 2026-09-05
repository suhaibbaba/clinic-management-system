import { zodResolver } from '@hookform/resolvers/zod';
import {
  createUserSchema,
  updateUserSchema,
  USER_ROLES,
  type CreateUserInput,
  type UpdateUserInput,
  type User,
} from '@clinic/shared';
import { useEffect, type JSX } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button, FormField, Icon, Input, Select, useToast } from '@web/components/ui';
import { useCreateUser, useUpdateUser } from '@web/features/users/queries';
import { errorMessageKey } from '@web/lib/api-error';
import { Modal } from '@web/components/ui/modal';

interface UserFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null creates a user; a row edits it. */
  user: User | null;
}

type FormValues = CreateUserInput & { password?: string };

export function UserFormModal({ open, onOpenChange, user }: UserFormModalProps): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const isEdit = user !== null;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    // Editing never touches the password, so the two modes validate differently.
    resolver: zodResolver(isEdit ? updateUserSchema : createUserSchema) as never,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    reset(
      user
        ? {
            name: user.name,
            phone: user.phone,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
          }
        : // `role` is deliberately absent so the select starts on its placeholder.
          { name: '', phone: '', email: null, isActive: true, password: '' },
    );
  }, [open, user, reset]);

  const roleOptions = USER_ROLES.map((role) => ({ value: role, label: t(`roles.${role}`) }));

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (user) {
        const body: UpdateUserInput = {
          name: values.name,
          phone: values.phone,
          email: values.email ?? null,
          role: values.role,
        };
        await updateUser.mutateAsync({ id: user.id, body });
        toast.success('users.updated');
      } else {
        await createUser.mutateAsync(values as CreateUserInput);
        toast.success('users.created');
      }

      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'users.edit' : 'users.create'}
      footer={
        <>
          <Button icon={<Icon name="x" />} variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            icon={<Icon name="check" />}
            form="user-form"
            type="submit"
            isLoading={isSubmitting}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="user-form" className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <FormField label="users.name" htmlFor="user-name" error={errors.name}>
          <Input
            placeholder={t('common.placeholders.fullName')}
            adornment="user"
            id="user-name"
            hasError={errors.name !== undefined}
            {...register('name')}
          />
        </FormField>

        <FormField label="users.phone" htmlFor="user-phone" error={errors.phone}>
          <Input
            placeholder={t('common.placeholders.phone')}
            adornment="phone"
            id="user-phone"
            inputMode="tel"
            hasError={errors.phone !== undefined}
            {...register('phone')}
          />
        </FormField>

        <FormField
          label="users.email"
          htmlFor="user-email"
          optional
          error={errors.email}
          errorKey={errors.email ? 'errors.validation.invalidEmail' : undefined}
        >
          <Input
            placeholder={t('common.placeholders.email')}
            adornment="mail"
            id="user-email"
            type="email"
            hasError={errors.email !== undefined}
            // An untouched optional field must clear the value, not fail
            // `z.email()` — `setValueAs` runs before the resolver.
            {...register('email', { setValueAs: (value: string) => (value === '' ? null : value) })}
          />
        </FormField>

        <FormField label="users.role" htmlFor="user-role" error={errors.role}>
          <Select
            id="user-role"
            options={roleOptions}
            placeholder={t('users.filterRole')}
            hasError={errors.role !== undefined}
            {...register('role')}
          />
        </FormField>

        {!isEdit && (
          <FormField
            label="users.password"
            htmlFor="user-password"
            error={errors.password}
            errorKey={errors.password ? 'errors.validation.passwordMin' : undefined}
          >
            <Input
              placeholder={t('common.placeholders.password')}
              id="user-password"
              type="password"
              autoComplete="new-password"
              hasError={errors.password !== undefined}
              {...register('password')}
            />
          </FormField>
        )}
      </form>
    </Modal>
  );
}
