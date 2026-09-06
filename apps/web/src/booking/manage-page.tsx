import type { ManagedBooking } from '@clinic/shared';
import { APPOINTMENT_STATUS } from '@shared/enums';
import { useMemo, useState, type JSX } from 'react';

import { bookingApi, failureKey } from '@web/booking/api';
import { clinicDate, dayChips, learnClinicOffset } from '@web/booking/format';
import { t } from '@web/booking/i18n';
import { FullPageMessage, PageShell } from '@web/booking/layout';
import { BookingFacts } from '@web/booking/steps/success-view';
import { WhenStep, type SlotOption } from '@web/booking/steps/when-step';
import { Alert, Button, Card, Skeleton } from '@web/booking/ui';
import { useAsync } from '@web/booking/use-async';

const VISIBLE_DAYS = 7;

const STATUS_KEY: Record<string, string> = {
  [APPOINTMENT_STATUS.REQUESTED]: 'manage.statusRequested',
  [APPOINTMENT_STATUS.CONFIRMED]: 'manage.statusConfirmed',
  [APPOINTMENT_STATUS.CANCELLED]: 'manage.statusCancelled',
  [APPOINTMENT_STATUS.COMPLETED]: 'manage.statusCompleted',
};

type Mode = 'view' | 'confirming-cancel' | 'rescheduling';

/**
 * The link that went out by SMS.
 *
 * The token is the only credential — there is no account — so the page shows
 * what that token stands for and nothing else: an appointment's own facts, no
 * file number, no history, no other visit. Whether it may still be changed is
 * the API's answer (`canModify`), not this page's arithmetic; when the answer
 * is no, the clinic's phone number is what the screen offers instead.
 *
 * Rescheduling needs a doctor id to ask for slots, which the managed view does
 * not carry (it names the doctor, not their id). The clinic's public doctor
 * list is matched by name — which is why the reschedule strip appears only
 * when that match succeeds, rather than showing an empty grid.
 */
