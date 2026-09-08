import type { ClinicClosure, ConflictingAppointment } from '@clinic/shared';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Badge,
  Button,
  DateRangePicker,
  EmptyState,
  FormField,
  Icon,
  Input,
  Ltr,
  Modal,
  RowAction,
  Switch,
  useToast,
  type DateRange,
} from '@web/components/ui';
import { ConflictDialog } from '@web/features/schedule/conflict-dialog';
import {
  scheduleConflicts,
  useClinicClosures,
  useCreateClosure,
  useDeleteClosure,
} from '@web/features/schedule/queries';
import { errorMessageKey } from '@web/lib/api-error';
import { formatDate } from '@web/lib/format';

/**
 * The days the clinic is shut, in settings.
 *
 * A list and one "add" dialog, rather than a screen of its own: a clinic
 * records four or five of these a year, next to the opening hours they
 * override, and a route nobody visits between Eids is a route people forget
 * exists.
 *
 * Adding one goes through the conflict flow — see `ConflictDialog`.
 */
export function ClosuresPanel({ canEdit }: { readonly canEdit: boolean }): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();

  const closures = useClinicClosures({ limit: 50 });
  const createClosure = useCreateClosure();
  const deleteClosure = useDeleteClosure();

  const [adding, setAdding] = useState(false);
  const [range, setRange] = useState<DateRange>({ from: '', to: '' });
  const [reason, setReason] = useState('');
  const [isAnnual, setIsAnnual] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictingAppointment[] | null>(null);

  const reset = (): void => {
    setRange({ from: '', to: '' });
    setReason('');
    setIsAnnual(false);
    setConflicts(null);
  };

  const canSubmit = range.from !== '' && reason.trim().length >= 2;

  /**
   * One save path for all three attempts — the first, and the two the conflict
   * dialog leads to. The only difference is what the caller decided, which is
   * exactly what `choice` carries.
   */
  const save = async (choice?: { force: boolean; cancelAppointments: boolean }): Promise<void> => {
    try {
      const result = await createClosure.mutateAsync({
        body: {
          startsOn: range.from,
          // A single day is entered by picking one date; the API wants both
          // ends, and both ends are inclusive.
          endsOn: range.to === '' ? range.from : range.to,
          reason: reason.trim(),
          isAnnual,
        },
        ...(choice && { choice }),
      });

      // The count is worth saying out loud: cancelling is the irreversible half.
      if (result.cancelledAppointments > 0) {
        toast.success('schedule.closures.addedAndCancelled', {
          count: result.cancelledAppointments,
        });
      } else {
        toast.success('schedule.closures.added');
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

  const remove = async (closure: ClinicClosure): Promise<void> => {
    try {
      await deleteClosure.mutateAsync(closure.id);
      toast.success('schedule.closures.removed');
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const rows = closures.data?.items ?? [];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-value font-medium text-ink">{t('schedule.closures.title')}</p>

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
            {t('schedule.closures.add')}
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="schedule.closures.empty"
          hint="schedule.closures.emptyHint"
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((closure) => (
            <li
              key={closure.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-panel bg-canvas px-3 py-2"
            >
              <span className="flex min-w-0 flex-col leading-snug">
                <span className="truncate text-value font-medium text-ink">{closure.reason}</span>
                {/* One island around the pair: the em dash between two dates
                    is a neutral character, and left to the Arabic paragraph it
                    swaps the two ends of the closure. */}
                <Ltr className="text-label tabular-nums text-ink-muted">
                  {closure.startsOn === closure.endsOn
                    ? formatDate(closure.startsOn)
                    : `${formatDate(closure.startsOn)} — ${formatDate(closure.endsOn)}`}
                </Ltr>
              </span>

              <span className="flex items-center gap-2">
                {closure.isAnnual && <Badge tone="info">{t('schedule.closures.annual')}</Badge>}
                {canEdit && (
                  <RowAction
                    icon={<Icon name="trash" />}
                    tone="quiet"
                    onClick={() => void remove(closure)}
                  >
                    {t('common.delete')}
                  </RowAction>
                )}
              </span>
            </li>
          ))}
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
        title="schedule.closures.add"
        footer={
          <>
            <Button icon={<Icon name="x" />} variant="secondary" onClick={() => setAdding(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              icon={<Icon name="check" />}
              disabled={!canSubmit}
              isLoading={createClosure.isPending}
              onClick={() => void save()}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="schedule.closures.dates" htmlFor="closure-dates">
            <DateRangePicker
              id="closure-dates"
              label={t('schedule.closures.dates')}
              value={range}
              onChange={setRange}
            />
          </FormField>

          <FormField label="schedule.closures.reason" htmlFor="closure-reason">
            <Input
              id="closure-reason"
              placeholder={t('schedule.closures.reasonPlaceholder')}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>

          <div>
            <Switch
              checked={isAnnual}
              label={t('schedule.closures.annual')}
              onCheckedChange={setIsAnnual}
            />
            <p className="mt-1 text-label text-ink-subtle">{t('schedule.closures.annualHint')}</p>
          </div>
        </div>
      </Modal>

      <ConflictDialog
        open={conflicts !== null}
        onOpenChange={(open) => !open && setConflicts(null)}
        conflicts={conflicts ?? []}
        isSaving={createClosure.isPending}
        onCancelThem={() => void save({ force: true, cancelAppointments: true })}
        onKeepThem={() => void save({ force: true, cancelAppointments: false })}
      />
    </>
  );
}
