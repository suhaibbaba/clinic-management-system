import { zodResolver } from "@hookform/resolvers/zod";
import {
  updateOwnProfileSchema,
  type AuthenticatedUserProfile,
  type UpdateOwnProfileInput,
} from "@clinic/shared";
import { useEffect, type JSX } from "react";
import { useForm, type UseFormRegister } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button, FormField, Icon, Input, Modal, PhoneInput, useToast } from "@clinic/ui";
import { authApi } from "@web/features/auth/api";
import { useSession } from "@web/features/auth/session";
import { StaffNameFields, type StaffNameValues } from "@web/features/users/staff-name-fields";
import { errorMessageKey } from "@web/lib/api-error";

interface ProfileFormModalProps {
  readonly "data-testid"?: string | undefined;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly user: AuthenticatedUserProfile;
}

/** What somebody may change about themselves. Their role and whether the account is live are the
 *  admin's, and the photo is set with the account, on the users screen. */
export function ProfileFormModal({
  open,
  onOpenChange,
  user,
  "data-testid": testId = "profile-form-modal",
}: ProfileFormModalProps): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const { refreshProfile } = useSession();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateOwnProfileInput>({
    resolver: zodResolver(updateOwnProfileSchema),
  });

  useEffect(() => {
    if (open) {
      reset({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        email: user.email,
      });
    }
  }, [open, user, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await authApi.updateProfile(values);
      await refreshProfile();
      toast.success("profile.updated");
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
      title="profile.edit"
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
            form="profile-form"
            type="submit"
            isLoading={isSubmitting}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <form
        id="profile-form"
        data-testid={`${testId}-form`}
        className="flex flex-col gap-4"
        onSubmit={onSubmit}
        noValidate
      >
        <StaffNameFields
          prefix="profile"
          register={register as unknown as UseFormRegister<StaffNameValues>}
          errors={errors}
        />

        <FormField
          label="users.phone"
          htmlFor="profile-phone"
          hint="profile.identifierHint"
          error={errors.phone}
          errorKey={errors.phone ? "errors.validation.invalidPhone" : undefined}
        >
          <PhoneInput
            placeholder={t("common.placeholders.phone")}
            adornment="phone"
            id="profile-phone"
            data-testid="profile-field-phone"
            hasError={errors.phone !== undefined}
            {...register("phone")}
          />
        </FormField>

        <FormField
          label="users.email"
          htmlFor="profile-email"
          optional
          error={errors.email}
          errorKey={errors.email ? "errors.validation.invalidEmail" : undefined}
        >
          <Input
            placeholder={t("common.placeholders.email")}
            adornment="mail"
            id="profile-email"
            data-testid="profile-field-email"
            type="email"
            hasError={errors.email !== undefined}
            {...register("email", { setValueAs: (value: string) => (value === "" ? null : value) })}
          />
        </FormField>
      </form>
    </Modal>
  );
}
