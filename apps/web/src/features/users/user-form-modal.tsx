import { zodResolver } from "@hookform/resolvers/zod";
import {
  createUserSchema,
  updateUserSchema,
  USER_ROLES,
  type CreateUserInput,
  type UpdateUserInput,
  type User,
} from "@clinic/shared";
import { useEffect, type JSX } from "react";
import { Controller, useForm, type UseFormRegister } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  Button,
  FormField,
  Icon,
  Input,
  PasswordInput,
  PhoneInput,
  Select,
  useToast,
} from "@clinic/ui";
import { useCreateUser, useUpdateUser } from "@web/features/users/queries";
import { StaffNameFields, type StaffNameValues } from "@web/features/users/staff-name-fields";
import { UserPhotoField } from "@web/features/users/user-photo-field";
import { errorMessageKey } from "@web/lib/api-error";
import { Modal } from "@clinic/ui/components/modal";

interface UserFormModalProps {
  "data-testid"?: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

type FormValues = CreateUserInput & { password?: string };

export function UserFormModal({
  open,
  onOpenChange,
  user,
  "data-testid": testId = "user-form-modal",
}: UserFormModalProps): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const isEdit = user !== null;

  const {
    watch,
    register,
    handleSubmit,
    reset,
    control,
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
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
          }
        : // `role` is deliberately absent so the select starts on its placeholder.
          {
            firstName: { ar: "", en: "" },
            lastName: { ar: "", en: "" },
            phone: "",
            email: null,
            isActive: true,
            password: "",
          },
    );
  }, [open, user, reset]);

  const roleOptions = USER_ROLES.map((role) => ({ value: role, label: t(`roles.${role}`) }));

  const email = watch("email")?.trim() ?? "";

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (user) {
        const body: UpdateUserInput = {
          firstName: values.firstName,
          lastName: values.lastName,
          phone: values.phone,
          email: values.email ?? null,
          role: values.role,
        };
        await updateUser.mutateAsync({ id: user.id, body });
        toast.success("users.updated");
      } else {
        await createUser.mutateAsync(values as CreateUserInput);
        toast.success("users.created");
      }

      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  });

  return (
    <Modal
      data-testid={testId}
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "users.edit" : "users.create"}
      footer={
        <>
          <Button
            icon={<Icon name="x" />}
            variant="secondary"
            data-testid={`${testId}-cancel`}
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            icon={<Icon name="check" />}
            data-testid={`${testId}-save`}
            form="user-form"
            type="submit"
            isLoading={isSubmitting}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <form
        id="user-form"
        data-testid={`${testId}-form`}
        className="flex flex-col gap-4"
        onSubmit={onSubmit}
        noValidate
      >
        {/* Outside the form's fields: the photo has already left the browser by the time "save" is
            pressed, and there is no id to address until the user exists. */}
        {user && <UserPhotoField user={user} />}

        <StaffNameFields
          prefix="user"
          register={register as unknown as UseFormRegister<StaffNameValues>}
          errors={errors}
        />

        <FormField
          label="users.phone"
          htmlFor="user-phone"
          error={errors.phone}
          errorKey={errors.phone ? "errors.validation.invalidPhone" : undefined}
        >
          <PhoneInput
            placeholder={t("common.placeholders.phone")}
            adornment="phone"
            id="user-phone"
            data-testid="user-field-phone"
            hasError={errors.phone !== undefined}
            {...register("phone")}
          />
        </FormField>

        <FormField
          label="users.email"
          htmlFor="user-email"
          optional
          error={errors.email}
          errorKey={errors.email ? "errors.validation.invalidEmail" : undefined}
        >
          <Input
            placeholder={t("common.placeholders.email")}
            adornment="mail"
            id="user-email"
            data-testid="user-field-email"
            type="email"
            hasError={errors.email !== undefined}
            // An untouched optional field must clear the value, not fail
            // `z.email()` — `setValueAs` runs before the resolver.
            {...register("email", { setValueAs: (value: string) => (value === "" ? null : value) })}
          />
        </FormField>

        <FormField label="users.role" htmlFor="user-role" error={errors.role}>
          <Controller
            name="role"
            control={control}
            render={({ field }) => (
              <Select
                id="user-role"
                data-testid="user-field-role"
                options={roleOptions}
                placeholder={t("users.selectRole")}
                hasError={errors.role !== undefined}
                value={field.value ?? ""}
                onBlur={field.onBlur}
                onChange={(event) => field.onChange(event.target.value)}
              />
            )}
          />
        </FormField>

        {/* With an address, the account is activated by the person it belongs to: they get a link
            and choose a password nobody else ever knows. Without one there is no link to send, so
            the admin still has to set something and hand it over. */}
        {!isEdit &&
          (email ? (
            <p
              data-testid="user-will-be-invited"
              className="rounded-panel border border-primary-200 bg-primary-50 px-3.5 py-2.5 text-label text-primary-900"
            >
              {t("users.willBeInvited", { email })}
            </p>
          ) : (
            <FormField
              label="users.password"
              htmlFor="user-password"
              hint="users.passwordNoEmail"
              error={errors.password}
              errorKey={errors.password ? "errors.validation.passwordMin" : undefined}
            >
              <PasswordInput
                placeholder={t("common.placeholders.password")}
                id="user-password"
                data-testid="user-field-password"
                autoComplete="new-password"
                hasError={errors.password !== undefined}
                {...register("password")}
              />
            </FormField>
          ))}
      </form>
    </Modal>
  );
}
