import {
  APPOINTMENT_TYPE,
  LOOKUP_LIST,
  WAITING_LIST_SOURCE,
  createAppointmentSchema,
  updateAppointmentSchema,
  VALIDATION_CODE,
  type CalendarAppointment,
  type WaitingListEntry,
} from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  DatePicker,
  FormField,
  Input,
  Modal,
  Select,
  Textarea,
  usePersonName,
  useToast,
} from "@clinic/ui";
import { useDoctors } from "@web/shared/queries/doctors";
import { useLookupOptions } from "@web/shared/queries/lookups";
import {
  useAvailability,
  useCreateAppointment,
  usePromoteWaitingEntry,
  useUpdateAppointment,
} from "@web/modules/appointments/queries";
import { PatientPicker } from "@web/shared/components/patient-picker";
import {
  FORM_ROOT,
  REQUIRED,
  nestedErrors,
  schemaErrors,
  type FieldErrors,
} from "@web/shared/lib/form-errors";
import {
  patientPhoneClash,
  toPatientRef,
  type PatientChoice,
  type PickedPatient,
} from "@web/shared/lib/patient-draft";
import { SlotPicker } from "@web/modules/appointments/components/slot-picker";
import { isIsoDate, toIsoDate, todayIso } from "@web/shared/lib/dates";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { errorToast } from "@web/shared/lib/api-error";

export interface AppointmentFormModalProps {
  readonly "data-testid"?: string | undefined;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly appointment?: CalendarAppointment | undefined;
  readonly defaults?:
    { readonly date?: string; readonly doctorId?: string; readonly startsAt?: string } | undefined;
  readonly waitingEntry?: WaitingListEntry | undefined;
  readonly rebookFrom?: CalendarAppointment | undefined;
  readonly forPatient?: PickedPatient | undefined;
  readonly onBooked?: ((booked: { date: string; doctorId: string }) => void) | undefined;
}

