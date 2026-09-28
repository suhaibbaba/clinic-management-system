import {
  APPOINTMENT_STATUS,
  WAITING_LIST_SOURCE,
  type CalendarAppointment,
  type WaitingListEntry,
} from "@clinic/shared";
import { formatDate, formatWeekday } from "@web/shared/lib/format";
import { useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  Badge,
  Button,
  EmptyState,
  Icon,
  Ltr,
  PageHeader,
  SegmentedControl,
  Select,
  StatCard,
  StatRow,
  usePersonName,
} from "@clinic/ui";
import { RefreshBar, SkeletonCalendarDay } from "@clinic/ui/components/skeleton";
import { useSession } from "@web/shared/providers/session";
import { usePendingBookings } from "@web/shared/queries/booking";
import { seesPendingBookings } from "@web/shared/permissions/booking";
import { useClinic } from "@web/shared/queries/clinic";
import { useDoctors } from "@web/shared/queries/doctors";
import { AgendaList } from "@web/modules/appointments/components/agenda-list";
import { AppointmentDrawer } from "@web/modules/appointments/components/appointment-drawer";
import { AppointmentFormModal } from "@web/modules/appointments/components/appointment-form-modal";
import { QUEUE_STEP_MINUTES } from "@web/modules/appointments/lib/calendar-time";
import {
  addDays,
  instantAt,
  nextWorkWeek,
  previousWorkWeek,
  todayIso,
  workWeekDates,
} from "@web/shared/lib/dates";
import { setClinicTimeZone } from "@web/shared/lib/clinic-zone";
import { DayQueue } from "@web/modules/appointments/components/day-queue";
import {
  canBookAppointment,
  canManageWaitingList,
  seesWholeClinic,
} from "@web/shared/permissions/appointments";
import { useDayAvailability, useWaitingList } from "@web/modules/appointments/queries";
import { useCalendar } from "@web/shared/queries/appointments";
import { WaitingListPanel } from "@web/modules/appointments/components/waiting-list-panel";
import { WeekView } from "@web/modules/appointments/components/week-view";
import { useNowMinute } from "@web/shared/hooks/use-now-minute";
import { useQueryLoading } from "@clinic/ui/lib/use-delayed-loading";
import { useIsMobile } from "@clinic/ui/lib/use-media-query";
import { CALENDAR_RANGES } from "@web/modules/appointments/constants";

type Range = (typeof CALENDAR_RANGES)[number];

