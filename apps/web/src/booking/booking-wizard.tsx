import type { ManagedBooking, PublicDoctor } from "@clinic/shared";
import { DEFAULT_PHONE_COUNTRY, isPhoneCountry, joinPhone } from "@shared/constants/phone";
import { BOOKING_CONFIRMATION_MODE } from "@shared/enums";
import { useEffect, useMemo, useState, type JSX } from "react";
import { BookingError, bookingApi, failureKey } from "@web/booking/api";
import {
  addDays,
  bookingName,
  dayChips,
  daysFromToday,
  learnClinicOffset,
  todayIso,
} from "@web/booking/format";
import { t } from "@web/booking/i18n";
import { useClinicLogo } from "@web/booking/branding";
import { STEP_KEYS } from "@web/booking/constants";
import { FullPageMessage, PageShell, StepHeader, StepNav } from "@web/booking/layout";
import { rememberClinic } from "@web/booking/route";
import { DetailsStep, type BookingDetails } from "@web/booking/steps/details-step";
import { DoctorStep } from "@web/booking/steps/doctor-step";
import { OtpStep } from "@web/booking/steps/otp-step";
import { PendingView, SuccessView } from "@web/booking/steps/success-view";
import { UrgentSentView, UrgentStep, type UrgentDetails } from "@web/booking/steps/urgent-step";
import { WhenStep, type SlotOption } from "@web/booking/steps/when-step";
import { Alert, Button, Card, Skeleton } from "@web/booking/ui";
import { useAsync } from "@web/booking/use-async";

const byDate = (days: readonly { date: string; slots: unknown[] }[]) =>
  new Map(days.map((day) => [day.date, day.slots]));

const VISIBLE_DAYS = 7;

const OTP_ATTEMPTS = 3;

type Stage = "doctor" | "when" | "details" | "otp" | "done" | "urgent" | "urgentSent";

const STAGE_STEP: Record<Stage, number> = {
  doctor: 1,
  when: 2,
  details: 3,
  otp: 4,
  done: 4,
  urgent: 3,
  urgentSent: 3,
};

const STAGE_TITLE: Record<Stage, string> = {
  doctor: "doctor.heading",
  when: "when.heading",
  details: "details.heading",
  otp: "otp.heading",
  done: "success.heading",
  urgent: "urgent.heading",
  urgentSent: "urgent.sentHeading",
};

