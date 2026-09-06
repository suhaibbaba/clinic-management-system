import { isBookingName, isBookingPhone } from '@shared/constants/booking';
import { useState, type FormEvent, type JSX } from 'react';

import { t } from '@web/booking/i18n';
import { Button, Field } from '@web/booking/ui';

export interface BookingDetails {
  readonly fullName: string;
  readonly phone: string;
  readonly reason: string;
}

/**
 * Step three: who is coming, and on which number.
 *
 * Both fields are checked against the **same rules the booking DTO enforces**
 * (CLAUDE.md: never duplicate validation) — `isBookingName` and
 * `isBookingPhone` are what `createBookingSchema` is built out of, in a
 * Zod-free module so this page does not ship 45 KB of schema machinery to
 * check that a name is two characters long. The API remains the boundary; this
 * only saves the patient a round trip.
 */
export function DetailsStep({
  details,
  onChange,
  onSubmit,
  busy,
  summary,
}: {
  readonly details: BookingDetails;
  readonly onChange: (details: BookingDetails) => void;
  readonly onSubmit: () => void;
  readonly busy: boolean;
  /** The doctor and time chosen so far, so nobody submits blind. */
  readonly summary: JSX.Element;
}): JSX.Element {
  const [touched, setTouched] = useState(false);

  const nameError = isBookingName(details.fullName) ? undefined : t('details.nameError');
  const phoneError = isBookingPhone(details.phone) ? undefined : t('details.phoneError');

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    setTouched(true);

    if (!nameError && !phoneError) {
      onSubmit();
    }
  };

  return (
    // `noValidate`: the browser's own bubble is English and unstyled, and it
    // would fire before the Arabic message below the field.
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      {summary}

      <Field
        label={t('details.name')}
        name="fullName"
        autoComplete="name"
        placeholder={t('details.namePlaceholder')}
        value={details.fullName}
        error={touched ? nameError : undefined}
        onChange={(event) => onChange({ ...details, fullName: event.target.value })}
      />

      <Field
        label={t('details.phone')}
        name="phone"
        // `tel` gives the phone's own keypad; `dir="ltr"` keeps a leading +
        // and the digits in the order they were typed.
        type="tel"
        inputMode="tel"
        dir="ltr"
        autoComplete="tel"
        placeholder={t('details.phonePlaceholder')}
        hint={t('details.phoneHint')}
        value={details.phone}
        error={touched ? phoneError : undefined}
        onChange={(event) => onChange({ ...details, phone: event.target.value })}
      />

      <Field
        label={t('details.reason')}
        name="reason"
        placeholder={t('details.reasonPlaceholder')}
        value={details.reason}
        onChange={(event) => onChange({ ...details, reason: event.target.value })}
      />

      <p className="text-label text-ink-muted">{t('details.terms')}</p>

      <Button type="submit" full busy={busy}>
        {t('details.submit')}
      </Button>
    </form>
  );
}
