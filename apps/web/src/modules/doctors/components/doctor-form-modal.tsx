import {
  createDoctorSchema,
  personName,
  updateDoctorSchema,
  type CreateDoctorInput,
  type Doctor,
  type UpdateDoctorInput,
  type WeeklySchedule,
} from "@clinic/shared";
import { todayIso } from "@web/shared/lib/dates";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  DatePicker,
  FormField,
  Icon,
  Input,
  Modal,
  PasswordInput,
  PhoneInput,
  SegmentedControl,
  Select,
  Tabs,
  useToast,
} from "@clinic/ui";
import { WorkingHours } from "@web/shared/components/working-hours";
import { useClinic } from "@web/shared/queries/clinic";
import { useCreateDoctor, useSpecialties, useUpdateDoctor } from "@web/modules/doctors/queries";
import { useUsers } from "@web/shared/queries/users";
import { errorToast } from "@web/shared/lib/api-error";
import { REQUIRED, schemaErrors } from "@web/shared/lib/form-errors";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import {
  DEFAULT_APPOINTMENT_DURATION,
  DOCTOR_FORM_MODES,
  DOCTOR_KINDS,
  DOCTOR_NAME_FIELDS,
  VISITING_DOCTOR_FORM_ID,
} from "@web/modules/doctors/constants";
import { VisitingDoctorFields } from "@web/modules/doctors/components/visiting-doctor-fields";
import { useVisitingDoctorForm } from "@web/modules/doctors/hooks/use-visiting-doctor-form";
import { ellipsis } from "@web/i18n/ellipsis";

interface DoctorFormModalProps {
  "data-testid"?: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctor: Doctor | null;
  onVisitingCreated: (doctor: Doctor) => void;
}
type Mode = (typeof DOCTOR_FORM_MODES)[number];
type Kind = (typeof DOCTOR_KINDS)[number]["id"];

interface NewUserFields {
  firstNameAr: string;
  lastNameAr: string;
  firstNameEn: string;
  lastNameEn: string;
  phone: string;
  email: string;
  password: string;
  joinedOn: string;
}

const EMPTY_USER: NewUserFields = {
  firstNameAr: "",
  lastNameAr: "",
  firstNameEn: "",
  lastNameEn: "",
  phone: "",
  email: "",
  password: "",
  joinedOn: "",
};

