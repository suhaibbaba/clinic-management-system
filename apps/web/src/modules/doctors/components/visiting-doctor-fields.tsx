import type { JSX } from "react";
import { Controller, type UseFormRegister } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FormField, Input, PhoneInput, QuantityInput, Select } from "@clinic/ui";
import { WorkingHours } from "@web/shared/components/working-hours";
import { useSpecialties } from "@web/modules/doctors/queries";
import { StaffNameFields, type StaffNameValues } from "@web/shared/components/staff-name-fields";
import { VISITING_DOCTOR_FORM_ID } from "@web/modules/doctors/constants";
import type { VisitingDoctorForm } from "@web/modules/doctors/hooks/use-visiting-doctor-form";

export function VisitingDoctorFields({ form, submit }: VisitingDoctorForm): JSX.Element {
  const { t } = useTranslation();
  const specialties = useSpecialties();
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <form
      id={VISITING_DOCTOR_FORM_ID}
      className="flex flex-col gap-4"
      onSubmit={(event) => void submit(event)}
      noValidate
    >
      <p className="text-label text-ink-muted">{t("doctors.visiting.about")}</p>

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
  );
}
