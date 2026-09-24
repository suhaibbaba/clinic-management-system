import { personName, type Doctor, type WeeklySchedule } from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { foldDigits } from "@clinic/ui/lib/digits";
import { useTranslation } from "react-i18next";
import {
  Button,
  FormField,
  Icon,
  Input,
  Modal,
  PasswordInput,
  PhoneInput,
  SegmentedControl,
  Select,
  useToast,
} from "@clinic/ui";
import { WorkingHours } from "@web/components/schedule/working-hours";
import { useClinic } from "@web/features/clinic/queries";
import { useCreateDoctor, useSpecialties, useUpdateDoctor } from "@web/features/doctors/queries";
import { useUsers } from "@web/features/users/queries";
import { errorMessageKey } from "@web/lib/api-error";

interface DoctorFormModalProps {
  "data-testid"?: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctor: Doctor | null;
}

const DEFAULT_DURATION = 30;

/** New by default: linking an account that already exists is the rare case, not the usual one. */
const MODES = ["new", "link"] as const;
type Mode = (typeof MODES)[number];

interface NewUserFields {
  firstNameAr: string;
  lastNameAr: string;
  firstNameEn: string;
  lastNameEn: string;
  phone: string;
  email: string;
  password: string;
}

const EMPTY_USER: NewUserFields = {
  firstNameAr: "",
  lastNameAr: "",
  firstNameEn: "",
  lastNameEn: "",
  phone: "",
  email: "",
  password: "",
};

const NAME_FIELDS = [
  { key: "firstNameAr", label: "users.firstNameAr", id: "doctor-first-name-ar", ltr: false },
  { key: "lastNameAr", label: "users.lastNameAr", id: "doctor-last-name-ar", ltr: false },
  { key: "firstNameEn", label: "users.firstNameEn", id: "doctor-first-name-en", ltr: true },
  { key: "lastNameEn", label: "users.lastNameEn", id: "doctor-last-name-en", ltr: true },
] as const;

