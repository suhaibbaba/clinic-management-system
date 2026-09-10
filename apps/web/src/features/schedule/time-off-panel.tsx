import type { ConflictingAppointment, DoctorTimeOff } from '@clinic/shared';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

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
  RowAction,
  Switch,
  TimePicker,
  useToast,
} from '@web/components/ui';
import { ConflictDialog } from '@web/features/schedule/conflict-dialog';
import {
  scheduleConflicts,
  useCreateTimeOff,
  useDeleteTimeOff,
  useDoctorTimeOff,
} from '@web/features/schedule/queries';
import { errorMessageKey } from '@web/lib/api-error';
import { formatClinicDate, formatClinicPeriod } from '@web/lib/format';

export interface TimeOffPanelProps {
  readonly doctorId: string;
  readonly canEdit: boolean;
}

const instant = (date: string, time: string): string =>
  new Date(`${date}T${time}:00`).toISOString();

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

// A per-day "off" switch cannot say "Thursday afternoon at a conference". Whole days are stored
// midnight to midnight rather than as a flag, so nothing downstream branches.
export function TimeOffPanel({ doctorId, canEdit }: TimeOffPanelProps): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();

  const timeOff = useDoctorTimeOff(doctorId, { limit: 50 });
  const createTimeOff = useCreateTimeOff();
  const deleteTimeOff = useDeleteTimeOff();

  const [adding, setAdding] = useState(false);
  const [wholeDay, setWholeDay] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('18:00');
  const [reason, setReason] = useState('');
  const [conflicts, setConflicts] = useState<ConflictingAppointment[] | null>(null);

  const reset = (): void => {
    setWholeDay(true);
    setFrom('');
    setTo('');
    setStartTime('14:00');
    setEndTime('18:00');
    setReason('');
    setConflicts(null);
  };

  const canSubmit =
    from !== '' && reason.trim().length >= 2 && (wholeDay || (startTime !== '' && endTime !== ''));

  const save = async (choice?: { force: boolean; cancelAppointments: boolean }): Promise<void> => {
    // A whole-day absence runs to midnight of the day *after* the last one, so
    // the last day is covered end to end.
    const lastDay = to === '' ? from : to;
    const dayAfter = new Date(`${lastDay}T00:00:00`);
    dayAfter.setDate(dayAfter.getDate() + 1);

    try {
      const result = await createTimeOff.mutateAsync({
        doctorId,
        body: {
          startsAt: wholeDay ? instant(from, '00:00') : instant(from, startTime),
          endsAt: wholeDay ? dayAfter.toISOString() : instant(from, endTime),
          reason: reason.trim(),
        },
        ...(choice && { choice }),
      });

      if (result.cancelledAppointments > 0) {
        toast.success('schedule.timeOff.addedAndCancelled', {
          count: result.cancelledAppointments,
        });
      } else {
        toast.success('schedule.timeOff.added');
      }

      setAdding(false);
      reset();
    } catch (error) {
      const clash = scheduleConflicts(error);

      if (clash) {
        setConflicts(clash);
        return;
      }

      toast.error(errorMessageKey(error));
    }
  };

  const remove = async (entry: DoctorTimeOff): Promise<void> => {
    try {
      await deleteTimeOff.mutateAsync(entry.id);
      toast.success('schedule.timeOff.removed');
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const rows = timeOff.data?.items ?? [];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-value font-medium text-ink">{t('schedule.timeOff.title')}</p>

        {canEdit && (
          <Button
            icon={<Icon name="plus" />}
            size="sm"
            variant="secondary"
            onClick={() => {
              reset();
              setAdding(true);
            }}
          >
            {t('schedule.timeOff.add')}
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="clock" title="schedule.timeOff.empty" hint="schedule.timeOff.emptyHint" />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((entry) => {
            const whole = isWholeDays(entry.startsAt, entry.endsAt);

            return (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-panel bg-canvas px-3 py-2"
              >
                <span className="flex min-w-0 flex-col leading-snug">
                  <span className="truncate text-value font-medium text-ink">{entry.reason}</span>
                  {/* The clinic's zone and a 24-hour clock, so the period is Latin inside one island
                      — an Arabic "ص" reorders the string it is embedded in. */}
                  <Ltr className="text-label tabular-nums text-ink-muted">
                    {whole
                      ? formatClinicDate(entry.startsAt)
                      : formatClinicPeriod(entry.startsAt, entry.endsAt)}
                  </Ltr>
                </span>

                <span className="flex items-center gap-2">
                  <Badge tone={whole ? 'neutral' : 'warning'}>
                    {t(whole ? 'schedule.timeOff.wholeDay' : 'schedule.timeOff.partial')}
                  </Badge>
                  {canEdit && (
                    <RowAction
                      icon={<Icon name="trash" />}
                      tone="quiet"
                      onClick={() => void remove(entry)}
                    >
                      {t('common.delete')}
                    </RowAction>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
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
            <Button icon={<Icon name="x" />} variant="secondary" onClick={() => setAdding(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              icon={<Icon name="check" />}
              disabled={!canSubmit}
              isLoading={createTimeOff.isPending}
              onClick={() => void save()}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Switch
            checked={wholeDay}
            label={t('schedule.timeOff.wholeDay')}
            onCheckedChange={setWholeDay}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="schedule.timeOff.from" htmlFor="time-off-from">
              <DatePicker
                id="time-off-from"
                label={t('schedule.timeOff.from')}
                value={from}
                onChange={setFrom}
              />
            </FormField>

            {wholeDay ? (
              <FormField label="schedule.timeOff.to" htmlFor="time-off-to" optional>
                <DatePicker
                  id="time-off-to"
                  label={t('schedule.timeOff.to')}
                  value={to}
                  onChange={setTo}
                />
              </FormField>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <FormField label="schedule.from" htmlFor="time-off-start">
                  <TimePicker
                    id="time-off-start"
                    label={t('schedule.from')}
                    value={startTime}
                    onChange={setStartTime}
                  />
                </FormField>

                <FormField label="schedule.to" htmlFor="time-off-end">
                  <TimePicker
                    id="time-off-end"
                    label={t('schedule.to')}
                    min={startTime}
                    value={endTime}
                    onChange={setEndTime}
                  />
                </FormField>
              </div>
            )}
          </div>

          <FormField label="schedule.timeOff.reason" htmlFor="time-off-reason">
            <Input
              id="time-off-reason"
              placeholder={t('schedule.timeOff.reasonPlaceholder')}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
        </div>
      </Modal>

      <ConflictDialog
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
