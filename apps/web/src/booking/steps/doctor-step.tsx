import type { PublicDoctor } from '@clinic/shared';
import type { JSX } from 'react';

import { failureKey } from '@web/booking/api';
import { t } from '@web/booking/i18n';
import { Alert, Button, ChoiceCard, Skeleton } from '@web/booking/ui';
import type { AsyncState } from '@web/booking/use-async';
import { bookingName } from '@web/booking/format';

/** The honorific is stripped in both languages, or every doctor is a circle with a D in it. */
const initial = (name: string): string => {
  const stripped = name.replace(/^\s*(?:د\.|dr\.?)\s*/i, '').trim(); // i18n-allow: an honorific being matched in stored data, not text on screen

  return (stripped[0] ?? name[0] ?? '').toUpperCase();
};

export function DoctorStep({
  doctors,
  selectedId,
  onSelect,
}: {
  readonly doctors: AsyncState<PublicDoctor[]>;
  readonly selectedId: string | undefined;
  readonly onSelect: (doctor: PublicDoctor) => void;
}): JSX.Element {
  if (doctors.loading) {
    return (
      <ul className="flex flex-col gap-3">
        {[0, 1, 2].map((index) => (
          <li key={index}>
            <Skeleton className="h-[76px] rounded-card" />
          </li>
        ))}
      </ul>
    );
  }

  if (doctors.error) {
    return (
      <div className="flex flex-col gap-3">
        <Alert>{t(failureKey(doctors.error))}</Alert>
        <Button variant="secondary" onClick={doctors.reload}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  const list = doctors.data ?? [];

  if (list.length === 0) {
    return <Alert tone="info">{t('doctor.empty')}</Alert>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {list.map((doctor) => (
        <li key={doctor.id}>
          <ChoiceCard
            selected={doctor.id === selectedId}
            onClick={() => onSelect(doctor)}
            label={t('doctor.choose', { name: bookingName(doctor.name) })}
          >
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-primary-100 text-value font-semibold text-primary-800"
            >
              {initial(bookingName(doctor.name))}
            </span>

            <span className="min-w-0">
              <span className="block truncate text-field font-semibold text-ink">
                {bookingName(doctor.name)}
              </span>
              <span className="block truncate text-label text-ink-muted">{doctor.specialty}</span>
            </span>
          </ChoiceCard>
        </li>
      ))}
    </ul>
  );
}
