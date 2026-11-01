import type { LanguageCode, ManagedBooking, PublicDoctor } from "@clinic/shared";
import { DEFAULT_PHONE_COUNTRY, isPhoneCountry, joinPhone } from "@shared/constants/phone";
import { BOOKING_CONFIRMATION_MODE } from "@shared/enums";
import { useEffect, useMemo, useState, type JSX, type ReactNode } from "react";
import { BookingError, bookingApi, failureKey } from "@web/booking/api";
import {
  addDays,
  bookingName,
  dayChips,
  daysFromToday,
  formatLongDate,
  formatTime,
  learnClinicOffset,
  todayIso,
} from "@web/booking/format";
import { t } from "@web/booking/i18n";
import { useClinicLogo } from "@web/booking/branding";
import { BookingBoard, FullPageMessage, PageShell } from "@web/booking/layout";
import { rememberClinic } from "@web/booking/route";
import {
  AccountDetailsStep,
  type AccountDetails,
  type BookingAccount,
} from "@web/booking/steps/account-details-step";
import { AppointmentPanel } from "@web/booking/steps/appointment-panel";
import { DetailsStep, type BookingDetails } from "@web/booking/steps/details-step";
import { DoctorStep } from "@web/booking/steps/doctor-step";
import { OtpStep } from "@web/booking/steps/otp-step";
import { PendingView, SuccessView } from "@web/booking/steps/success-view";
import { UrgentSentView, UrgentStep, type UrgentDetails } from "@web/booking/steps/urgent-step";
import { WhenStep, type SlotOption } from "@web/booking/steps/when-step";
import { Alert, Button, cx, Skeleton } from "@web/booking/ui";
import { useAsync } from "@web/booking/use-async";
import { useBookingLanguage } from "@web/booking/use-booking-language";

const byDate = (days: readonly { date: string; slots: unknown[] }[]) =>
  new Map(days.map((day) => [day.date, day.slots]));

const VISIBLE_DAYS = 7;

const OTP_ATTEMPTS = 3;

type Stage = "details" | "otp" | "done" | "urgent" | "urgentSent";