export function AppointmentFormModal({
  open,
  onOpenChange,
  appointment,
  defaults,
  waitingEntry,
  rebookFrom,
  forPatient,
  onBooked,
  "data-testid": testId = "appointment-form-modal",
}: AppointmentFormModalProps): JSX.Element {
  const { t } = useTranslation();
  const doctorName = usePersonName();
  const typeOptions = useLookupOptions(LOOKUP_LIST.APPOINTMENT_TYPE);
  const toast = useToast();

  const doctors = useDoctors({ limit: 100 });
  const create = useCreateAppointment();
  const update = useUpdateAppointment();
  const promote = usePromoteWaitingEntry();

  const [patient, setPatient] = useState<PatientChoice | null>(null);
  const [clash, setClash] = useState<PickedPatient | null>(null);
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [type, setType] = useState<string>(APPOINTMENT_TYPE.CHECKUP);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setClash(null);
    form.reset();

    if (appointment) {
      setPatient({
        kind: "existing",
        patient: {
          id: appointment.patientId,
          fullName: appointment.patientName,
          phone: appointment.patientPhone,
          fileNumber: appointment.patientFileNumber,
        },
      });
      setDoctorId(appointment.doctorId);
      setDate(toIsoDate(new Date(appointment.startsAt)));
      setStartsAt(appointment.startsAt);
      setDurationMinutes(String(appointment.durationMinutes));
      setType(appointment.type);
      setReason(appointment.reason ?? "");
      setNotes(appointment.notes ?? "");
      return;
    }

    if (rebookFrom) {
      const originalDay = toIsoDate(new Date(rebookFrom.startsAt));

      setPatient({
        kind: "existing",
        patient: {
          id: rebookFrom.patientId,
          fullName: rebookFrom.patientName,
          phone: rebookFrom.patientPhone,
          fileNumber: rebookFrom.patientFileNumber,
        },
      });
      setDoctorId(rebookFrom.doctorId);
      setDate(originalDay < todayIso() ? todayIso() : originalDay);
      setStartsAt(null);
      setDurationMinutes(String(rebookFrom.durationMinutes));
      setType(rebookFrom.type);
      setReason(rebookFrom.reason ?? "");
      setNotes(rebookFrom.notes ?? "");
      return;
    }

    if (waitingEntry) {
      setPatient({
        kind: "existing",
        patient: {
          id: waitingEntry.patientId,
          fullName: waitingEntry.patientName,
          phone: waitingEntry.patientPhone,
          fileNumber: "",
        },
      });
      setDoctorId(waitingEntry.doctorId ?? "");
      setReason(waitingEntry.reason ?? "");
    } else {
      setPatient(forPatient ? { kind: "existing", patient: forPatient } : null);
      setDoctorId(defaults?.doctorId ?? "");
      setReason("");
    }

    setDate(defaults?.date ?? todayIso());
    setStartsAt(defaults?.startsAt ?? null);
    setDurationMinutes("30");
    setType(APPOINTMENT_TYPE.CHECKUP);
    setNotes("");
  }, [open, appointment, defaults, waitingEntry, rebookFrom, forPatient]);

  const availability = useAvailability(
    {
      doctorId,
      date,
      durationMinutes: Number(durationMinutes) || 30,
      ...(appointment && { excludeAppointmentId: appointment.id }),
    },
    open,
  );

  const ready = Boolean(doctorId && date);
  const movedIntoPast = date < todayIso() && startsAt !== appointment?.startsAt;
  const body = {
    doctorId,
    startsAt: startsAt ?? undefined,
    durationMinutes: Number(durationMinutes),
    type,
    reason: reason.trim() === "" ? null : reason.trim(),
    notes: notes.trim() === "" ? null : notes.trim(),
  };

  const validate = (): FieldErrors => ({
    ...(appointment || waitingEntry
      ? schemaErrors(updateAppointmentSchema, body)
      : schemaErrors(createAppointmentSchema, {
          ...body,
          ...(patient ? toPatientRef(patient) : {}),
        })),
    ...(!patient && { [FORM_ROOT]: REQUIRED }),
    ...(!startsAt && { startsAt: REQUIRED }),
    ...(!doctorId && { doctorId: REQUIRED }),
    ...(!isIsoDate(date)
      ? { date: date === "" ? REQUIRED : { type: "invalid_format" } }
      : movedIntoPast && { date: { type: "custom", message: VALIDATION_CODE.DATE_IN_PAST } }),
  });

  const form = useFormErrors(validate());
  const { errors } = form;

  const submit = async (): Promise<void> => {
    if (!form.check() || !startsAt || movedIntoPast) {
      return;
    }

    try {
      if (appointment) {
        await update.mutateAsync({ id: appointment.id, body: { ...body, startsAt } });
        toast.success("appointments.updated");
      } else if (waitingEntry) {
        await promote.mutateAsync({
          id: waitingEntry.id,
          body: {
            doctorId,
            startsAt,
            durationMinutes: Number(durationMinutes),
            type,
            notify: waitingEntry.source === WAITING_LIST_SOURCE.ONLINE,
          },
        });
        toast.success("appointments.waiting.scheduled");
      } else {
        if (!patient) {
          return;
        }

        await create.mutateAsync({ ...body, startsAt, ...toPatientRef(patient) });
        toast.success("appointments.created");
      }

      onBooked?.({ date: toIsoDate(new Date(startsAt)), doctorId });
      onOpenChange(false);
    } catch (error) {
      const existing = patientPhoneClash(error);

      if (existing) {
        setClash(existing);
        return;
      }

      toast.error(...errorToast(error));
    }
  };

  const isPending = create.isPending || update.isPending || promote.isPending;
  const title = appointment
    ? "appointments.edit"
    : waitingEntry
      ? "appointments.waiting.schedule"
      : rebookFrom
        ? "appointments.rebook"
        : "appointments.create";

  return (
    <Modal
      data-testid={testId}
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="lg"
      footer={
        <>
          <Button
            variant="secondary"
            data-testid={`${testId}-cancel`}
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            isLoading={isPending}
            data-testid={`${testId}-save`}
            aria-disabled={!form.isValid || movedIntoPast || undefined}
            onClick={() => void submit()}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div ref={form.formRef} data-testid={`${testId}-form`} className="flex flex-col gap-4">
        <div onBlur={form.leave(FORM_ROOT)}>
          <FormField
            label="appointments.patient"
            htmlFor="appointment-patient"
            error={patient?.kind === "new" ? undefined : (errors[FORM_ROOT] ?? errors["patientId"])}
          >
            <PatientPicker
              id="appointment-patient"
              value={patient}
              clash={clash}
              errors={nestedErrors(errors, "newPatient")}
              onLeave={(field) => form.leave(`newPatient.${field}`)}
              allowNew={!waitingEntry && !appointment && !forPatient}
              onChange={(next) => {
                setPatient(next);
                setClash(null);
              }}
            />
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div onBlur={form.leave("doctorId")}>
            <FormField
              label="appointments.doctor"
              htmlFor="appointment-doctor"
              error={errors["doctorId"]}
            >
              <Select
                id="appointment-doctor"
                data-testid="appointment-field-doctor"
                value={doctorId}
                placeholder={t("appointments.allDoctors")}
                options={(doctors.data?.items ?? []).map((doctor) => ({
                  value: doctor.id,
                  label: doctorName(doctor.user.name),
                }))}
                onChange={(event) => {
                  setDoctorId(event.target.value);
                  setStartsAt(null);
                }}
              />
            </FormField>
          </div>

          <div onBlur={form.leave("date")}>
            <FormField label="appointments.date" htmlFor="appointment-date" error={errors["date"]}>
              <DatePicker
                id="appointment-date"
                data-testid="appointment-field-date"
                label={t("appointments.date")}
                value={date}
                min={todayIso()}
                onChange={(next) => {
                  setDate(next);
                  setStartsAt(null);
                }}
              />
            </FormField>
          </div>

          <div onBlur={form.leave("type")}>
            <FormField label="appointments.type" htmlFor="appointment-type">
              <Select
                id="appointment-type"
                data-testid="appointment-field-type"
                value={type}
                options={typeOptions}
                onChange={(event) => setType(event.target.value)}
              />
            </FormField>
          </div>

          <div onBlur={form.leave("durationMinutes")}>
            <FormField label="appointments.duration" htmlFor="appointment-duration">
              <Select
                id="appointment-duration"
                data-testid="appointment-field-duration"
                value={durationMinutes}
                options={durationChoices(durationMinutes).map((value) => ({
                  value,
                  label: t("appointments.durationMinutes", { count: Number(value) }),
                }))}
                onChange={(event) => {
                  setDurationMinutes(event.target.value);
                  setStartsAt(null);
                }}
              />
            </FormField>
          </div>
        </div>

        <div onBlur={form.leave("startsAt")}>
          <FormField
            label="appointments.slots.label"
            htmlFor="appointment-slot"
            error={errors["startsAt"]}
            hint="appointments.slots.hint"
          >
            <SlotPicker
              availability={availability.data}
              isLoading={availability.isFetching}
              ready={ready}
              value={startsAt}
              onChange={setStartsAt}
            />
          </FormField>
        </div>

        <div onBlur={form.leave("reason")}>
          <FormField
            label="appointments.reason"
            htmlFor="appointment-reason"
            error={errors["reason"]}
            optional
          >
            <Input
              id="appointment-reason"
              data-testid="appointment-field-reason"
              placeholder={t("appointments.reason")}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
        </div>

        <div onBlur={form.leave("notes")}>
          <FormField
            label="appointments.notes"
            htmlFor="appointment-notes"
            error={errors["notes"]}
            optional
          >
            <Textarea
              id="appointment-notes"
              data-testid="appointment-field-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}

function durationChoices(current: string): string[] {
  const choices = new Set(["15", "30", "45", "60", "90", current]);

  return [...choices].filter((value) => Number(value) > 0).sort((a, b) => Number(a) - Number(b));
}