export function ManagePage({
  token,
  slug,
}: {
  readonly token: string;
  /** Resolved by `route.ts`: the link's `?clinic=`, or what this browser
   *  remembered when it made the booking. */
  readonly slug: string | undefined;
}): JSX.Element {
  const managed = useAsync(() => bookingApi.managed(token), [token]);
  const [mode, setMode] = useState<Mode>('view');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();

  const booking = managed.data;

  if (managed.loading) {
    return (
      <PageShell clinicName={undefined}>
        <Skeleton className="h-8 w-1/2" />
        <div className="mt-4">
          <Skeleton className="h-40 rounded-card" />
        </div>
      </PageShell>
    );
  }

  if (managed.error || !booking) {
    return (
      <PageShell clinicName={undefined}>
        <FullPageMessage title={t(failureKey(managed.error))} />
      </PageShell>
    );
  }

  const cancelled = booking.status === APPOINTMENT_STATUS.CANCELLED;

  const act = async (run: () => Promise<ManagedBooking>): Promise<void> => {
    setBusy(true);
    setFailure(undefined);

    try {
      await run();
      setMode('view');
      managed.reload();
    } catch (error) {
      setFailure(t(failureKey(error)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell clinicName={booking.clinicName}>
      <h1 className="mb-4 text-[1.375rem] font-semibold tracking-[-0.02em] text-ink">
        {t('manage.heading')}
      </h1>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="text-label text-ink-muted">{t('manage.status')}</span>
          <span
            className={
              cancelled
                ? 'rounded-pill bg-neutral-100 px-2.5 py-1 text-label font-medium text-ink-muted'
                : 'rounded-pill bg-success-100 px-2.5 py-1 text-label font-medium text-success-800'
            }
          >
            {t(STATUS_KEY[booking.status] ?? 'manage.statusRequested')}
          </span>
        </div>

        <BookingFacts booking={booking} />

        {failure && <Alert>{failure}</Alert>}

        {cancelled ? (
          <Alert tone="info">{t('manage.cancelled')}</Alert>
        ) : !booking.canModify ? (
          <Card className="bg-inset shadow-none">
            <p className="text-value text-ink-muted">
              {t('manage.locked', { phone: booking.clinicPhone ?? '' })}
            </p>
            {booking.clinicPhone && (
              <a
                href={`tel:${booking.clinicPhone}`}
                className="mt-2 inline-block text-value font-semibold text-primary-700"
              >
                {t('manage.callClinic')}
              </a>
            )}
          </Card>
        ) : mode === 'confirming-cancel' ? (
          <Card>
            <h2 className="text-field font-semibold text-ink">{t('manage.cancelTitle')}</h2>
            <p className="mt-1 text-value text-ink-muted">{t('manage.cancelBody')}</p>

            <label htmlFor="cancel-reason" className="mt-3 block text-value font-medium text-ink">
              {t('manage.cancelReason')}
            </label>
            <input
              id="cancel-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1.5 min-h-12 w-full rounded-control border border-line-strong bg-surface px-3 text-field"
            />

            <div className="mt-4 flex flex-col gap-2">
              <Button
                variant="danger"
                full
                busy={busy}
                onClick={() => void act(() => bookingApi.cancel(token, reason.trim() || undefined))}
              >
                {t('manage.cancelConfirm')}
              </Button>
              <Button variant="secondary" full onClick={() => setMode('view')}>
                {t('manage.cancelKeep')}
              </Button>
            </div>
          </Card>
        ) : mode === 'rescheduling' ? (
          <ReschedulePanel
            booking={booking}
            slug={slug}
            busy={busy}
            onPick={(slot) => void act(() => bookingApi.reschedule(token, slot.startsAt))}
            onClose={() => setMode('view')}
          />
        ) : (
          <div className="flex flex-col gap-2">
            <Button variant="secondary" full onClick={() => setMode('rescheduling')}>
              {t('manage.reschedule')}
            </Button>
            <Button variant="ghost" full onClick={() => setMode('confirming-cancel')}>
              {t('manage.cancel')}
            </Button>
          </div>
        )}
      </div>
    </PageShell>
  );
}

/**
 * The same slot picker the wizard uses, pointed at the booking's own doctor.
 *
 * Without a clinic slug in the link there is nothing to ask for slots with, so
 * the panel says the clinic's phone number instead of rendering a grid that
 * can never fill.
 */
function ReschedulePanel({
  booking,
  slug,
  busy,
  onPick,
  onClose,
}: {
  readonly booking: ManagedBooking;
  readonly slug: string | undefined;
  readonly busy: boolean;
  readonly onPick: (slot: SlotOption) => void;
  readonly onClose: () => void;
}): JSX.Element {
  const [date, setDate] = useState(() => clinicDate(booking.startsAt));

  const doctors = useAsync(() => bookingApi.doctors(slug ?? ''), [slug], Boolean(slug));
  const doctorId = doctors.data?.find((entry) => entry.name === booking.doctorName)?.id;

  const chips = useMemo(() => dayChips(date, VISIBLE_DAYS, 365), [date]);

  const week = useAsync(
    async () => {
      const days = await Promise.all(
        chips.map((chip) => bookingApi.slots(slug ?? '', doctorId ?? '', chip.date)),
      );

      const sample = days.flatMap((day) => day.slots)[0];
      if (sample) {
        learnClinicOffset(sample.startsAt, sample.start);
      }

      return days;
    },
    [slug, doctorId, chips.length, date],
    Boolean(slug && doctorId),
  );

  if (!slug || (doctors.data && !doctorId)) {
    return (
      <Card className="bg-inset shadow-none">
        <p className="text-value text-ink-muted">
          {t('manage.locked', { phone: booking.clinicPhone ?? '' })}
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-field font-semibold text-ink">{t('manage.rescheduleTitle')}</h2>

      <WhenStep
        chips={chips}
        week={week}
        date={date}
        onDate={setDate}
        selected={undefined}
        onSelect={onPick}
      />

      <Button variant="secondary" full disabled={busy} onClick={onClose}>
        {t('common.back')}
      </Button>
    </div>
  );
}