export function AppointmentsPage(): JSX.Element {
  const { t } = useTranslation();
  const doctorName = usePersonName();
  const { user, can } = useSession();
  const isMobile = useIsMobile();

  const doctors = useDoctors({ limit: 100 });

  const clinic = useClinic();
  setClinicTimeZone(clinic.data);

  const [params, setParams] = useSearchParams();

  const range: Range = CALENDAR_RANGES.find((id) => id === params.get("view")) ?? "week";
  const date = params.get("date") ?? todayIso();
  const doctorFilter = params.get("doctor") ?? "";

  const setCalendarParams = (
    changes: Readonly<Record<string, readonly [string, string]>>,
  ): void => {
    const next = new URLSearchParams(params);

    for (const [name, [value, fallback]] of Object.entries(changes)) {
      if (value === fallback) {
        next.delete(name);
      } else {
        next.set(name, value);
      }
    }

    setParams(next, { replace: true });
  };

  const setRange = (value: Range): void => setCalendarParams({ view: [value, "week"] });
  const setDate = (value: string): void => setCalendarParams({ date: [value, todayIso()] });
  const setDoctorFilter = (value: string): void => setCalendarParams({ doctor: [value, ""] });

  const waitingOpen = params.get("queue") === "open";
  const setWaitingOpen = (next: boolean): void =>
    setCalendarParams({ queue: [next ? "open" : "", ""] });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarAppointment | undefined>();
  const [scheduling, setScheduling] = useState<WaitingListEntry | undefined>();
  const [formDefaults, setFormDefaults] = useState<
    { date?: string; doctorId?: string; startsAt?: string } | undefined
  >();

  const role = user?.role;
  const wholeClinic = role ? seesWholeClinic(role) : true;
  const mayBook = canBookAppointment(can);
  const mayManageQueue = canManageWaitingList(can);

  const ownDoctorId = useMemo(
    () => doctors.data?.items.find((doctor) => doctor.userId === user?.id)?.id,
    [doctors.data, user?.id],
  );

  const effectiveDoctorId = wholeClinic ? doctorFilter : (ownDoctorId ?? "");
  const effectiveRange: Range = isMobile ? "day" : range;

  const weekDays = workWeekDates(date, todayIso());

  const calendar = useCalendar({
    date,
    range: effectiveRange,
    ...(effectiveRange === "week" && { to: weekDays.at(-1) ?? date }),
    ...(effectiveDoctorId !== "" && { doctorId: effectiveDoctorId }),
  });

  const waiting = useWaitingList({ limit: 1 });

  const urgent = useWaitingList({ limit: 1, source: WAITING_LIST_SOURCE.ONLINE });

  const frontDesk = seesPendingBookings(can);
  const onlineToday = usePendingBookings({ from: todayIso(), to: todayIso(), limit: 1 }, frontDesk);

  const { showSkeleton, isRefreshing } = useQueryLoading(calendar);
  const appointments = calendar.data?.appointments ?? [];
  const closures = calendar.data?.closures ?? [];
  const timeOff = calendar.data?.timeOff ?? [];
  const closureToday = closures.find(
    (closure) => closure.startsOn <= date && date <= closure.endsOn,
  );
  const selected = appointments.find((entry) => entry.id === selectedId);

  const columns = useMemo(() => {
    const all = doctors.data?.items ?? [];

    return effectiveDoctorId === "" ? all : all.filter((doctor) => doctor.id === effectiveDoctorId);
  }, [doctors.data, effectiveDoctorId]);

  const todayStats = useMemo(() => {
    const ofToday = appointments.filter((entry) => {
      const local = new Date(entry.startsAt);
      return (
        `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(
          local.getDate(),
        ).padStart(2, "0")}` === todayIso()
      );
    });

    const attended = ofToday.filter(
      (entry) =>
        entry.status === APPOINTMENT_STATUS.ARRIVED ||
        entry.status === APPOINTMENT_STATUS.IN_PROGRESS ||
        entry.status === APPOINTMENT_STATUS.COMPLETED,
    );
    const missed = ofToday.filter((entry) => entry.status === APPOINTMENT_STATUS.NO_SHOW);
    const settled = attended.length + missed.length;

    return {
      total: ofToday.length,
      attended: attended.length,
      remaining: ofToday.length - settled,
      attendance: settled === 0 ? null : Math.round((attended.length / settled) * 100),
    };
  }, [appointments]);

  const step = (direction: -1 | 1): void => {
    if (effectiveRange !== "week") {
      setDate(addDays(date, direction));
      return;
    }

    setDate(direction === 1 ? nextWorkWeek(date, todayIso()) : previousWorkWeek(date));
  };

  const openForm = (defaults?: { date?: string; doctorId?: string; startsAt?: string }): void => {
    setEditing(undefined);
    setScheduling(undefined);
    setFormDefaults(defaults);
    setFormOpen(true);
  };

  const scheduleFromQueue = (entry: WaitingListEntry): void => {
    setEditing(undefined);
    setFormDefaults({ date, ...(entry.doctorId && { doctorId: entry.doctorId }) });
    setScheduling(entry);
    setFormOpen(true);
  };

  const queueShown = effectiveRange === "day" && !isMobile;
  const availability = useDayAvailability(
    date,
    columns.map((doctor) => doctor.id),
    QUEUE_STEP_MINUTES,
    queueShown,
  );
  const nowMinute = useNowMinute();

  const label =
    effectiveRange === "week" ? (
      <>
        <Ltr>{formatDate(weekDays[0] ?? date)}</Ltr>
        <span>–</span>
        <Ltr>{formatDate(weekDays.at(-1) ?? date)}</Ltr>
      </>
    ) : queueShown ? (
      <>
        <span>{formatWeekday(date)}</span>
        <Ltr>{formatDate(date)}</Ltr>
      </>
    ) : (
      <Ltr>{formatDate(date)}</Ltr>
    );

  return (
    <div data-testid="appointments-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="appointments-header"
        title="appointments.title"
        subtitle="appointments.subtitle"
        primaryAction={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              icon={<Icon name="users" />}
              data-testid="appointments-waiting-open"
              onClick={() => setWaitingOpen(true)}
            >
              {t("appointments.waiting.title")}
              {(waiting.data?.total ?? 0) > 0 && (
                <span className="ms-1 tabular-nums">({waiting.data?.total})</span>
              )}
              {(urgent.data?.total ?? 0) > 0 && (
                <Badge tone="danger" className="ms-1.5" data-testid="appointments-urgent-count">
                  {t("appointments.waiting.urgentCount", { count: urgent.data?.total ?? 0 })}
                </Badge>
              )}
            </Button>

            {mayBook && (
              <Button
                icon={<Icon name="plus" />}
                data-testid="appointments-create"
                onClick={() => openForm({ date })}
              >
                {t("appointments.create")}
              </Button>
            )}
          </div>
        }
      />

      <StatRow data-testid="appointments-kpis">
        <StatCard
          icon="calendar"
          data-testid="appointments-kpi-today"
          label={t("appointments.kpi.today")}
          value={todayStats.total}
          caption={formatDate(todayIso())}
        />
        <StatCard
          icon="user-plus"
          tone="success"
          data-testid="appointments-kpi-arrived"
          label={t("appointments.kpi.arrived")}
          value={todayStats.attended}
        />
        <StatCard
          icon="clock"
          tone="warning"
          data-testid="appointments-kpi-remaining"
          label={t("appointments.kpi.remaining")}
          value={todayStats.remaining}
        />
        <StatCard
          icon="activity"
          data-testid="appointments-kpi-attendance"
          tone={todayStats.attendance !== null && todayStats.attendance < 70 ? "danger" : "primary"}
          label={t("appointments.kpi.attendance")}
          value={todayStats.attendance === null ? "—" : `${todayStats.attendance}%`}
          caption={t("appointments.kpi.attendanceCaption")}
        />
        {frontDesk && (
          <StatCard
            icon="globe"
            data-testid="appointments-kpi-online-today"
            tone={(onlineToday.data?.total ?? 0) > 0 ? "warning" : "primary"}
            label={t("appointments.kpi.onlineToday")}
            value={onlineToday.data?.total ?? 0}
            caption={t("appointments.kpi.onlineTodayCaption")}
          />
        )}
      </StatRow>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={<Icon name="chevron-start" />}
            data-testid="appointments-previous"
            aria-label={t("appointments.previous")}
            onClick={() => step(-1)}
          />
          <Button
            size="sm"
            variant="secondary"
            data-testid="appointments-today"
            onClick={() => setDate(todayIso())}
          >
            {t("appointments.today")}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={<Icon name="chevron-end" />}
            data-testid="appointments-next"
            aria-label={t("appointments.next")}
            onClick={() => step(1)}
          />
          <span
            data-testid="appointments-range-label"
            className="ms-1 inline-flex items-center gap-1.5 text-value font-medium text-ink"
          >
            {label}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:ms-auto">
          {wholeClinic && (
            <Select
              className="w-full sm:w-52"
              data-testid="appointments-doctor-filter"
              aria-label={t("appointments.doctor")}
              placeholder={t("appointments.allDoctors")}
              value={doctorFilter}
              options={(doctors.data?.items ?? []).map((doctor) => ({
                value: doctor.id,
                label: doctorName(doctor.user.name),
              }))}
              onChange={(event) => setDoctorFilter(event.target.value)}
            />
          )}

          {!isMobile && (
            <SegmentedControl
              data-testid="appointments-range"
              label={t("appointments.title")}
              value={range}
              onChange={(next) => setRange(next)}
              options={[
                { value: "day", label: t("appointments.day") },
                { value: "week", label: t("appointments.week") },
              ]}
            />
          )}
        </div>
      </div>

      <section
        data-testid="appointments-calendar"
        aria-label={t("appointments.title")}
        className="flex min-w-0 flex-col gap-5"
      >
        {calendar.isError && (
          <EmptyState
            icon="alert"
            data-testid="appointments-error"
            title="errors.generic"
            hint="appointments.loadFailed"
          />
        )}

        {showSkeleton && (
          <SkeletonCalendarDay columns={effectiveRange === "week" ? weekDays.length : 3} />
        )}

        <RefreshBar active={isRefreshing} />

        {!showSkeleton && !calendar.isError && effectiveRange === "week" && (
          <WeekView
            data-testid="appointments-week"
            days={weekDays}
            today={todayIso()}
            doctors={columns.map((doctor) => ({ id: doctor.id, name: doctor.user.name }))}
            appointments={appointments}
            closures={closures}
            onOpen={(appointment) => setSelectedId(appointment.id)}
            onPickDay={(day) =>
              setCalendarParams({ date: [day, todayIso()], view: ["day", "week"] })
            }
          />
        )}

        {!showSkeleton && !calendar.isError && effectiveRange === "day" && isMobile && (
          <AgendaList
            data-testid="appointments-agenda"
            appointments={appointments}
            {...(closureToday && { closure: closureToday })}
            onOpen={(appointment) => setSelectedId(appointment.id)}
            showDoctor={wholeClinic}
          />
        )}

        {!showSkeleton && !calendar.isError && queueShown && (
          <DayQueue
            data-testid="appointments-day-queue"
            date={date}
            doctors={columns}
            appointments={appointments}
            availability={availability}
            timeOff={timeOff}
            {...(closureToday && { closure: closureToday })}
            nowMinute={date === todayIso() ? nowMinute : null}
            onOpen={(appointment) => setSelectedId(appointment.id)}
            {...(mayBook && {
              onPick: (doctorId, minute) =>
                openForm({ date, doctorId, startsAt: instantAt(date, minute) }),
            })}
          />
        )}
      </section>

      <AppointmentDrawer
        data-testid="appointment-drawer"
        appointment={selected}
        onClose={() => setSelectedId(null)}
        onEdit={(appointment) => {
          setSelectedId(null);
          setEditing(appointment);
          setFormDefaults(undefined);
          setFormOpen(true);
        }}
      />

      <AppointmentFormModal
        data-testid="appointment-form-modal"
        open={formOpen}
        onOpenChange={(next) => {
          setFormOpen(next);
          if (!next) {
            setEditing(undefined);
            setScheduling(undefined);
          }
        }}
        appointment={editing}
        defaults={formDefaults}
        waitingEntry={scheduling}
        onBooked={({ date: booked, doctorId: booking }) =>
          setCalendarParams({
            date: [booked, todayIso()],
            ...(wholeClinic && doctorFilter !== "" && { doctor: [booking, ""] }),
          })
        }
      />

      <WaitingListPanel
        open={waitingOpen}
        onOpenChange={setWaitingOpen}
        canManage={mayManageQueue}
        onSchedule={(entry) => {
          setWaitingOpen(false);
          scheduleFromQueue(entry);
        }}
      />
    </div>
  );
}
