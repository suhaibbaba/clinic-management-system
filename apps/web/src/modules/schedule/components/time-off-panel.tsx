import {
  createDoctorTimeOffSchema,
  type ConflictingAppointment,
  type DoctorTimeOff,
} from "@clinic/shared";
import { useState, type JSX } from "react";
import { isIsoDate } from "@web/shared/lib/dates";
import { REQUIRED, schemaErrors, type FieldErrors } from "@web/shared/lib/form-errors";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Button,
  DatePicker,
  EmptyState,
  FormField,
  Icon,
  Input,
  Ltr,
  Modal,
  Switch,
  TimePicker,
  useConfirm,
  useToast,
} from "@clinic/ui";
import { ConflictDialog } from "@web/modules/schedule/components/conflict-dialog";
import {
  scheduleConflicts,
  useCreateTimeOff,
  useDeleteTimeOff,
  useDoctorTimeOff,
} from "@web/modules/schedule/queries";
import { errorToast } from "@web/shared/lib/api-error";
import { formatDate, formatPeriod } from "@web/shared/lib/format";

export interface TimeOffPanelProps {
  readonly doctorId: string;
  readonly canEdit: boolean;
}

const instant = (date: string, time: string): string =>
  new Date(`${date}T${time}:00`).toISOString();

const dayAfterIso = (isoDate: string): string => {
  const next = new Date(`${isoDate}T00:00:00`);
  next.setDate(next.getDate() + 1);

  return next.toISOString();
};

const isWholeDays = (startsAt: string, endsAt: string): boolean => {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  return (
    start.getHours() === 0 &&
    start.getMinutes() === 0 &&
    end.getHours() === 0 &&
    end.getMinutes() === 0
  );
};

