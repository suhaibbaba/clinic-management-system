import type { LanguageCode, ManagedBooking, PublicDoctor } from "@clinic/shared";
import { DEFAULT_PHONE_COUNTRY, isPhoneCountry, joinPhone } from "@shared/constants/phone";
import { BOOKING_CONFIRMATION_MODE } from "@shared/enums";
import { useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from "react";
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
import { GLYPH } from "@web/booking/constants";
import { Alert, Button, cx, Glyph, Skeleton } from "@web/booking/ui";
import { useAsync } from "@web/booking/use-async";
import { useBookingLanguage } from "@web/booking/use-booking-language";

const byDate = (days: readonly { date: string; slots: unknown[] }[]) =>
  new Map(days.map((day) => [day.date, day.slots]));

const VISIBLE_DAYS = 7;

const OTP_ATTEMPTS = 3;

type Stage = "details" | "otp" | "done" | "urgent" | "urgentSent";

type BookingScreen = 1 | 2 | 3;
type ScreenDirection = "forward" | "back";

const PHONE_LAYOUT = "(max-width: 63.98rem)";

const SCREEN_TARGET: Record<BookingScreen, string> = {
  1: "booking-section-doctor",
  2: "booking-section-when",
  3: "booking-panel",
};

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
  const [screen, setScreen] = useState<BookingScreen>(1);
  const [direction, setDirection] = useState<ScreenDirection>("forward");
  const view: BookingScreen = stage === "details" ? screen : 3;
  const shownView = useRef(view);

  const showScreen = (next: BookingScreen): void => {
    setDirection(next < view ? "back" : "forward");
    setScreen(next);
  };

  useEffect(() => {
    if (shownView.current === view) {
      return;
    }

    shownView.current = view;

    if (window.matchMedia(PHONE_LAYOUT).matches) {
      const target = SCREEN_TARGET[view];

      requestAnimationFrame(() =>
        document
          .querySelector(`[data-testid="${target}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }, [view]);

  useEffect(() => {
    const preselected = doctors.data?.find((candidate) => candidate.id === initialDoctorId);

    if (!preselected) {
      return;
    }

    setDoctor(preselected);
    setScreen(2);
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
  const [sentCode, setSentCode] = useState<{ readonly key: string; readonly expiresAt: number }>();
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

  const releaseHold = async (): Promise<void> => {
    if (token) {
      try {
        await bookingApi.cancel(token);
      } catch {}
    }

    setToken(undefined);
    setSentCode(undefined);
    week.reload();
  };

  const editDetails = (): void => {
    setOtpError(undefined);
    setStage("details");
  };

  const startOver = (): void => {
    setToken(undefined);
    setSentCode(undefined);
    setBooking(undefined);
    setSlot(undefined);
    setFailure(undefined);
    setStage("details");
    setDirection("back");
    setScreen(doctor ? 2 : 1);
    week.reload();
  };

  const submit = async (fresh = false): Promise<void> => {
    if (!slot || !doctor) {
      return;
    }

    const reason = details.reason.trim();
    const request = {
      firstName: details.firstName.trim(),
      lastName: details.lastName.trim(),
      phone: joinPhone(details.country, details.phone) ?? "",
      doctorId: doctor.id,
      startsAt: slot.startsAt,
      ...(reason && { reason }),
    };
    const key = JSON.stringify(request);

    if (
      !fresh &&
      token &&
      sentCode?.key === key &&
      sentCode.expiresAt > Date.now() &&
      attemptsLeft > 0
    ) {
      setFailure(undefined);
      setStage("otp");
      return;
    }

    setBusy(true);
    setFailure(undefined);

    try {
      if (token) {
        await releaseHold();
      }

      const receipt = await bookingApi.book(slug, request);

      setToken(receipt.token);
      setSentCode(
        receipt.otpExpiresInSeconds === null
          ? undefined
          : {
              key,
              expiresAt: Math.min(
                Date.now() + receipt.otpExpiresInSeconds * 1000,
                Date.parse(receipt.holdExpiresAt),
              ),
            },
      );
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
      await submit(true);
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
  const canGoBack = stage === "details" || stage === "otp" || stage === "urgent";

  const goToStep = async (step: number): Promise<void> => {
    if (step <= 2 && token) {
      await releaseHold();
    }

    if (stage === "otp") {
      editDetails();
    } else if (stage === "urgent") {
      setStage("details");
    }

    if (step <= 2) {
      setSlot(undefined);
    }

    if (step === 1) {
      setDoctor(undefined);
    }

    showScreen(step <= 1 ? 1 : step === 2 ? 2 : 3);

    if (!window.matchMedia(PHONE_LAYOUT).matches) {
      const section =
        step === 1 ? "booking-section-doctor" : step === 2 ? "booking-section-when" : undefined;

      if (section) {
        document
          .querySelector(`[data-testid="${section}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const choices = (
    <div
      className={cx("flex flex-col gap-5", locked && "opacity-60")}
      {...(locked && { inert: true })}
    >
      <BoardSection
        number={1}
        title={t("board.chooseDoctor")}
        testId="booking-section-doctor"
        phoneHidden={view !== 1}
        direction={direction}
      >
        <DoctorStep
          doctors={doctors}
          selectedId={doctor?.id}
          onSelect={(next) => {
            setDoctor(next);
            setSlot(undefined);
            setFailure(undefined);
            showScreen(2);
          }}
        />
      </BoardSection>

      <BoardSection
        number={2}
        title={t("board.chooseWhen")}
        testId="booking-section-when"
        phoneHidden={view !== 2}
        direction={direction}
        onBack={() => void goToStep(1)}
      >
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
    <AppointmentPanel
      back={
        stage === "details" || stage === "urgent" ? (
          <PhoneBack onBack={() => void goToStep(2)} testId="booking-panel-back" />
        ) : undefined
      }
      doctor={doctor}
      startsAt={slot?.startsAt}
    >
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
            onClick={editDetails}
            className="inline-flex cursor-pointer items-center gap-1 self-start text-label font-medium text-primary-700 hover:text-primary-900"
          >
            <Glyph path={GLYPH.chevron} weight={2} className="size-4 ltr:-scale-x-100" />
            {t("board.editDetails")}
          </button>
          <OtpStep
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
    stage === "details" && view === 2 && doctor ? (
      <div
        data-testid="booking-bar"
        className="fixed inset-x-0 bottom-0 z-20 rounded-t-card border-t border-line bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-float backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-value font-bold text-primary-900">
              {bookingName(doctor.name)}
            </span>
            <span
              data-testid="booking-bar-when"
              className={cx("truncate text-label", slot ? "text-primary-700" : "text-ink-muted")}
            >
              {slot ? (
                <>
                  {formatLongDate(slot.startsAt)} · <bdi dir="ltr">{formatTime(slot.startsAt)}</bdi>
                </>
              ) : (
                t("board.pickTime")
              )}
            </span>
          </span>
          <Button
            data-testid="booking-bar-continue"
            disabled={!slot}
            onClick={() => showScreen(3)}
            className="shrink-0 rounded-pill px-6"
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
      screen={view}
      direction={direction}
      onStep={canGoBack ? (step) => void goToStep(step) : undefined}
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
  phoneHidden,
  direction,
  onBack,
  children,
}: {
  readonly number: number;
  readonly title: string;
  readonly testId: string;
  readonly phoneHidden: boolean;
  readonly direction: ScreenDirection;
  readonly onBack?: (() => void) | undefined;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <section
      data-testid={testId}
      aria-labelledby={`${testId}-title`}
      data-direction={direction}
      className={cx(
        "booking-screen flex scroll-mt-4 flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-card",
        phoneHidden && "max-lg:hidden",
      )}
    >
      {onBack && <PhoneBack onBack={onBack} testId={`${testId}-back`} />}
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

function PhoneBack({
  onBack,
  testId,
}: {
  readonly onBack: () => void;
  readonly testId: string;
}): JSX.Element {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onBack}
      className="inline-flex cursor-pointer items-center gap-1 self-start text-label font-medium text-primary-700 hover:text-primary-900 lg:hidden"
    >
      <Glyph path={GLYPH.chevron} className="size-4 ltr:-scale-x-100" />
      {t("common.back")}
    </button>
  );
}