export function BookingWizard({
  slug,
  inline = false,
  initialDoctorId,
}: {
  readonly slug: string;
  readonly inline?: boolean;
  readonly initialDoctorId?: string | undefined;
}): JSX.Element {
  const clinic = useAsync(() => bookingApi.clinic(slug), [slug]);
  const logoUrl = useClinicLogo(slug, clinic.data?.logoUrl);
  const doctors = useAsync(() => bookingApi.doctors(slug), [slug], clinic.data?.bookingEnabled);

  const [stage, setStage] = useState<Stage>("doctor");
  const [motion, setMotion] = useState<{ stage: Stage; direction: "forward" | "back" }>({
    stage,
    direction: "forward",
  });

  if (motion.stage !== stage) {
    setMotion({
      stage,
      direction: STAGE_STEP[stage] < STAGE_STEP[motion.stage] ? "back" : "forward",
    });
  }

  const direction = motion.direction;
  const [doctor, setDoctor] = useState<PublicDoctor>();

  useEffect(() => {
    const preselected = doctors.data?.find((candidate) => candidate.id === initialDoctorId);

    if (!preselected) {
      return;
    }

    setDoctor(preselected);
    setStage((current) => (current === "doctor" ? "when" : current));
  }, [doctors.data, initialDoctorId]);
  const [from, setFrom] = useState(todayIso());
  const [date, setDate] = useState(todayIso());
  const [slot, setSlot] = useState<SlotOption>();
  const [details, setDetails] = useState<BookingDetails>({
    country: DEFAULT_PHONE_COUNTRY,
    firstName: "",
    lastName: "",
    phone: "",
    reason: "",
  });
  const [urgent, setUrgent] = useState<UrgentDetails>({
    country: DEFAULT_PHONE_COUNTRY,
    firstName: "",
    lastName: "",
    phone: "",
    complaint: "",
  });

  const [token, setToken] = useState<string>();
  const [booking, setBooking] = useState<ManagedBooking>();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [otpError, setOtpError] = useState<string>();
  const [attemptsLeft, setAttemptsLeft] = useState(OTP_ATTEMPTS);

  const maxDaysAhead = clinic.data?.maxDaysAhead ?? VISIBLE_DAYS;
  const country = isPhoneCountry(clinic.data?.country)
    ? clinic.data.country
    : DEFAULT_PHONE_COUNTRY;

  useEffect(() => {
    setDetails((current) => ({ ...current, country }));
    setUrgent((current) => ({ ...current, country }));
  }, [country]);

  const chips = useMemo(() => dayChips(from, VISIBLE_DAYS, maxDaysAhead), [from, maxDaysAhead]);

  const week = useAsync(
    async () => {
      const days = await Promise.all(
        chips.map((chip) => bookingApi.slots(slug, doctor?.id ?? "", chip.date)),
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
    setStage("when");
    week.reload();
  };

  const submit = async (): Promise<void> => {
    if (!slot || !doctor) {
      return;
    }

    setBusy(true);
    setFailure(undefined);

    const reason = details.reason.trim();

    try {
      const receipt = await bookingApi.book(slug, {
        firstName: details.firstName.trim(),
        lastName: details.lastName.trim(),
        phone: joinPhone(details.country, details.phone) ?? "",
        doctorId: doctor.id,
        startsAt: slot.startsAt,
        ...(reason && { reason }),
      });

      setToken(receipt.token);
      setAttemptsLeft(OTP_ATTEMPTS);
      rememberClinic(receipt.token, slug);

      if (receipt.status === "pending_otp") {
        setStage("otp");
      } else {
        setStage("done");
      }
    } catch (error) {
      setFailure(t(failureKey(error)));

      if (error instanceof BookingError && error.failure === "slotTaken") {
        backToSlots();
      }
    } finally {
      setBusy(false);
    }
  };

  const sendUrgent = async (): Promise<void> => {
    setBusy(true);
    setFailure(undefined);

    try {
      await bookingApi.requestUrgent(slug, {
        firstName: urgent.firstName.trim(),
        lastName: urgent.lastName.trim(),
        phone: joinPhone(urgent.country, urgent.phone) ?? "",
        complaint: urgent.complaint.trim(),
        ...(doctor && { doctorId: doctor.id }),
      });

      setStage("urgentSent");
    } catch (error) {
      setFailure(t(failureKey(error)));
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
      setStage("done");
    } catch {
      const remaining = attemptsLeft - 1;
      setAttemptsLeft(remaining);
      setOtpError(remaining > 0 ? t("otp.wrong", { attempts: remaining }) : t("otp.spent"));
    } finally {
      setBusy(false);
    }
  };

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
      <PageShell clinicName={undefined} logoUrl={logoUrl} inline={inline}>
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
      <PageShell clinicName={undefined} logoUrl={logoUrl} inline={inline}>
        <FullPageMessage
          title={t(failureKey(clinic.error))}
          action={
            <Button variant="secondary" data-testid="booking-retry" onClick={clinic.reload}>
              {t("common.retry")}
            </Button>
          }
        />
      </PageShell>
    );
  }

  if (!clinic.data.bookingEnabled) {
    return (
      <PageShell clinicName={bookingName(clinic.data.name)} logoUrl={logoUrl} inline={inline}>
        <FullPageMessage
          title={t("errors.closed")}
          {...(clinic.data.phone && { body: clinic.data.phone })}
        />
      </PageShell>
    );
  }

  const manualMode = clinic.data.confirmationMode === BOOKING_CONFIRMATION_MODE.MANUAL;

  if (stage === "done") {
    return (
      <PageShell clinicName={bookingName(clinic.data.name)} logoUrl={logoUrl} inline={inline}>
        {booking ? <SuccessView booking={booking} /> : <PendingView />}
      </PageShell>
    );
  }

  if (stage === "urgentSent") {
    return (
      <PageShell clinicName={bookingName(clinic.data.name)} logoUrl={logoUrl} inline={inline}>
        <UrgentSentView />
      </PageShell>
    );
  }

  return (
    <PageShell
      clinicName={bookingName(clinic.data.name)}
      logoUrl={logoUrl}
      inline={inline}
      footer={
        stage === "doctor" ? (
          <StepNav
            next={{
              testId: "booking-next-doctor",
              disabled: !doctor,
              onClick: () => setStage("when"),
            }}
          />
        ) : stage === "when" ? (
          <StepNav
            back={{ testId: "booking-back-doctor", onClick: () => setStage("doctor") }}
            next={{
              testId: "booking-next-when",
              disabled: !slot,
              onClick: () => setStage("details"),
            }}
          />
        ) : stage === "details" ? (
          <StepNav back={{ testId: "booking-back-slots", onClick: backToSlots }} />
        ) : undefined
      }
    >
      <StepHeader
        current={STAGE_STEP[stage]}
        title={t(STAGE_TITLE[stage])}
        steps={STEP_KEYS}
        level={inline ? 2 : 1}
      />

      <div
        key={stage}
        data-testid={`booking-stage-${stage}`}
        data-direction={direction}
        className="booking-stage"
      >
        {failure && stage !== "otp" && (
          <div className="mb-4">
            <Alert>{failure}</Alert>
          </div>
        )}

        {stage === "doctor" && (
          <DoctorStep
            doctors={doctors}
            selectedId={doctor?.id}
            onSelect={(next) => {
              setDoctor(next);
              setSlot(undefined);
              setStage("when");
            }}
          />
        )}

        {stage === "when" && (
          <WhenStep
            chips={chips}
            week={week}
            date={date}
            onDate={(next) => {
              setDate(next);
              setSlot(undefined);
            }}
            canPrevious={from > todayIso()}
            canNext={daysFromToday(addDays(from, VISIBLE_DAYS)) <= maxDaysAhead}
            onWeek={(step) => {
              const start = addDays(from, step * VISIBLE_DAYS);
              const next = start < todayIso() ? todayIso() : start;

              setFrom(next);
              setDate(next);
              setSlot(undefined);
            }}
            selected={slot?.startsAt}
            onSelect={setSlot}
            header={
              doctor && (
                <div
                  data-testid="when-doctor"
                  className="flex items-center gap-3 rounded-card border border-line bg-surface p-3"
                >
                  <span
                    aria-hidden
                    className="pill-text inline-flex size-(--control-h) shrink-0 items-center justify-center rounded-pill bg-primary-100 text-value font-bold text-primary-800"
                  >
                    {bookingName(doctor.name).slice(0, 1)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-label text-ink-muted">{t("when.with")}</span>
                    <span className="truncate text-value font-bold text-ink">
                      {bookingName(doctor.name)}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    data-testid="when-change-doctor"
                    onClick={() => setStage("doctor")}
                    className="px-3 text-label"
                  >
                    {t("when.changeDoctor")}
                  </Button>
                </div>
              )
            }
            onUrgent={() => {
              setFailure(undefined);
              setStage("urgent");
            }}
          />
        )}

        {stage === "urgent" && (
          <UrgentStep
            details={urgent}
            onChange={setUrgent}
            onSubmit={() => void sendUrgent()}
            onBack={() => setStage("when")}
            busy={busy}
          />
        )}

        {stage === "details" && (
          <DetailsStep
            details={details}
            onChange={setDetails}
            onSubmit={() => void submit()}
            busy={busy}
            summary={
              <Card data-testid="booking-summary" className="bg-primary-50 shadow-none">
                <p className="text-label text-ink-muted">{t("details.summary")}</p>
                <p className="mt-1 text-value font-medium text-ink">{bookingName(doctor?.name)}</p>
                <p className="text-value text-ink">
                  <span dir="ltr" className="inline-block w-fit whitespace-nowrap tabular-nums">
                    {slot?.start}
                  </span>
                </p>
              </Card>
            }
          />
        )}

        {stage === "otp" && (
          <OtpStep
            phone={joinPhone(details.country, details.phone) ?? details.phone}
            busy={busy}
            error={otpError}
            attemptsLeft={attemptsLeft}
            onVerify={(code) => void verify(code)}
            onResend={() => void resend()}
          />
        )}

        {manualMode && stage === "details" && (
          <p className="mt-4 text-label text-ink-muted">{t("success.manualBody")}</p>
        )}
      </div>
    </PageShell>
  );
}
