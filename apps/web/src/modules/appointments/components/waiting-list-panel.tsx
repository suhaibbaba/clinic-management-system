import {
  WAITING_LIST_PRIORITIES,
  WAITING_LIST_PRIORITY,
  WAITING_LIST_SOURCE,
  WAITING_LIST_STATUS,
  createWaitingListEntrySchema,
  declineWaitingListEntrySchema,
  type WaitingListEntry,
} from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Button,
  Drawer,
  FormField,
  Icon,
  Input,
  Modal,
  PersonName,
  PhoneLink,
  Select,
  Textarea,
  usePersonName,
  useToast,
} from "@clinic/ui";
import { useDoctors } from "@web/shared/queries/doctors";
import {
  useAddToWaitingList,
  useContactWaitingEntry,
  useDeclineWaitingEntry,
  useWaitingList,
} from "@web/modules/appointments/queries";
import { PatientPicker } from "@web/shared/components/patient-picker";
import { FORM_ROOT, REQUIRED, nestedErrors, schemaErrors } from "@web/shared/lib/form-errors";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import {
  patientPhoneClash,
  toPatientRef,
  type PatientChoice,
  type PickedPatient,
} from "@web/shared/lib/patient-draft";
import { errorToast } from "@web/shared/lib/api-error";
import { formatDateTime } from "@web/shared/lib/format";
import { WAITING_LIST_PRIORITY_TONES } from "@web/modules/appointments/constants";

export interface WaitingListPanelProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly canManage: boolean;
  readonly onSchedule: (entry: WaitingListEntry) => void;
}