export function DoctorFormModal({
  open,
  onOpenChange,
  doctor,
  onVisitingCreated,
  "data-testid": testId = "doctor-form-modal",
}: DoctorFormModalProps): JSX.Element {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const createDoctor = useCreateDoctor();
  const updateDoctor = useUpdateDoctor();
  const specialties = useSpecialties();
  const clinic = useClinic();
  const doctorUsers = useUsers({ limit: 100 });

  const isEdit = doctor !== null;
  const [kind, setKind] = useState<Kind>("staff");
  const visiting = useVisitingDoctorForm(open, (created) => {
    onOpenChange(false);
    onVisitingCreated(created);
  });
  const isVisiting = !isEdit && kind === "visiting";
  const visitingState = visiting.form.formState;
  const [mode, setMode] = useState<Mode>("new");
  const [newUser, setNewUser] = useState<NewUserFields>(EMPTY_USER);
  const [userId, setUserId] = useState("");
  const [specialtyId, setSpecialtyId] = useState("");
  const [duration, setDuration] = useState(String(DEFAULT_APPOINTMENT_DURATION));
  const [schedule, setSchedule] = useState<WeeklySchedule>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setKind("staff");
    setMode("new");
    setNewUser(EMPTY_USER);
    setUserId(doctor?.userId ?? "");
    setSpecialtyId(doctor?.specialtyId ?? "");
    setDuration(String(doctor?.defaultAppointmentDurationMinutes ?? DEFAULT_APPOINTMENT_DURATION));
    setSchedule(doctor?.weeklySchedule ?? clinic.data?.workingHours ?? []);
    form.reset();
  }, [open, doctor, clinic.data]);

  const userOptions = (doctorUsers.data?.items ?? []).map((user) => ({
    value: user.id,
    label: `\u2068${personName(user.name, i18n.language)}\u2069 — \u2068${user.phone}\u2069`,
  }));

  const specialtyOptions = (specialties.data?.items ?? []).map((specialty) => ({
    value: specialty.id,
    label: specialty.name,
  }));

  const durationMinutes = duration.trim() === "" ? undefined : Number(duration);

  const updateBody: UpdateDoctorInput = {
    specialtyId,
    ...(durationMinutes !== undefined && { defaultAppointmentDurationMinutes: durationMinutes }),
    weeklySchedule: schedule,
  };

  const createBody: CreateDoctorInput = {
    ...(mode === "new"
      ? {
          newUser: {
            firstName: { ar: newUser.firstNameAr.trim(), en: newUser.firstNameEn.trim() },
            lastName: { ar: newUser.lastNameAr.trim(), en: newUser.lastNameEn.trim() },
            phone: newUser.phone.trim(),
            password: newUser.password,
            joinedOn: newUser.joinedOn,
            ...(newUser.email.trim() !== "" && { email: newUser.email.trim() }),
          },
        }
      : { userId }),
    specialtyId,
    defaultAppointmentDurationMinutes: durationMinutes ?? DEFAULT_APPOINTMENT_DURATION,
    weeklySchedule: schedule,
  };

  const form = useFormErrors({
    ...(doctor
      ? schemaErrors(updateDoctorSchema, updateBody)
      : schemaErrors(createDoctorSchema, createBody)),
    ...(specialtyId === "" && { specialtyId: REQUIRED }),
    ...(durationMinutes === undefined && { defaultAppointmentDurationMinutes: REQUIRED }),
  });
  const { errors } = form;

  const submit = async (): Promise<void> => {
    if (!form.check()) {
      return;
    }

    setIsSaving(true);

    try {
      if (doctor) {
        await updateDoctor.mutateAsync({ id: doctor.id, body: updateBody });
        toast.success("doctors.updated");
      } else {
        await createDoctor.mutateAsync(createBody);
        toast.success("doctors.created");
      }

      onOpenChange(false);
    } catch (error) {
      toast.error(...errorToast(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      data-testid={testId}
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={isEdit ? "doctors.edit" : isVisiting ? "doctors.visiting.create" : "doctors.create"}
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
          {isVisiting ? (
            <Button
              icon={<Icon name="check" />}
              type="submit"
              form={VISITING_DOCTOR_FORM_ID}
              data-testid="visiting-doctor-save"
              aria-disabled={!visitingState.isValid || visitingState.isSubmitting || undefined}
              isLoading={visitingState.isSubmitting}
            >
              {visitingState.isSubmitting ? ellipsis(t("common.saving")) : t("common.save")}
            </Button>
          ) : (
            <Button
              icon={<Icon name="check" />}
              data-testid={`${testId}-save`}
              {...(!form.isValid && { "aria-disabled": true })}
              isLoading={isSaving}
              onClick={() => void submit()}
            >
              {t("common.save")}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!isEdit && (
          <Tabs<Kind>
            data-testid="doctor-kind"
            label="doctors.kind"
            className="border-b border-line pb-3 sm:pb-3"
            value={kind}
            onChange={setKind}
            tabs={DOCTOR_KINDS}
          />
        )}

        {isVisiting ? (
          <VisitingDoctorFields {...visiting} />
        ) : (
          <div ref={form.formRef} data-testid={`${testId}-form`} className="flex flex-col gap-4">
            {!isEdit && (
              <>
                <SegmentedControl<Mode>
                  data-testid="doctor-field-mode"
                  label={t("doctors.account")}
                  value={mode}
                  onChange={setMode}
                  options={DOCTOR_FORM_MODES.map((value) => ({
                    value,
                    label: t(`doctors.modes.${value}`),
                  }))}
                />

                {mode === "new" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {DOCTOR_NAME_FIELDS.map((field) => (
                      <div key={field.key} onBlur={form.leave(namePath(field.key))}>
                        <FormField
                          label={field.label}
                          htmlFor={field.id}
                          error={errors[namePath(field.key)]}
                          required
                        >
                          <Input
                            id={field.id}
                            data-testid={field.id.replace("doctor-", "doctor-field-")}
                            adornment="user"
                            {...(field.ltr && { dir: "ltr" })}
                            placeholder={t(`common.placeholders.${field.key}`)}
                            value={newUser[field.key]}
                            onChange={(event) =>
                              setNewUser({ ...newUser, [field.key]: event.target.value })
                            }
                          />
                        </FormField>
                      </div>
                    ))}

                    <div onBlur={form.leave("newUser.phone")}>
                      <FormField
                        label="users.phone"
                        htmlFor="doctor-phone"
                        error={errors["newUser.phone"]}
                        errorKey="errors.validation.invalidPhone"
                        required
                      >
                        <PhoneInput
                          id="doctor-phone"
                          data-testid="doctor-field-phone"
                          placeholder={t("common.placeholders.phone")}
                          value={newUser.phone}
                          onChange={(next) => setNewUser({ ...newUser, phone: next ?? "" })}
                        />
                      </FormField>
                    </div>

                    <div onBlur={form.leave("newUser.joinedOn")}>
                      <FormField
                        label="users.joinedOn"
                        htmlFor="doctor-joined-on"
                        error={errors["newUser.joinedOn"]}
                        required
                      >
                        <DatePicker
                          id="doctor-joined-on"
                          data-testid="doctor-field-joined-on"
                          label={t("users.joinedOn")}
                          value={newUser.joinedOn}
                          max={todayIso()}
                          onChange={(next) => setNewUser({ ...newUser, joinedOn: next })}
                        />
                      </FormField>
                    </div>

                    <div onBlur={form.leave("newUser.email")}>
                      <FormField
                        label="users.email"
                        htmlFor="doctor-email"
                        error={errors["newUser.email"]}
                        errorKey="errors.validation.invalidEmail"
                        optional
                      >
                        <Input
                          id="doctor-email"
                          data-testid="doctor-field-email"
                          type="email"
                          dir="ltr"
                          placeholder={t("common.placeholders.email")}
                          value={newUser.email}
                          onChange={(event) =>
                            setNewUser({ ...newUser, email: event.target.value })
                          }
                        />
                      </FormField>
                    </div>

                    <div onBlur={form.leave("newUser.password")}>
                      <FormField
                        label="users.password"
                        htmlFor="doctor-password"
                        hint="doctors.roleLocked"
                        error={errors["newUser.password"]}
                        errorKey="errors.validation.passwordMin"
                        required
                      >
                        <PasswordInput
                          id="doctor-password"
                          data-testid="doctor-field-password"
                          autoComplete="new-password"
                          placeholder={t("common.placeholders.password")}
                          value={newUser.password}
                          onChange={(event) =>
                            setNewUser({ ...newUser, password: event.target.value })
                          }
                        />
                      </FormField>
                    </div>
                  </div>
                ) : (
                  <div onBlur={form.leave("userId")}>
                    <FormField
                      label="doctors.user"
                      htmlFor="doctor-user"
                      hint="doctors.linkPromotes"
                      error={errors["userId"]}
                    >
                      <Select
                        id="doctor-user"
                        data-testid="doctor-field-user"
                        options={userOptions}
                        placeholder={t("doctors.selectUser")}
                        value={userId}
                        onChange={(event) => setUserId(event.target.value)}
                      />
                    </FormField>
                  </div>
                )}
              </>
            )}

            <div onBlur={form.leave("specialtyId")}>
              <FormField
                label="doctors.specialty"
                htmlFor="doctor-specialty"
                error={errors["specialtyId"]}
                required
              >
                <Select
                  id="doctor-specialty"
                  data-testid="doctor-field-specialty"
                  options={specialtyOptions}
                  placeholder={t("doctors.selectSpecialty")}
                  value={specialtyId}
                  onChange={(event) => setSpecialtyId(event.target.value)}
                />
              </FormField>
            </div>

            <div onBlur={form.leave("defaultAppointmentDurationMinutes")}>
              <FormField
                label="doctors.duration"
                htmlFor="doctor-duration"
                hint="doctors.durationUnit"
                error={errors["defaultAppointmentDurationMinutes"]}
              >
                <Input
                  placeholder={t("common.placeholders.minutes")}
                  id="doctor-duration"
                  data-testid="doctor-field-duration"
                  inputMode="numeric"
                  dir="ltr"
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                />
              </FormField>
            </div>

            <div>
              <p className="mb-1 text-value font-medium text-ink">{t("doctors.schedule")}</p>
              {!isEdit && (
                <p className="mb-2 text-label text-ink-muted">{t("doctors.scheduleDefault")}</p>
              )}
              <WorkingHours value={schedule} onChange={setSchedule} idPrefix="doctor-form-hours" />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function namePath(key: (typeof DOCTOR_NAME_FIELDS)[number]["key"]): string {
  const part = key.startsWith("first") ? "firstName" : "lastName";

  return `newUser.${part}.${key.endsWith("Ar") ? "ar" : "en"}`;
}
