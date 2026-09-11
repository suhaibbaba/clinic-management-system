import type { ManagedBooking } from '@clinic/shared';
import type { JSX } from 'react';

import { formatLongDate, formatTime } from '@web/booking/format';
import { t } from '@web/booking/i18n';
import { downloadIcs } from '@web/booking/ics';
import { Button, Card, cx } from '@web/booking/ui';
import { bookingName } from '@web/booking/format';

// The manage link is mentioned rather than printed: this screen is often a screenshot, and that
// link is a credential.
export function SuccessView({ booking }: { readonly booking: ManagedBooking }): JSX.Element {
  return (
    <div className="booking-step flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <span
          aria-hidden
          className="flex size-14 items-center justify-center rounded-pill bg-success-100 text-[1.75rem] text-success-700"
        >
          ✓
        </span>
        <h1 className="text-title font-medium text-primary-900">{t('success.heading')}</h1>
      </div>

      <BookingFacts booking={booking} />

      <Button variant="secondary" full onClick={() => downloadIcs(booking)}>
        {t('success.addToCalendar')}
      </Button>

      <p className="text-center text-label text-ink-muted">{t('success.manageHint')}</p>
    </div>
  );
}

/** Manual-confirmation clinics: reception rings back, so say exactly that. */
export function PendingView({ booking }: { readonly booking?: ManagedBooking }): JSX.Element {
  return (
    <div className="booking-step flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <span
          aria-hidden
          className="flex size-14 items-center justify-center rounded-pill bg-warning-100 text-[1.5rem] text-warning-700"
        >
          ⏳
        </span>
        <h1 className="text-title font-medium text-primary-900">{t('success.manual')}</h1>
        <p className="text-value text-ink-muted">{t('success.manualBody')}</p>
      </div>

      {booking && <BookingFacts booking={booking} />}
    </div>
  );
}

export function BookingFacts({ booking }: { readonly booking: ManagedBooking }): JSX.Element {
  return (
    <Card>
      <dl className="flex flex-col gap-3">
        <Row label={t('success.doctor')} value={bookingName(booking.doctorName)} />
        <Row label={t('success.date')} value={formatLongDate(booking.startsAt)} />
        <Row label={t('success.time')} value={formatTime(booking.startsAt)} ltr />
        <Row label={t('success.clinic')} value={bookingName(booking.clinicName)} />
      </dl>
    </Card>
  );
}

function Row({
  label,
  value,
  ltr = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly ltr?: boolean;
}): JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-label text-ink-muted">{label}</dt>
      <dd
        className={cx('min-w-0 truncate text-value font-medium text-ink', ltr && 'tabular-nums')}
        {...(ltr && { dir: 'ltr' })}
      >
        {value}
      </dd>
    </div>
  );
}
