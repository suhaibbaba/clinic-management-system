import { zodResolver } from "@hookform/resolvers/zod";
import {
  createVisitingDoctorSchema,
  type CreateVisitingDoctorInput,
  type Doctor,
} from "@clinic/shared";
import { useEffect, type JSX } from "react";
import { Controller, useForm, type UseFormRegister } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button, FormField, Icon, Input, Modal, PhoneInput, useToast } from "@clinic/ui";
import { useCreateVisitingDoctor } from "@web/features/doctors/queries";
import { StaffNameFields, type StaffNameValues } from "@web/features/users/staff-name-fields";
import { ellipsis } from "@web/i18n/ellipsis";
import { errorMessageKey } from "@web/lib/api-error";

interface VisitingDoctorModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCreated: (doctor: Doctor) => void;
}

const FORM_ID = "visiting-doctor-form";

const EMPTY: CreateVisitingDoctorInput = {
  firstName: { ar: "", en: "" },
  lastName: { ar: "", en: "" },
  phone: "",
  email: null,
};

export function VisitingDoctorModal({
  open,
  onOpenChange,
  onCreated,
}: VisitingDoctorModalProps): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const create = useCreateVisitingDoctor();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateVisitingDoctorInput>({
    resolver: zodResolver(createVisitingDoctorSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (open) {
      reset(EMPTY);
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const doctor = await create.mutateAsync(values);
      toast.success("doctors.visiting.created");
      onCreated(doctor);
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  });

  return (
    <Modal
      data-testid="visiting-doctor-modal"
      open={open}
      onOpenChange={onOpenChange}
      title="doctors.visiting.create"
      description="doctors.visiting.about"
      footer={
        <>
          <Button
            icon={<Icon name="x" />}
            variant="secondary"
            data-testid="visiting-doctor-cancel"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            icon={<Icon name="check" />}
            type="submit"
            form={FORM_ID}
            data-testid="visiting-doctor-save"
            isLoading={isSubmitting}
          >
            {isSubmitting ? ellipsis(t("common.saving")) : t("common.save")}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        className="flex flex-col gap-4"
        onSubmit={(event) => void onSubmit(event)}
        noValidate
      >
        <StaffNameFields
          prefix="visiting-doctor"
          register={register as unknown as UseFormRegister<StaffNameValues>}
          errors={errors}
        />

        <FormField
          label="users.phone"
          htmlFor="visiting-doctor-phone"
          error={errors.phone}
          errorKey={errors.phone ? "errors.validation.invalidPhone" : undefined}
        >
          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <PhoneInput
                placeholder={t("common.placeholders.phone")}
                id="visiting-doctor-phone"
                data-testid="visiting-doctor-field-phone"
                hasError={errors.phone !== undefined}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </FormField>

        <FormField
          label="users.email"
          htmlFor="visiting-doctor-email"
          hint="doctors.visiting.emailHint"
          optional
          error={errors.email}
          errorKey={errors.email ? "errors.validation.invalidEmail" : undefined}
        >
          <Input
            placeholder={t("common.placeholders.email")}
            adornment="mail"
            id="visiting-doctor-email"
            data-testid="visiting-doctor-field-email"
            type="email"
            hasError={errors.email !== undefined}
            {...register("email", { setValueAs: (value: string) => (value === "" ? null : value) })}
          />
        </FormField>
      </form>
    </Modal>
  );
}
