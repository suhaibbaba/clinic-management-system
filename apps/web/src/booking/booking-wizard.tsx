import type { ManagedBooking, PublicDoctor } from '@clinic/shared';
import { BOOKING_CONFIRMATION_MODE } from '@shared/enums';
import { useEffect, useMemo, useState, type JSX } from 'react';

import { BookingError, bookingApi, failureKey } from '@web/booking/api';
import { dayChips, learnClinicOffset, todayIso } from '@web/booking/format';
import { t } from '@web/booking/i18n';
import { useClinicLogo } from '@web/booking/branding';
import { FullPageMessage, PageShell, StepHeader } from '@web/booking/layout';
import { rememberClinic } from '@web/booking/route';
import { DetailsStep, type BookingDetails } from '@web/booking/steps/details-step';
import { DoctorStep } from '@web/booking/steps/doctor-step';
import { OtpStep } from '@web/booking/steps/otp-step';
import { PendingView, SuccessView } from '@web/booking/steps/success-view';
import { WhenStep, type SlotOption } from '@web/booking/steps/when-step';
import { Alert, Button, Card, Skeleton } from '@web/booking/ui';
import { useAsync } from '@web/booking/use-async';
import { bookingName } from '@web/booking/format';

const byDate = (days: readonly { date: string; slots: unknown[] }[]) =>
  new Map(days.map((day) => [day.date, day.slots]));

/** Days offered at once. Seven is a thumb-flick and covers "next Tuesday". */
const VISIBLE_DAYS = 7;

const OTP_ATTEMPTS = 3;

type Stage = 'doctor' | 'when' | 'details' | 'otp' | 'done';

const STAGE_STEP: Record<Stage, number> = { doctor: 1, when: 2, details: 3, otp: 4, done: 4 };

const STAGE_TITLE: Record<Stage, string> = {
  doctor: 'doctor.heading',
  when: 'when.heading',
  details: 'details.heading',
  otp: 'otp.heading',
  done: 'success.heading',
};

