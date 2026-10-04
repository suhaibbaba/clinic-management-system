import { createDoctorExtraHoursSchema, type DoctorExtraHours } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  DatePicker,
  EmptyState,
  FormField,
  Icon,
  Input,
  Ltr,
  Modal,
  TimePicker,
  useConfirm,
  useToast,
} from "@clinic/ui";
import {
  useCreateExtraHours,
  useDeleteExtraHours,
  useDoctorExtraHours,
} from "@web/modules/schedule/queries";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { errorToast } from "@web/shared/lib/api-error";
import { isIsoDate, todayIso } from "@web/shared/lib/dates";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { formatDate } from "@web/shared/lib/format";

export interface ExtraHoursPanelProps {
  readonly doctorId: string;
  readonly canEdit: boolean;
}

const dayOf = (isoDate: string): string => formatDate(`${isoDate}T12:00:00Z`);

export function ExtraHoursPanel({ doctorId, canEdit }: ExtraHoursPanelProps): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();

  const extraHours = useDoctorExtraHours(doctorId, { limit: 50 });
  const createExtraHours = useCreateExtraHours();
  const deleteExtraHours = useDeleteExtraHours();
  const { confirm, dialog } = useConfirm("extra-hours-confirm-remove");

  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState("");
  const [start, setStart] = useState("17:00");
  const [end, setEnd] = useState("20:00");
  const [reason, setReason] = useState("");

  const today = todayIso();
  const body = { date, ranges: [{ start, end }], reason: reason.trim() };
  const problems = schemaErrors(createDoctorExtraHoursSchema, body);
  const form = useFormErrors({
    ...problems,
    ...(isIsoDate(date) && date < today && { date: { type: "too_small" } }),
  });
  const { errors } = form;

  const reset = (): void => {
    setDate("");
    setStart("17:00");
    setEnd("20:00");
    setReason("");
    form.reset();
  };

  const save = async (): Promise<void> => {
    if (!form.check()) {
      return;
    }

    try {
      await createExtraHours.mutateAsync({ doctorId, body });
      toast.success("schedule.extraHours.added");
      setAdding(false);
      reset();
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  const remove = (entry: DoctorExtraHours): void =>
    confirm({
      title: "schedule.extraHours.confirmRemove.title",
      titleValues: { date: dayOf(entry.date) },
      consequences: [t("schedule.extraHours.confirmRemove.consequence")],
      onConfirm: async () => {
        try {
          await deleteExtraHours.mutateAsync(entry.id);
          toast.success("schedule.extraHours.removed");
        } catch (error) {
          toast.error(...errorToast(error));
          throw error;
        }
      },
    });

  const rows = extraHours.data?.items ?? [];

  return (
    <>
      {dialog}
      <div
        data-testid="extra-hours-panel"
        className="mb-3 flex flex-wrap items-center justify-between gap-2"
      >
        <div className="min-w-0">
          <p className="text-value font-medium text-ink">{t("schedule.extraHours.title")}</p>
          <p className="text-label text-ink-muted">{t("schedule.extraHours.about")}</p>
        </div>

        {canEdit && (
          <Button
            icon={<Icon name="plus" />}
            size="sm"
            variant="secondary"
            data-testid="extra-hours-add"
            onClick={() => {
              reset();
              setAdding(true);
            }}
          >
            {t("schedule.extraHours.add")}
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="clock"
          data-testid="extra-hours-empty"
          title="schedule.extraHours.empty"
          hint="schedule.extraHours.emptyHint"
        />
      ) : (
        <ul data-testid="extra-hours-list" className="flex flex-col gap-2">
          {rows.map((entry) => (
            <li
              key={entry.id}
              data-testid={`extra-hours-${entry.id}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-panel bg-canvas px-3 py-2"
            >
              <span className="flex min-w-0 flex-col leading-label">
                <span className="truncate text-value font-medium text-ink">{entry.reason}</span>
                <span className="text-label text-ink-muted">
                  <Ltr className="tabular-nums">{dayOf(entry.date)}</Ltr>
                  {" · "}
                  <Ltr className="tabular-nums" data-testid="extra-hours-ranges">
                    {entry.ranges.map((range) => `${range.start}–${range.end}`).join(", ")}
                  </Ltr>
                </span>
              </span>

              {canEdit && entry.date >= today && (
                <Button
                  size="sm"
                  variant="quiet"
                  icon={<Icon name="trash" />}
                  data-testid="extra-hours-delete"
                  onClick={() => remove(entry)}
                >
                  {t("common.delete")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        data-testid="extra-hours-add-modal"
        open={adding}
        onOpenChange={(open) => {
          setAdding(open);
          if (!open) {
            reset();
          }
        }}
        title="schedule.extraHours.add"
        footer={
          <>
            <Button
              icon={<Icon name="x" />}
              variant="secondary"
              data-testid="extra-hours-add-cancel"
              onClick={() => setAdding(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              icon={<Icon name="check" />}
              data-testid="extra-hours-add-save"
              aria-disabled={!form.isValid || undefined}
              isLoading={createExtraHours.isPending}
              onClick={() => void save()}
            >
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div ref={form.formRef} className="flex flex-col gap-4">
          <div onBlur={form.leave("date")} className="max-w-(--field-max)">
            <FormField
              label="schedule.extraHours.date"
              htmlFor="extra-hours-date"
              error={errors["date"]}
              errorKey={
                errors["date"]?.type === "too_small" ? "schedule.extraHours.pastDate" : undefined
              }
            >
              <DatePicker
                id="extra-hours-date"
                data-testid="extra-hours-field-date"
                label={t("schedule.extraHours.date")}
                min={today}
                value={date}
                onChange={setDate}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div onBlur={form.leave("ranges.0.start")}>
              <FormField
                label="schedule.from"
                htmlFor="extra-hours-start"
                error={errors["ranges.0.start"]}
              >
                <TimePicker
                  id="extra-hours-start"
                  data-testid="extra-hours-field-start"
                  label={t("schedule.from")}
                  value={start}
                  onChange={setStart}
                />
              </FormField>
            </div>

            <div onBlur={form.leave("ranges.0.end")}>
              <FormField
                label="schedule.to"
                htmlFor="extra-hours-end"
                error={errors["ranges.0.end"]}
                errorKey={errors["ranges.0.end"] ? "schedule.extraHours.endAfterStart" : undefined}
              >
                <TimePicker
                  id="extra-hours-end"
                  data-testid="extra-hours-field-end"
                  label={t("schedule.to")}
                  min={start}
                  value={end}
                  onChange={setEnd}
                />
              </FormField>
            </div>
          </div>

          <div onBlur={form.leave("reason")}>
            <FormField
              label="schedule.extraHours.reason"
              htmlFor="extra-hours-reason"
              error={errors["reason"]}
            >
              <Input
                id="extra-hours-reason"
                data-testid="extra-hours-field-reason"
                placeholder={t("schedule.extraHours.reasonPlaceholder")}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </FormField>
          </div>
        </div>
      </Modal>
    </>
  );
}
