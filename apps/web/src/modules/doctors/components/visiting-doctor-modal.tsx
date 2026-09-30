import { zodResolver } from "@hookform/resolvers/zod";
import {
  createVisitingDoctorSchema,
  type CreateVisitingDoctorInput,
  type Doctor,
} from "@clinic/shared";
import { useEffect, type JSX } from "react";
import { Controller, useForm, type UseFormRegister } from "react-hook-form";
import { revealFirstError } from "@web/shared/lib/form-errors";
import { useTranslation } from "react-i18next";
import {
  Button,
  FormField,
  Icon,
  Input,
  Modal,
  PhoneInput,
  QuantityInput,
  Select,
  useToast,
} from "@clinic/ui";
import { WorkingHours } from "@web/shared/components/working-hours";
import { useCreateVisitingDoctor, useSpecialties } from "@web/modules/doctors/queries";
import { StaffNameFields, type StaffNameValues } from "@web/shared/components/staff-name-fields";
import { ellipsis } from "@web/i18n/ellipsis";
import { errorToast } from "@web/shared/lib/api-error";
import { EMPTY_VISITING_DOCTOR, VISITING_DOCTOR_FORM_ID } from "@web/modules/doctors/constants";

interface VisitingDoctorModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCreated: (doctor: Doctor) => void;
}

export function VisitingDoctorModal({
  open,
  onOpenChange,
  onCreated,
}: VisitingDoctorModalProps): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const create = useCreateVisitingDoctor();
  const specialties = useSpecialties();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting, isValid },
  } = useForm<CreateVisitingDoctorInput>({
    mode: "onTouched",
    resolver: zodResolver(createVisitingDoctorSchema),
    defaultValues: EMPTY_VISITING_DOCTOR,
  });

  useEffect(() => {
    if (open) {
      reset(EMPTY_VISITING_DOCTOR);
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(
    async (values) => {
      try {
        const doctor = await create.mutateAsync(values);
        toast.success("doctors.visiting.created");
        onCreated(doctor);
        onOpenChange(false);
      } catch (error) {
        toast.error(...errorToast(error));
      }
    },
    () => revealFirstError(),
  );

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
            aria-disabled={!isValid || isSubmitting || undefined}
            form={VISITING_DOCTOR_FORM_ID}
            data-testid="visiting-doctor-save"
            isLoading={isSubmitting}
          >
            {isSubmitting ? ellipsis(t("common.saving")) : t("common.save")}
          </Button>
        </>
      }
    >
      <form
        id={VISITING_DOCTOR_FORM_ID}
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

        <Controller
          name="specialtyId"
          control={control}
          render={({ field }) => (
            <div onBlur={field.onBlur}>
              <FormField
                label="doctors.specialty"
                htmlFor="visiting-doctor-specialty"
                error={errors.specialtyId}
                required
              >
                <Select
                  id="visiting-doctor-specialty"
                  data-testid="visiting-doctor-field-specialty"
                  placeholder={t("doctors.selectSpecialty")}
                  value={field.value}
                  onChange={(event) => field.onChange(event.target.value)}
                  options={(specialties.data?.items ?? []).map((specialty) => ({
                    value: specialty.id,
                    label: specialty.name,
                  }))}
                />
              </FormField>
            </div>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="doctors.duration"
            htmlFor="visiting-doctor-duration"
            hint="doctors.durationUnit"
            error={errors.defaultAppointmentDurationMinutes}
          >
            <Controller
              name="defaultAppointmentDurationMinutes"
              control={control}
              render={({ field }) => (
                <QuantityInput
                  id="visiting-doctor-duration"
                  data-testid="visiting-doctor-field-duration"
                  value={Number.isNaN(field.value) ? "" : String(field.value)}
                  onChange={(event) =>
                    field.onChange(
                      event.target.value === "" ? Number.NaN : Number(event.target.value),
                    )
                  }
                  onBlur={field.onBlur}
                />
              )}
            />
          </FormField>

          <FormField
            label="doctors.visiting.clinicShare"
            htmlFor="visiting-doctor-share"
            hint="doctors.visiting.clinicShareHint"
            error={errors.clinicSharePercent}
          >
            <Controller
              name="clinicSharePercent"
              control={control}
              render={({ field }) => (
                <QuantityInput
                  id="visiting-doctor-share"
                  data-testid="visiting-doctor-field-share"
                  value={Number.isNaN(field.value) ? "" : String(field.value)}
                  onChange={(event) =>
                    field.onChange(
                      event.target.value === "" ? Number.NaN : Number(event.target.value),
                    )
                  }
                  onBlur={field.onBlur}
                />
              )}
            />
          </FormField>
        </div>

        <div>
          <p className="text-value font-medium text-ink">{t("doctors.schedule")}</p>
          <p className="mb-2 text-label text-ink-muted">{t("doctors.visiting.scheduleHint")}</p>
          <Controller
            name="weeklySchedule"
            control={control}
            render={({ field }) => (
              <WorkingHours
                value={field.value}
                onChange={field.onChange}
                idPrefix="visiting-doctor-hours"
              />
            )}
          />
        </div>
      </form>
    </Modal>
  );
}
