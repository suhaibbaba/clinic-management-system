import type { PublicDoctor } from '@clinic/shared';
import type { JSX } from 'react';

import { failureKey } from '@web/booking/api';
import { t } from '@web/booking/i18n';
import { Alert, Button, ChoiceCard, Skeleton } from '@web/booking/ui';
import type { AsyncState } from '@web/booking/use-async';

/**
 * The letter in the circle.
 *
 * "Dr. Layla Haddad" would otherwise be a circle with a D in it, and so would
 * every one of her colleagues — an avatar that tells two doctors apart is the
 * only reason to draw one. The honorific is stripped in both languages.
 */
const initial = (name: string): string => {
  const stripped = name.replace(/^\s*(?:د\.|dr\.?)\s*/i, '').trim();

  return (stripped[0] ?? name[0] ?? '').toUpperCase();
};

/**
 * Step one: who.
 *
 * Cards rather than a `<select>`: on a phone a native select is a wheel that
 * hides every option but one, and choosing a doctor is the decision this page
 * opens with. Name and specialty only — the public API returns nothing else,
 * deliberately (a weekly schedule is information about how the clinic runs).
 */
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
            label={t('doctor.choose', { name: doctor.name })}
          >
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-primary-100 text-value font-semibold text-primary-800"
            >
              {initial(doctor.name)}
            </span>

            <span className="min-w-0">
              <span className="block truncate text-field font-semibold text-ink">
                {doctor.name}
              </span>
              <span className="block truncate text-label text-ink-muted">{doctor.specialty}</span>
            </span>
          </ChoiceCard>
        </li>
      ))}
    </ul>
  );
}
