import type { ManagedBooking } from "@clinic/shared";
import { APPOINTMENT_STATUS } from "@shared/enums";
import { useMemo, useState, type JSX } from "react";

import { bookingApi, failureKey } from "@web/booking/api";
import { clinicDate, dayChips, learnClinicOffset } from "@web/booking/format";
import { t } from "@web/booking/i18n";
import { FullPageMessage, PageShell } from "@web/booking/layout";
import { BookingFacts } from "@web/booking/steps/success-view";
import { WhenStep, type SlotOption } from "@web/booking/steps/when-step";
import { Alert, Button, Card, Skeleton, cx } from "@web/booking/ui";
import { useAsync } from "@web/booking/use-async";
import { bookingName } from "@web/booking/format";

const VISIBLE_DAYS = 7;

const STATUS_KEY: Record<string, string> = {
  [APPOINTMENT_STATUS.REQUESTED]: "manage.statusRequested",
  [APPOINTMENT_STATUS.CONFIRMED]: "manage.statusConfirmed",
  [APPOINTMENT_STATUS.CANCELLED]: "manage.statusCancelled",
  [APPOINTMENT_STATUS.COMPLETED]: "manage.statusCompleted",
};

type Mode = "view" | "confirming-cancel" | "rescheduling";

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
  const [mode, setMode] = useState<Mode>("view");
  const [reason, setReason] = useState("");
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
      setMode("view");
      managed.reload();
    } catch (error) {
      setFailure(t(failureKey(error)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell clinicName={bookingName(booking.clinicName)}>
      <h1 data-testid="manage-heading" className="mb-4 text-title font-medium text-primary-900">
        {t("manage.heading")}
      </h1>

      <div data-testid="manage-page" className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="text-label text-ink-muted">{t("manage.status")}</span>
          <span
            data-testid="manage-status"
            className={
              cancelled
                ? "pill-text inline-flex items-center h-(--control-h-sm) rounded-pill bg-inset px-3 text-nav font-medium text-ink-muted"
                : "pill-text inline-flex items-center h-(--control-h-sm) rounded-pill bg-success-100 px-3 text-nav font-medium text-success-800"
            }
          >
            {t(STATUS_KEY[booking.status] ?? "manage.statusRequested")}
          </span>
        </div>

        <BookingFacts booking={booking} />

        {failure && <Alert>{failure}</Alert>}

        {cancelled ? (
          <Alert tone="info" data-testid="manage-cancelled">
            {t("manage.cancelled")}
          </Alert>
        ) : !booking.canModify ? (
          <Card data-testid="manage-locked" className="bg-inset shadow-none">
            <p className="text-value text-ink-muted">
              {t("manage.locked", { phone: booking.clinicPhone ?? "" })}
            </p>
            {booking.clinicPhone && (
              <a
                href={`tel:${booking.clinicPhone}`}
                data-testid="manage-call-clinic"
                className="mt-2 inline-block text-value font-medium text-primary-700"
              >
                {t("manage.callClinic")}
              </a>
            )}
          </Card>
        ) : mode === "confirming-cancel" ? (
          <Card data-testid="manage-cancel-panel">
            <h2 className="text-field font-medium text-ink">{t("manage.cancelTitle")}</h2>
            <p className="mt-1 text-value text-ink-muted">{t("manage.cancelBody")}</p>

            <label htmlFor="cancel-reason" className="mt-3 block text-value font-medium text-ink">
              {t("manage.cancelReason")}
            </label>
            <input
              id="cancel-reason"
              data-testid="manage-cancel-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={cx(
                "mt-1.5 min-h-(--control-h) w-full rounded-control border-[1.5px] px-3 text-field",
                "border-line-strong bg-surface transition-[border-color,box-shadow] duration-150",
                "hover:border-neutral-400 focus:border-primary-600 focus:shadow-field-focus",
                "outline-none",
              )}
            />

            <div className="mt-4 flex flex-col gap-2">
              <Button
                variant="danger"
                full
                data-testid="manage-cancel-confirm"
                busy={busy}
                onClick={() => void act(() => bookingApi.cancel(token, reason.trim() || undefined))}
              >
                {t("manage.cancelConfirm")}
              </Button>
              <Button
                variant="secondary"
                full
                data-testid="manage-cancel-keep"
                onClick={() => setMode("view")}
              >
                {t("manage.cancelKeep")}
              </Button>
            </div>
          </Card>
        ) : mode === "rescheduling" ? (
          <ReschedulePanel
            booking={booking}
            slug={slug}
            busy={busy}
            onPick={(slot) => void act(() => bookingApi.reschedule(token, slot.startsAt))}
            onClose={() => setMode("view")}
          />
        ) : (
          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              full
              data-testid="manage-reschedule"
              onClick={() => setMode("rescheduling")}
            >
              {t("manage.reschedule")}
            </Button>
            <Button
              variant="ghost"
              full
              data-testid="manage-cancel"
              onClick={() => setMode("confirming-cancel")}
            >
              {t("manage.cancel")}
            </Button>
          </div>
        )}
      </div>
    </PageShell>
  );
}

// Without a clinic slug there is nothing to ask for slots with, so the panel offers the clinic's
// phone number rather than a grid that can never fill.
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

  const doctors = useAsync(() => bookingApi.doctors(slug ?? ""), [slug], Boolean(slug));
  const doctorId = doctors.data?.find(
    (entry) => bookingName(entry.name) === bookingName(booking.doctorName),
  )?.id;

  const chips = useMemo(() => dayChips(date, VISIBLE_DAYS, 365), [date]);

  const week = useAsync(
    async () => {
      const days = await Promise.all(
        chips.map((chip) => bookingApi.slots(slug ?? "", doctorId ?? "", chip.date)),
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
      <Card data-testid="reschedule-locked" className="bg-inset shadow-none">
        <p className="text-value text-ink-muted">
          {t("manage.locked", { phone: booking.clinicPhone ?? "" })}
        </p>
      </Card>
    );
  }

  return (
    <div data-testid="reschedule-panel" className="flex flex-col gap-3">
      <h2 className="text-field font-medium text-ink">{t("manage.rescheduleTitle")}</h2>

      <WhenStep
        chips={chips}
        week={week}
        date={date}
        onDate={setDate}
        selected={undefined}
        onSelect={onPick}
      />

      <Button
        variant="secondary"
        full
        data-testid="reschedule-back"
        disabled={busy}
        onClick={onClose}
      >
        {t("common.back")}
      </Button>
    </div>
  );
}