export function DoctorFormModal({
  open,
  onOpenChange,
  doctor,
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
  const [mode, setMode] = useState<Mode>("new");
  const [newUser, setNewUser] = useState<NewUserFields>(EMPTY_USER);
  const [userId, setUserId] = useState("");
  const [specialtyId, setSpecialtyId] = useState("");
  const [duration, setDuration] = useState(String(DEFAULT_DURATION));
  const [schedule, setSchedule] = useState<WeeklySchedule>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setMode("new");
    setNewUser(EMPTY_USER);
    setUserId(doctor?.userId ?? "");
    setSpecialtyId(doctor?.specialtyId ?? "");
    setDuration(String(doctor?.defaultAppointmentDurationMinutes ?? DEFAULT_DURATION));
    setSchedule(doctor?.weeklySchedule ?? clinic.data?.workingHours ?? []);
  }, [open, doctor, clinic.data]);

  const userOptions = (doctorUsers.data?.items ?? []).map((user) => ({
    value: user.id,
    label: `\u2068${personName(user.name, i18n.language)}\u2069 — \u2068${user.phone}\u2069`,
  }));

  const specialtyOptions = (specialties.data?.items ?? []).map((specialty) => ({
    value: specialty.id,
    label: specialty.name,
  }));

  const submit = async (): Promise<void> => {
    setIsSaving(true);

    try {
      const durationMinutes = Number(duration);

      if (doctor) {
        await updateDoctor.mutateAsync({
          id: doctor.id,
          body: {
            specialtyId,
            defaultAppointmentDurationMinutes: durationMinutes,
            weeklySchedule: schedule,
          },
        });
        toast.success("doctors.updated");
      } else {
        await createDoctor.mutateAsync({
          ...(mode === "new"
            ? {
                newUser: {
                  firstName: { ar: newUser.firstNameAr.trim(), en: newUser.firstNameEn.trim() },
                  lastName: { ar: newUser.lastNameAr.trim(), en: newUser.lastNameEn.trim() },
                  phone: newUser.phone.trim(),
                  password: newUser.password,
                  ...(newUser.email.trim() !== "" && { email: newUser.email.trim() }),
                },
              }
            : { userId }),
          specialtyId,
          defaultAppointmentDurationMinutes: durationMinutes,
          weeklySchedule: schedule,
        });
        toast.success("doctors.created");
      }

      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessageKey(error));
    } finally {
      setIsSaving(false);
    }
  };

  const accountReady =
    mode === "link"
      ? userId !== ""
      : NAME_FIELDS.every((field) => newUser[field.key].trim() !== "") &&
        newUser.phone.trim() !== "" &&
        newUser.password.length >= 8;

  const canSubmit = specialtyId !== "" && (isEdit || accountReady);

  return (
    <Modal
      data-testid={testId}
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={isEdit ? "doctors.edit" : "doctors.create"}
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
            disabled={!canSubmit}
            isLoading={isSaving}
            onClick={() => void submit()}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div data-testid={`${testId}-form`} className="flex flex-col gap-4">
        {!isEdit && (
          <>
            <SegmentedControl<Mode>
              data-testid="doctor-field-mode"
              label={t("doctors.account")}
              value={mode}
              onChange={setMode}
              options={MODES.map((value) => ({ value, label: t(`doctors.modes.${value}`) }))}
            />

            {mode === "new" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {NAME_FIELDS.map((field) => (
                  <FormField key={field.key} label={field.label} htmlFor={field.id} required>
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
                ))}

                <FormField label="users.phone" htmlFor="doctor-phone" required>
                  <PhoneInput
                    id="doctor-phone"
                    data-testid="doctor-field-phone"
                    placeholder={t("common.placeholders.phone")}
                    value={newUser.phone}
                    onChange={(next) => setNewUser({ ...newUser, phone: next ?? "" })}
                  />
                </FormField>

                <FormField label="users.email" htmlFor="doctor-email" optional>
                  <Input
                    id="doctor-email"
                    data-testid="doctor-field-email"
                    type="email"
                    dir="ltr"
                    placeholder={t("common.placeholders.email")}
                    value={newUser.email}
                    onChange={(event) => setNewUser({ ...newUser, email: event.target.value })}
                  />
                </FormField>

                <FormField
                  label="users.password"
                  htmlFor="doctor-password"
                  hint="doctors.roleLocked"
                  required
                >
                  <PasswordInput
                    id="doctor-password"
                    data-testid="doctor-field-password"
                    autoComplete="new-password"
                    placeholder={t("common.placeholders.password")}
                    value={newUser.password}
                    onChange={(event) => setNewUser({ ...newUser, password: event.target.value })}
                  />
                </FormField>
              </div>
            ) : (
              <FormField label="doctors.user" htmlFor="doctor-user" hint="doctors.linkPromotes">
                <Select
                  id="doctor-user"
                  data-testid="doctor-field-user"
                  options={userOptions}
                  placeholder={t("doctors.selectUser")}
                  value={userId}
                  onChange={(event) => setUserId(event.target.value)}
                />
              </FormField>
            )}
          </>
        )}

        <FormField label="doctors.specialty" htmlFor="doctor-specialty" required>
          <Select
            id="doctor-specialty"
            data-testid="doctor-field-specialty"
            options={specialtyOptions}
            placeholder={t("doctors.selectSpecialty")}
            value={specialtyId}
            onChange={(event) => setSpecialtyId(event.target.value)}
          />
        </FormField>

        <FormField label="doctors.duration" htmlFor="doctor-duration" hint="doctors.durationUnit">
          <Input
            placeholder={t("common.placeholders.minutes")}
            id="doctor-duration"
            data-testid="doctor-field-duration"
            // Not `type="number"`: it accepts `e`, `+`, `-` and `.`, and reads back an empty
            // string for any of them, so the field looks filled and submits nothing.
            inputMode="numeric"
            dir="ltr"
            value={duration}
            onChange={(event) => setDuration(foldDigits(event.target.value).replace(/\D/g, ""))}
          />
        </FormField>

        <div>
          <p className="mb-1 text-value font-medium text-ink">{t("doctors.schedule")}</p>
          {!isEdit && (
            <p className="mb-2 text-label text-ink-muted">{t("doctors.scheduleDefault")}</p>
          )}
          <WorkingHours value={schedule} onChange={setSchedule} idPrefix="doctor-form-hours" />
        </div>
      </div>
    </Modal>
  );
}