export function BookingWizard({
  slug,
  inline = false,
  initialDoctorId,
  account,
  language: fixedLanguage,
}: {
  readonly slug: string;
  readonly inline?: boolean;
  readonly language?: LanguageCode | undefined;
  readonly initialDoctorId?: string | undefined;
  readonly account?: BookingAccount | undefined;
}): JSX.Element {
  const clinic = useAsync(() => bookingApi.clinic(slug), [slug]);
  const logoUrl = useClinicLogo(slug, clinic.data?.logoUrl);
  const language = useBookingLanguage(clinic.data?.locale, {
    ...(fixedLanguage && { fixed: fixedLanguage }),
    standalone: !inline,
  });
  const doctors = useAsync(() => bookingApi.doctors(slug), [slug], clinic.data?.bookingEnabled);

  const [stage, setStage] = useState<Stage>("details");
  const [doctor, setDoctor] = useState<PublicDoctor>();

  useEffect(() => {
    const preselected = doctors.data?.find((candidate) => candidate.id === initialDoctorId);

    if (!preselected) {
      return;
    }

    setDoctor(preselected);
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
  const [accountDetails, setAccountDetails] = useState<AccountDetails>({
    patientId: account?.patients[0]?.id ?? null,
    firstName: "",
    lastName: "",
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

  const chips = useMemo(
    () => dayChips(from, VISIBLE_DAYS, maxDaysAhead),
    [from, maxDaysAhead, language.language],
  );

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
    setStage("details");
    week.reload();
  };

  const editDetails = async (): Promise<void> => {
    if (token) {
      try {
        await bookingApi.cancel(token);
      } catch {}
    }

    setToken(undefined);
    setOtpError(undefined);
    setStage("details");
    week.reload();
  };

  const startOver = (): void => {
    setToken(undefined);
    setBooking(undefined);
    setSlot(undefined);
    setFailure(undefined);
    setStage("details");
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

  const submitForAccount = async (): Promise<void> => {
    if (!slot || !doctor || !account) {
      return;
    }

    setBusy(true);
    setFailure(undefined);

    const reason = accountDetails.reason.trim();

    try {
      const receipt = await bookingApi.bookForAccount(slug, {
        doctorId: doctor.id,
        startsAt: slot.startsAt,
        ...(reason && { reason }),
        ...(accountDetails.patientId === null
          ? {
              newPatient: {
                firstName: accountDetails.firstName.trim(),
                lastName: accountDetails.lastName.trim(),
              },
            }
          : { patientId: accountDetails.patientId }),
      });

      setToken(receipt.token);
      rememberClinic(receipt.token, slug);

      if (receipt.booking) {
        setBooking(receipt.booking);
      }

      setStage("done");
      account.onBooked();
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

  const skip = async (): Promise<void> => {
    if (!token) {
      return;
    }

    setBusy(true);
    setOtpError(undefined);

    try {
      await bookingApi.skipOtp(slug, token);
      setStage("done");
    } catch (error) {
      setOtpError(t(failureKey(error)));
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
      <PageShell clinicName={undefined} logoUrl={logoUrl} inline={inline} language={language}>
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
      <PageShell clinicName={undefined} logoUrl={logoUrl} inline={inline} language={language}>
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
      <PageShell
        clinicName={bookingName(clinic.data.name)}
        logoUrl={logoUrl}
        inline={inline}
        language={language}
      >
        <FullPageMessage
          title={t("errors.closed")}
          {...(clinic.data.phone && { body: clinic.data.phone })}
        />
      </PageShell>
    );
  }

  const manualMode = clinic.data.confirmationMode === BOOKING_CONFIRMATION_MODE.MANUAL;
  const locked = stage === "otp" || stage === "done" || stage === "urgentSent";
  const current = stage === "done" ? 5 : stage === "otp" ? 4 : !doctor ? 1 : !slot ? 2 : 3;

  const choices = (
    <div
      className={cx("flex flex-col gap-5", locked && "opacity-60")}
      {...(locked && { inert: true })}
    >
      <BoardSection number={1} title={t("board.chooseDoctor")} testId="booking-section-doctor">
        <DoctorStep
          doctors={doctors}
          selectedId={doctor?.id}
          onSelect={(next) => {
            setDoctor(next);
            setSlot(undefined);
            setFailure(undefined);
          }}
        />
      </BoardSection>

      <BoardSection number={2} title={t("board.chooseWhen")} testId="booking-section-when">
        {doctor ? (
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
            onSelect={(next) => {
              setSlot(next);
              setFailure(undefined);
            }}
            onUrgent={() => {
              setFailure(undefined);
              setStage("urgent");
            }}
          />
        ) : (
          <p data-testid="booking-when-waiting" className="text-value text-ink-muted">
            {t("board.doctorFirst")}
          </p>
        )}
      </BoardSection>
    </div>
  );

  const panel = (
    <AppointmentPanel doctor={doctor} startsAt={slot?.startsAt}>
      {failure && stage !== "otp" && <Alert>{failure}</Alert>}

      {stage === "details" && account && (
        <AccountDetailsStep
          account={account}
          details={accountDetails}
          onChange={setAccountDetails}
          onSubmit={() => void submitForAccount()}
          busy={busy}
          ready={Boolean(slot)}
        />
      )}

      {stage === "details" && !account && (
        <DetailsStep
          details={details}
          onChange={setDetails}
          onSubmit={() => void submit()}
          busy={busy}
          ready={Boolean(slot)}
        />
      )}

      {manualMode && stage === "details" && (
        <p className="text-label text-ink-muted">{t("success.manualBody")}</p>
      )}

      {stage === "otp" && (
        <>
          <button
            type="button"
            data-testid="booking-edit-details"
            onClick={() => void editDetails()}
            className="inline-flex cursor-pointer items-center gap-1 self-start text-label font-medium text-primary-700 hover:text-primary-900"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4 ltr:-scale-x-100"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
            {t("board.editDetails")}
          </button>
          <OtpStep
            channel={clinic.data.messageChannel}
            phone={joinPhone(details.country, details.phone) ?? details.phone}
            busy={busy}
            error={otpError}
            attemptsLeft={attemptsLeft}
            onVerify={(code) => void verify(code)}
            onResend={() => void resend()}
            onSkip={() => void skip()}
          />
        </>
      )}

      {stage === "done" && (
        <>
          {booking ? <SuccessView booking={booking} /> : <PendingView />}
          <Button variant="ghost" full data-testid="booking-start-over" onClick={startOver}>
            {t("board.another")}
          </Button>
        </>
      )}

      {stage === "urgent" && (
        <UrgentStep
          details={urgent}
          onChange={setUrgent}
          onSubmit={() => void sendUrgent()}
          onBack={() => setStage("details")}
          busy={busy}
        />
      )}

      {stage === "urgentSent" && <UrgentSentView />}
    </AppointmentPanel>
  );

  const bar =
    stage === "details" && doctor && slot ? (
      <div
        data-testid="booking-bar"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-float lg:hidden"
      >
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-value font-bold text-primary-900">
              {bookingName(doctor.name)}
            </span>
            <span className="truncate text-label text-ink-muted">
              {formatLongDate(slot.startsAt)} · <bdi dir="ltr">{formatTime(slot.startsAt)}</bdi>
            </span>
          </span>
          <Button
            data-testid="booking-bar-continue"
            onClick={() =>
              document
                .getElementById("booking-panel")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="shrink-0 rounded-pill px-5"
          >
            {t("board.continue")}
          </Button>
        </div>
      </div>
    ) : undefined;

  return (
    <BookingBoard
      clinicName={bookingName(clinic.data.name)}
      logoUrl={logoUrl}
      phone={clinic.data.phone}
      inline={inline}
      current={current}
      choices={choices}
      panel={panel}
      bar={bar}
      language={language}
    />
  );
}

function BoardSection({
  number,
  title,
  testId,
  children,
}: {
  readonly number: number;
  readonly title: string;
  readonly testId: string;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <section
      data-testid={testId}
      aria-labelledby={`${testId}-title`}
      className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-card"
    >
      <h2
        id={`${testId}-title`}
        className="flex items-center gap-2.5 text-heading font-bold text-primary-900"
      >
        <span
          aria-hidden
          className="inline-flex size-7 items-center justify-center rounded-pill bg-primary-100 text-label font-bold text-primary-700"
        >
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