export function WaitingListPanel({
  open,
  onOpenChange,
  canManage,
  onSchedule,
}: WaitingListPanelProps): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();

  const entries = useWaitingList({ limit: 50 });
  const contact = useContactWaitingEntry();

  const [addOpen, setAddOpen] = useState(false);
  const [declining, setDeclining] = useState<WaitingListEntry | null>(null);

  const markContacted = async (id: string): Promise<void> => {
    try {
      await contact.mutateAsync(id);
      toast.success("appointments.waiting.contacted");
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <>
      <Drawer
        data-testid="waiting-list-panel"
        open={open}
        onOpenChange={onOpenChange}
        title={t("appointments.waiting.title")}
        descriptionKey="appointments.waiting.title"
        footer={
          canManage ? (
            <Button
              icon={<Icon name="user-plus" />}
              data-testid="waiting-list-add"
              onClick={() => setAddOpen(true)}
            >
              {t("appointments.waiting.add")}
            </Button>
          ) : undefined
        }
      >
        {entries.data?.items.length === 0 && (
          <p
            data-testid="waiting-list-empty"
            className="rounded-control bg-inset px-3 py-6 text-center text-value text-ink-muted"
          >
            {t("appointments.waiting.empty")}
          </p>
        )}

        <ul data-testid="waiting-list" className="flex flex-col gap-3">
          {entries.data?.items.map((entry) => (
            <li
              key={entry.id}
              data-testid={`waiting-entry-${entry.id}`}
              className="rounded-card border border-line p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p
                    data-testid="waiting-entry-name"
                    className="truncate text-value font-medium text-ink"
                  >
                    {entry.patientName}
                  </p>
                  <PhoneLink value={entry.patientPhone} className="truncate text-label" />
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  {entry.source === WAITING_LIST_SOURCE.ONLINE && (
                    <Badge tone="info" data-testid="waiting-entry-online">
                      {t("appointments.waiting.online")}
                    </Badge>
                  )}
                  <Badge
                    tone={WAITING_LIST_PRIORITY_TONES[entry.priority] ?? "neutral"}
                    data-testid="waiting-entry-priority"
                  >
                    {t(`appointments.waiting.priorities.${entry.priority}`)}
                  </Badge>
                </div>
              </div>

              {entry.reason && <p className="mt-1.5 text-label text-ink-muted">{entry.reason}</p>}

              <p className="mt-1 text-label text-ink-subtle">
                <PersonName
                  name={entry.doctorName}
                  fallback={t("appointments.waiting.anyDoctor")}
                />{" "}
                ·{" "}
                {t("appointments.waiting.waitingSince", { time: formatDateTime(entry.createdAt) })}
                {entry.status === WAITING_LIST_STATUS.CONTACTED && (
                  <> · {t("appointments.waiting.statuses.contacted")}</>
                )}
              </p>

              {canManage && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  <Button
                    size="sm"
                    icon={<Icon name="calendar" />}
                    data-testid="waiting-entry-schedule"
                    onClick={() => onSchedule(entry)}
                  >
                    {t("appointments.waiting.schedule")}
                  </Button>
                  {entry.status === WAITING_LIST_STATUS.PENDING && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Icon name="phone" />}
                      data-testid="waiting-entry-contacted"
                      isLoading={contact.isPending}
                      onClick={() => void markContacted(entry.id)}
                    >
                      {t("appointments.waiting.markContacted")}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Icon name="x" />}
                    data-testid="waiting-entry-decline"
                    onClick={() => setDeclining(entry)}
                  >
                    {t("appointments.waiting.decline")}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Drawer>

      <AddWalkInModal open={addOpen} onOpenChange={setAddOpen} />

      {declining && <DeclineModal entry={declining} onClose={() => setDeclining(null)} />}
    </>
  );
}

function AddWalkInModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const doctorName = usePersonName();
  const toast = useToast();
  const add = useAddToWaitingList();
  const doctors = useDoctors({ limit: 100 });

  const [patient, setPatient] = useState<PatientChoice | null>(null);
  const [clash, setClash] = useState<PickedPatient | null>(null);
  const [doctorId, setDoctorId] = useState("");
  const [priority, setPriority] = useState<string>(WAITING_LIST_PRIORITY.NORMAL);
  const [reason, setReason] = useState("");

  const body = {
    ...(patient ? toPatientRef(patient) : {}),
    doctorId: doctorId === "" ? null : doctorId,
    reason: reason.trim() === "" ? null : reason.trim(),
    priority: priority as (typeof WAITING_LIST_PRIORITIES)[number],
  };

  const form = useFormErrors({
    ...schemaErrors(createWaitingListEntrySchema, body),
    ...(!patient && { [FORM_ROOT]: REQUIRED }),
  });
  const { errors, reset } = form;

  useEffect(() => {
    if (open) {
      reset();
    }
  }, [open, reset]);

  const submit = async (): Promise<void> => {
    if (!form.check() || !patient) {
      return;
    }

    try {
      await add.mutateAsync({ ...body, ...toPatientRef(patient) });

      toast.success("appointments.waiting.added");
      setPatient(null);
      setReason("");
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

  return (
    <Modal
      data-testid="waiting-add-modal"
      open={open}
      onOpenChange={onOpenChange}
      title="appointments.waiting.add"
      footer={
        <>
          <Button
            variant="secondary"
            data-testid="waiting-add-cancel"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            isLoading={add.isPending}
            data-testid="waiting-add-save"
            aria-disabled={!form.isValid || undefined}
            onClick={() => void submit()}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div ref={form.formRef} className="flex flex-col gap-4">
        <div onBlur={form.leave(FORM_ROOT)}>
          <FormField
            label="appointments.patient"
            htmlFor="waiting-patient"
            error={patient?.kind === "new" ? undefined : (errors[FORM_ROOT] ?? errors["patientId"])}
          >
            <PatientPicker
              id="waiting-patient"
              value={patient}
              clash={clash}
              errors={nestedErrors(errors, "newPatient")}
              onLeave={(field) => form.leave(`newPatient.${field}`)}
              onChange={(next) => {
                setPatient(next);
                setClash(null);
              }}
            />
          </FormField>
        </div>

        <div onBlur={form.leave("doctorId")}>
          <FormField
            label="appointments.doctor"
            htmlFor="waiting-doctor"
            error={errors["doctorId"]}
            optional
          >
            <Select
              id="waiting-doctor"
              data-testid="waiting-field-doctor"
              value={doctorId}
              placeholder={t("appointments.waiting.anyDoctor")}
              options={(doctors.data?.items ?? []).map((doctor) => ({
                value: doctor.id,
                label: doctorName(doctor.user.name),
              }))}
              onChange={(event) => setDoctorId(event.target.value)}
            />
          </FormField>
        </div>

        <div onBlur={form.leave("priority")}>
          <FormField
            label="appointments.waiting.priority"
            htmlFor="waiting-priority"
            error={errors["priority"]}
          >
            <Select
              id="waiting-priority"
              data-testid="waiting-field-priority"
              value={priority}
              options={WAITING_LIST_PRIORITIES.map((value) => ({
                value,
                label: t(`appointments.waiting.priorities.${value}`),
              }))}
              onChange={(event) => setPriority(event.target.value)}
            />
          </FormField>
        </div>

        <div onBlur={form.leave("reason")}>
          <FormField
            label="appointments.reason"
            htmlFor="waiting-reason"
            error={errors["reason"]}
            optional
          >
            <Input
              id="waiting-reason"
              data-testid="waiting-field-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}

function DeclineModal({
  entry,
  onClose,
}: {
  entry: WaitingListEntry;
  onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const decline = useDeclineWaitingEntry();

  const [reason, setReason] = useState("");
  const notify = entry.source === WAITING_LIST_SOURCE.ONLINE;
  const body = { reason: reason.trim(), notify };
  const form = useFormErrors(schemaErrors(declineWaitingListEntrySchema, body));

  const submit = async (): Promise<void> => {
    if (!form.check()) {
      return;
    }

    try {
      await decline.mutateAsync({ id: entry.id, body });
      toast.success("appointments.waiting.declined");
      onClose();
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <Modal
      data-testid="waiting-decline-modal"
      open
      onOpenChange={(next) => !next && onClose()}
      title="appointments.waiting.decline"
      footer={
        <>
          <Button variant="secondary" data-testid="waiting-decline-cancel" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            isLoading={decline.isPending}
            data-testid="waiting-decline-confirm"
            aria-disabled={!form.isValid || undefined}
            onClick={() => void submit()}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div ref={form.formRef} className="flex flex-col gap-4">
        <p className="text-value text-ink">{entry.patientName}</p>

        <div onBlur={form.leave("reason")}>
          <FormField
            label="appointments.waiting.declineReason"
            htmlFor="decline-reason"
            error={form.errors["reason"]}
            hint={notify ? "appointments.waiting.declineNotifies" : undefined}
            required
          >
            <Textarea
              id="decline-reason"
              data-testid="waiting-decline-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}
