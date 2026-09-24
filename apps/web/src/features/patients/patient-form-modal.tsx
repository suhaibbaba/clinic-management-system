import { zodResolver } from "@hookform/resolvers/zod";
import {
  createPatientSchema,
  GENDERS,
  type CreatePatientInput,
  type PatientClinicalView,
} from "@clinic/shared";
import { useEffect, type JSX } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  Button,
  DatePicker,
  FormField,
  Icon,
  Input,
  Modal,
  PhoneInput,
  Select,
  useToast,
} from "@clinic/ui";
import { useCreatePatient, useUpdatePatient } from "@web/features/patients/queries";
import { errorMessageKey } from "@web/lib/api-error";
import { ellipsis } from "@web/i18n/ellipsis";

interface PatientFormModalProps {
  "data-testid"?: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: ((patientId: string) => void) | undefined;
  /** Given, the same form edits that record instead of registering a new one. */
  patient?: PatientClinicalView | undefined;
}

export function PatientFormModal({
  open,
  onOpenChange,
  onCreated,
  patient,
  "data-testid": testId = "patient-form-modal",
}: PatientFormModalProps): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const editing = patient !== undefined;
  const createPatient = useCreatePatient();
  const updatePatient = useUpdatePatient(patient?.id ?? "");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    control,
  } = useForm<CreatePatientInput>({ resolver: zodResolver(createPatientSchema) });

  useEffect(() => {
    if (!open) {
      return;
    }

    reset(
      patient
        ? {
            firstName: patient.firstName,
            middleName: patient.middleName,
            lastName: patient.lastName,
            phone: patient.phone,
            whatsapp: patient.whatsapp,
            dateOfBirth: patient.dateOfBirth,
            gender: patient.gender,
            address: patient.address,
            nationalId: patient.nationalId,
            emergencyContactName: patient.emergencyContactName,
            emergencyContactPhone: patient.emergencyContactPhone,
          }
        : { firstName: "", middleName: "", lastName: "", phone: "" },
    );
  }, [open, patient, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (editing) {
        await updatePatient.mutateAsync(values);
        toast.success("patients.updated");
        onOpenChange(false);
        return;
      }

      const created = await createPatient.mutateAsync(values);
      toast.success("patients.created");
      onOpenChange(false);
      onCreated?.(created.id);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  });

  return (
    <Modal
      data-testid={testId}
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "patients.edit" : "patients.create"}
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
            type="submit"
            form="patient-form"
            data-testid={`${testId}-save`}
            isLoading={isSubmitting}
          >
            {isSubmitting ? ellipsis(t("common.saving")) : t("common.save")}
          </Button>
        </>
      }
    >
      <form
        id="patient-form"
        data-testid={`${testId}-form`}
        className="flex flex-col gap-4"
        onSubmit={onSubmit}
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="patients.firstName"
            htmlFor="patient-first-name"
            error={errors.firstName}
          >
            <Input
              placeholder={t("common.placeholders.firstName")}
              adornment="user"
              id="patient-first-name"
              data-testid="patient-field-first-name"
              hasError={Boolean(errors.firstName)}
              {...register("firstName")}
            />
          </FormField>

          <FormField label="patients.lastName" htmlFor="patient-last-name" error={errors.lastName}>
            <Input
              placeholder={t("common.placeholders.lastName")}
              id="patient-last-name"
              data-testid="patient-field-last-name"
              hasError={Boolean(errors.lastName)}
              {...register("lastName")}
            />
          </FormField>
        </div>

        <FormField
          label="patients.middleName"
          htmlFor="patient-middle-name"
          optional
          error={errors.middleName}
        >
          <Input
            placeholder={t("common.placeholders.middleName")}
            id="patient-middle-name"
            data-testid="patient-field-middle-name"
            hasError={Boolean(errors.middleName)}
            {...register("middleName")}
          />
        </FormField>

        <FormField
          label="patients.phone"
          htmlFor="patient-phone"
          error={errors.phone}
          errorKey={errors.phone ? "errors.validation.invalidPhone" : undefined}
        >
          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <PhoneInput
                placeholder={t("common.placeholders.phone")}
                id="patient-phone"
                data-testid="patient-field-phone"
                hasError={Boolean(errors.phone)}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </FormField>

        <FormField
          label="patients.whatsapp"
          htmlFor="patient-whatsapp"
          error={errors.whatsapp}
          errorKey={errors.whatsapp ? "errors.validation.invalidPhone" : undefined}
          hint="patients.whatsappHint"
          optional
        >
          <Controller
            name="whatsapp"
            control={control}
            render={({ field }) => (
              <PhoneInput
                placeholder={t("common.placeholders.phone")}
                id="patient-whatsapp"
                data-testid="patient-field-whatsapp"
                hasError={Boolean(errors.whatsapp)}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </FormField>

        <FormField
          label="patients.dateOfBirth"
          htmlFor="patient-dob"
          error={errors.dateOfBirth}
          optional
        >
          <Controller
            control={control}
            name="dateOfBirth"
            render={({ field }) => (
              <DatePicker
                id="patient-dob"
                data-testid="patient-field-dob"
                startView="years"
                label={t("patients.dateOfBirth")}
                value={field.value ?? ""}
                hasError={errors.dateOfBirth !== undefined}
                onChange={(value) => field.onChange(value === "" ? null : value)}
              />
            )}
          />
        </FormField>

        <FormField label="patients.gender" htmlFor="patient-gender" error={errors.gender} optional>
          {/* `Controller` rather than `register`: the control is Radix's, not
              a native `<select>`, so there is no element for a ref to hold. */}
          <Controller
            name="gender"
            control={control}
            render={({ field }) => (
              <Select
                id="patient-gender"
                data-testid="patient-field-gender"
                placeholder={t("common.none")}
                options={GENDERS.map((gender) => ({
                  value: gender,
                  label: t(`patients.${gender}`),
                }))}
                value={field.value ?? ""}
                onBlur={field.onBlur}
                onChange={(event) => field.onChange(event.target.value || null)}
              />
            )}
          />
        </FormField>

        <FormField
          label="patients.address"
          htmlFor="patient-address"
          error={errors.address}
          optional
        >
          <Input
            placeholder={t("common.placeholders.address")}
            id="patient-address"
            data-testid="patient-field-address"
            {...register("address", { setValueAs: (value) => (value === "" ? null : value) })}
          />
        </FormField>

        <FormField
          label="patients.emergencyContactName"
          htmlFor="patient-emergency-name"
          error={errors.emergencyContactName}
          optional
        >
          <Input
            placeholder={t("common.placeholders.emergencyName")}
            adornment="user"
            id="patient-emergency-name"
            data-testid="patient-field-emergency-name"
            {...register("emergencyContactName", {
              setValueAs: (value) => (value === "" ? null : value),
            })}
          />
        </FormField>

        <FormField
          label="patients.emergencyContactPhone"
          htmlFor="patient-emergency-phone"
          error={errors.emergencyContactPhone}
          optional
        >
          <Controller
            name="emergencyContactPhone"
            control={control}
            render={({ field }) => (
              <PhoneInput
                placeholder={t("common.placeholders.phone")}
                id="patient-emergency-phone"
                data-testid="patient-field-emergency-phone"
                hasError={Boolean(errors.emergencyContactPhone)}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </FormField>
      </form>
    </Modal>
  );
}