// One page, four stages, no router — the patient arrives from a link, books and leaves. A slot
// taken meanwhile returns to the grid with fresh times, the only screen where that is actionable.
export function BookingWizard({ slug }: { readonly slug: string }): JSX.Element {
  const clinic = useAsync(() => bookingApi.clinic(slug), [slug]);
  // Painted from the browser's copy on a repeat visit, before the response lands.
  const logoUrl = useClinicLogo(slug, clinic.data?.logoUrl);
  const doctors = useAsync(() => bookingApi.doctors(slug), [slug], clinic.data?.bookingEnabled);

  const [stage, setStage] = useState<Stage>('doctor');
  const [doctor, setDoctor] = useState<PublicDoctor>();
  const [from, setFrom] = useState(todayIso());
  const [date, setDate] = useState(todayIso());
  const [slot, setSlot] = useState<SlotOption>();
  const [details, setDetails] = useState<BookingDetails>({ fullName: '', phone: '', reason: '' });

  const [token, setToken] = useState<string>();
  const [booking, setBooking] = useState<ManagedBooking>();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [otpError, setOtpError] = useState<string>();
  const [attemptsLeft, setAttemptsLeft] = useState(OTP_ATTEMPTS);

  const maxDaysAhead = clinic.data?.maxDaysAhead ?? VISIBLE_DAYS;
  const chips = useMemo(() => dayChips(from, VISIBLE_DAYS, maxDaysAhead), [from, maxDaysAhead]);

  // Fetching the whole strip is what lets a closed day render as a greyed chip, and gives the
  // conflict path a `week.reload()` to offer.
  const week = useAsync(
    async () => {
      const days = await Promise.all(
        chips.map((chip) => bookingApi.slots(slug, doctor?.id ?? '', chip.date)),
      );

      const sample = days.flatMap((day) => day.slots)[0];
      if (sample) {
        learnClinicOffset(sample.startsAt, sample.start);
      }

      return days;
    },
    [slug, doctor?.id, from, chips.length],
    Boolean(doctor),
  );

  // The strip opens on today, and today is over by the evening — exactly when somebody opens the
  // link. Move to the first day that has times.
  useEffect(() => {
    if (!week.data || (byDate(week.data).get(date)?.length ?? 0) > 0) {
      return;
    }

    const firstOpen = week.data.find((day) => day.slots.length > 0);

    if (firstOpen) {
      setDate(firstOpen.date);
    }
  }, [week.data, date]);

  const backToSlots = (): void => {
    setSlot(undefined);
    setStage('when');
    week.reload();
  };

  const submit = async (): Promise<void> => {
    if (!slot || !doctor) {
      return;
    }

    setBusy(true);
    setFailure(undefined);

    try {
      const receipt = await bookingApi.book(slug, {
        fullName: details.fullName.trim(),
        phone: details.phone.trim(),
        doctorId: doctor.id,
        startsAt: slot.startsAt,
        ...(details.reason.trim() && { reason: details.reason.trim() }),
      });

      setToken(receipt.token);
      setAttemptsLeft(OTP_ATTEMPTS);
      // So the manage link, which carries no clinic, can still reschedule when
      // it is opened on this phone — see `route.ts`.
      rememberClinic(receipt.token, slug);

      if (receipt.status === 'pending_otp') {
        setStage('otp');
      } else {
        // Manual clinics: reception rings back. There is no confirmed
        // appointment to show, so the screen says what will happen instead.
        setStage('done');
      }
    } catch (error) {
      setFailure(t(failureKey(error)));

      if (error instanceof BookingError && error.failure === 'slotTaken') {
        backToSlots();
      }
    } finally {
      setBusy(false);
    }
  };

  const verify = async (code: string): Promise<void> => {
    if (!token) {
      return;
    }

    setBusy(true);
    setOtpError(undefined);

    try {
      setBooking(await bookingApi.verifyOtp(slug, token, code));
      setStage('done');
    } catch {
      const remaining = attemptsLeft - 1;
      setAttemptsLeft(remaining);
      setOtpError(remaining > 0 ? t('otp.wrong', { attempts: remaining }) : t('otp.spent'));
    } finally {
      setBusy(false);
    }
  };

  // There is no resend route: one live code per booking. So the hold is released and the slot re-
  // taken, which issues a fresh code through the ordinary path.
  const resend = async (): Promise<void> => {
    if (!token) {
      return;
    }

    setBusy(true);
    setOtpError(undefined);

    try {
      await bookingApi.cancel(token);
      await submit();
    } catch (error) {
      setFailure(t(failureKey(error)));
      backToSlots();
    } finally {
      setBusy(false);
    }
  };

  if (clinic.loading) {
    return (
      <PageShell clinicName={undefined} logoUrl={logoUrl}>
        <Skeleton className="h-8 w-2/3" />
        <div className="mt-4 flex flex-col gap-3">
          <Skeleton className="h-[76px] rounded-card" />
          <Skeleton className="h-[76px] rounded-card" />
        </div>
      </PageShell>
    );
  }

  if (clinic.error || !clinic.data) {
    return (
      <PageShell clinicName={undefined} logoUrl={logoUrl}>
        <FullPageMessage
          title={t(failureKey(clinic.error))}
          action={
            <Button variant="secondary" onClick={clinic.reload}>
              {t('common.retry')}
            </Button>
          }
        />
      </PageShell>
    );
  }

  if (!clinic.data.bookingEnabled) {
    return (
      <PageShell clinicName={bookingName(clinic.data.name)} logoUrl={logoUrl}>
        <FullPageMessage
          title={t('errors.closed')}
          {...(clinic.data.phone && { body: clinic.data.phone })}
        />
      </PageShell>
    );
  }

  const manualMode = clinic.data.confirmationMode === BOOKING_CONFIRMATION_MODE.MANUAL;

  if (stage === 'done') {
    return (
      <PageShell clinicName={bookingName(clinic.data.name)} logoUrl={logoUrl}>
        {booking ? <SuccessView booking={booking} /> : <PendingView />}
      </PageShell>
    );
  }

  return (
    <PageShell
      clinicName={bookingName(clinic.data.name)}
      logoUrl={logoUrl}
      footer={
        stage === 'doctor' ? (
          <Button full disabled={!doctor} onClick={() => setStage('when')}>
            {t('common.next')}
          </Button>
        ) : stage === 'when' ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStage('doctor')}>
              {t('common.back')}
            </Button>
            <Button full disabled={!slot} onClick={() => setStage('details')}>
              {t('common.next')}
            </Button>
          </div>
        ) : stage === 'details' ? (
          <Button variant="secondary" full onClick={backToSlots}>
            {t('common.back')}
          </Button>
        ) : undefined
      }
    >
      <div key={stage} className="booking-step">
        <StepHeader current={STAGE_STEP[stage]} title={t(STAGE_TITLE[stage])} />

        {failure && stage !== 'otp' && (
          <div className="mb-4">
            <Alert>{failure}</Alert>
          </div>
        )}

        {stage === 'doctor' && (
          <DoctorStep
            doctors={doctors}
            selectedId={doctor?.id}
            onSelect={(next) => {
              setDoctor(next);
              setSlot(undefined);
              setStage('when');
            }}
          />
        )}

        {stage === 'when' && (
          <WhenStep
            chips={chips}
            week={week}
            date={date}
            onDate={(next) => {
              setDate(next);
              setSlot(undefined);

              // The last chip pages the strip forward a week, so a patient
              // looking for "in ten days" is not stuck at seven.
              if (next === chips.at(-1)?.date) {
                setFrom(next);
              }
            }}
            selected={slot?.startsAt}
            onSelect={(next) => {
              setSlot(next);
              setStage('details');
            }}
          />
        )}

        {stage === 'details' && (
          <DetailsStep
            details={details}
            onChange={setDetails}
            onSubmit={() => void submit()}
            busy={busy}
            summary={
              <Card className="bg-primary-50 shadow-none">
                <p className="text-label text-ink-muted">{t('details.summary')}</p>
                <p className="mt-1 text-value font-medium text-ink">{bookingName(doctor?.name)}</p>
                {/* The time hugs its content: as a block it aligned left inside an RTL card,
                    stranding it on the far side of the box. */}
                <p className="text-value text-ink">
                  <span dir="ltr" className="inline-block w-fit whitespace-nowrap tabular-nums">
                    {slot?.start}
                  </span>
                </p>
              </Card>
            }
          />
        )}

        {stage === 'otp' && (
          <OtpStep
            phone={details.phone}
            busy={busy}
            error={otpError}
            attemptsLeft={attemptsLeft}
            onVerify={(code) => void verify(code)}
            onResend={() => void resend()}
          />
        )}

        {manualMode && stage === 'details' && (
          <p className="mt-4 text-label text-ink-muted">{t('success.manualBody')}</p>
        )}
      </div>
    </PageShell>
  );
}