export function TimeOffPanel({ doctorId, canEdit }: TimeOffPanelProps): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();

  const timeOff = useDoctorTimeOff(doctorId, { limit: 50 });
  const createTimeOff = useCreateTimeOff();
  const deleteTimeOff = useDeleteTimeOff();
  const { confirm, dialog } = useConfirm("time-off-confirm-remove");

  const [adding, setAdding] = useState(false);
  const [wholeDay, setWholeDay] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("18:00");
  const [reason, setReason] = useState("");
  const [conflicts, setConflicts] = useState<ConflictingAppointment[] | null>(null);

  const datesReady =
    isIsoDate(from) &&
    (to === "" || isIsoDate(to)) &&
    (wholeDay || (startTime !== "" && endTime !== ""));

  const body = datesReady
    ? {
        startsAt: wholeDay ? instant(from, "00:00") : instant(from, startTime),
        endsAt: wholeDay ? dayAfterIso(to === "" ? from : to) : instant(from, endTime),
        reason: reason.trim(),
      }
    : { reason: reason.trim() };

  const dateErrors: FieldErrors = {
    ...(!isIsoDate(from) && { from: from === "" ? REQUIRED : { type: "invalid_format" } }),
    ...(to !== "" && !isIsoDate(to) && { to: { type: "invalid_format" } }),
    ...(!wholeDay && startTime === "" && { startTime: REQUIRED }),
    ...(!wholeDay && endTime === "" && { endTime: REQUIRED }),
  };
  const schemaProblems = schemaErrors(createDoctorTimeOffSchema, body);
  const form = useFormErrors({
    ...(datesReady
      ? schemaProblems
      : Object.fromEntries(
          Object.entries(schemaProblems).filter(([key]) => key !== "startsAt" && key !== "endsAt"),
        )),
    ...dateErrors,
  });
  const { errors } = form;

  const reset = (): void => {
    setWholeDay(true);
    setFrom("");
    setTo("");
    setStartTime("14:00");
    setEndTime("18:00");
    setReason("");
    setConflicts(null);
    form.reset();
  };

  const save = async (choice?: { force: boolean; cancelAppointments: boolean }): Promise<void> => {
    if (!choice && !form.check()) {
      return;
    }

    if (!datesReady) {
      return;
    }

    try {
      const result = await createTimeOff.mutateAsync({
        doctorId,
        body: { startsAt: body.startsAt ?? "", endsAt: body.endsAt ?? "", reason: body.reason },
        ...(choice && { choice }),
      });

      if (result.cancelledAppointments > 0) {
        toast.success("schedule.timeOff.addedAndCancelled", {
          count: result.cancelledAppointments,
        });
      } else {
        toast.success("schedule.timeOff.added");
      }

      setAdding(false);
      reset();
    } catch (error) {
      const clash = scheduleConflicts(error);

      if (clash) {
        setConflicts(clash);
        return;
      }

      toast.error(...errorToast(error));
    }
  };

  const remove = (entry: DoctorTimeOff): void =>
    confirm({
      title: "schedule.timeOff.confirmRemove.title",
      consequences: [t("schedule.timeOff.confirmRemove.consequence")],
      onConfirm: async () => {
        try {
          await deleteTimeOff.mutateAsync(entry.id);
          toast.success("schedule.timeOff.removed");
        } catch (error) {
          toast.error(...errorToast(error));
          throw error;
        }
      },
    });

  const rows = timeOff.data?.items ?? [];

  return (
    <>
      {dialog}
      <div
        data-testid="time-off-panel"
        className="mb-3 flex flex-wrap items-center justify-between gap-2"
      >
        <p className="text-value font-medium text-ink">{t("schedule.timeOff.title")}</p>

        {canEdit && (
          <Button
            icon={<Icon name="plus" />}
            size="sm"
            variant="secondary"
            data-testid="time-off-add"
            onClick={() => {
              reset();
              setAdding(true);
            }}
          >
            {t("schedule.timeOff.add")}
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="clock"
          data-testid="time-off-empty"
          title="schedule.timeOff.empty"
          hint="schedule.timeOff.emptyHint"
        />
      ) : (
        <ul data-testid="time-off-list" className="flex flex-col gap-2">
          {rows.map((entry) => {
            const whole = isWholeDays(entry.startsAt, entry.endsAt);

            return (
              <li
                key={entry.id}
                data-testid={`time-off-${entry.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-panel bg-canvas px-3 py-2"
              >
                <span className="flex min-w-0 flex-col leading-label">
                  <span className="truncate text-value font-medium text-ink">{entry.reason}</span>
                  <Ltr className="text-label tabular-nums text-ink-muted">
                    {whole
                      ? formatDate(entry.startsAt)
                      : formatPeriod(entry.startsAt, entry.endsAt)}
                  </Ltr>
                </span>

                <span className="flex items-center gap-2">
                  <Badge tone={whole ? "neutral" : "warning"} data-testid="time-off-kind">
                    {t(whole ? "schedule.timeOff.wholeDay" : "schedule.timeOff.partial")}
                  </Badge>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="quiet"
                      icon={<Icon name="trash" />}
                      data-testid="time-off-delete"
                      onClick={() => remove(entry)}
                    >
                      {t("common.delete")}
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        data-testid="time-off-add-modal"
        open={adding}
        onOpenChange={(open) => {
          setAdding(open);
          if (!open) {
            reset();
          }
        }}
        title="schedule.timeOff.add"
        footer={
          <>
            <Button
              icon={<Icon name="x" />}
              variant="secondary"
              data-testid="time-off-add-cancel"
              onClick={() => setAdding(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              icon={<Icon name="check" />}
              data-testid="time-off-add-save"
              aria-disabled={!form.isValid || undefined}
              isLoading={createTimeOff.isPending}
              onClick={() => void save()}
            >
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div ref={form.formRef} className="flex flex-col gap-4">
          <Switch
            data-testid="time-off-field-whole-day"
            checked={wholeDay}
            label={t("schedule.timeOff.wholeDay")}
            onCheckedChange={setWholeDay}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div onBlur={form.leave("from")}>
              <FormField
                label="schedule.timeOff.from"
                htmlFor="time-off-from"
                error={errors["from"] ?? errors["startsAt"]}
              >
                <DatePicker
                  id="time-off-from"
                  data-testid="time-off-field-from"
                  label={t("schedule.timeOff.from")}
                  value={from}
                  onChange={setFrom}
                />
              </FormField>
            </div>

            {wholeDay ? (
              <div onBlur={form.leave("to")}>
                <FormField
                  label="schedule.timeOff.to"
                  htmlFor="time-off-to"
                  error={errors["to"] ?? errors["endsAt"]}
                  optional
                >
                  <DatePicker
                    id="time-off-to"
                    data-testid="time-off-field-to"
                    label={t("schedule.timeOff.to")}
                    value={to}
                    onChange={setTo}
                  />
                </FormField>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                <div onBlur={form.leave("startTime")}>
                  <FormField
                    label="schedule.from"
                    htmlFor="time-off-start"
                    error={errors["startTime"]}
                  >
                    <TimePicker
                      id="time-off-start"
                      data-testid="time-off-field-start"
                      label={t("schedule.from")}
                      value={startTime}
                      onChange={setStartTime}
                    />
                  </FormField>
                </div>

                <div onBlur={form.leave("endsAt")}>
                  <FormField
                    label="schedule.to"
                    htmlFor="time-off-end"
                    error={errors["endTime"] ?? errors["endsAt"]}
                  >
                    <TimePicker
                      id="time-off-end"
                      data-testid="time-off-field-end"
                      label={t("schedule.to")}
                      min={startTime}
                      value={endTime}
                      onChange={setEndTime}
                    />
                  </FormField>
                </div>
              </div>
            )}
          </div>

          <div onBlur={form.leave("reason")}>
            <FormField
              label="schedule.timeOff.reason"
              htmlFor="time-off-reason"
              error={errors["reason"]}
            >
              <Input
                id="time-off-reason"
                data-testid="time-off-field-reason"
                placeholder={t("schedule.timeOff.reasonPlaceholder")}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </FormField>
          </div>
        </div>
      </Modal>

      <ConflictDialog
        data-testid="time-off-conflict-dialog"
        open={conflicts !== null}
        onOpenChange={(open) => !open && setConflicts(null)}
        conflicts={conflicts ?? []}
        isSaving={createTimeOff.isPending}
        onCancelThem={() => void save({ force: true, cancelAppointments: true })}
        onKeepThem={() => void save({ force: true, cancelAppointments: false })}
      />
    </>
  );
}
