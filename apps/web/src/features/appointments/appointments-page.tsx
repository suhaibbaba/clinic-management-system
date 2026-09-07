import { APPOINTMENT_STATUS, type CalendarAppointment } from '@clinic/shared';
import { useMemo, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  EmptyState,
  Icon,
  PageHeader,
  SegmentedControl,
  Select,
  StatCard,
  StatRow,
  useToast,
} from '@web/components/ui';
import { useSession } from '@web/features/auth/session';
import { seesPendingBookings, usePendingBookings } from '@web/features/booking/queries';
import { useClinic } from '@web/features/clinic/queries';
import { useDoctors } from '@web/features/doctors/queries';
import { AgendaList } from '@web/features/appointments/agenda-list';
import { AppointmentDrawer } from '@web/features/appointments/appointment-drawer';
import { AppointmentFormModal } from '@web/features/appointments/appointment-form-modal';
import {
  addDays,
  instantAt,
  startOfWeek,
  todayIso,
} from '@web/features/appointments/calendar-time';
import { setClinicTimeZone } from '@web/features/appointments/clinic-zone';
import { DayGrid } from '@web/features/appointments/day-grid';
import {
  canBookAppointment,
  canManageWaitingList,
  seesWholeClinic,
} from '@web/features/appointments/permissions';
import {
  useCalendar,
  useUpdateAppointment,
  useWaitingList,
} from '@web/features/appointments/queries';
import { TodayRibbon } from '@web/features/appointments/today-ribbon';
import { WaitingListPanel } from '@web/features/appointments/waiting-list-panel';
import { WeekView } from '@web/features/appointments/week-view';
import { errorMessageKey } from '@web/lib/api-error';
import { formatDate } from '@web/lib/format';
import { useIsMobile } from '@web/lib/use-media-query';

type Range = 'day' | 'week';

/**
 * The internal calendar.
 *
 * Week is the default on a desktop — it is the view that answers "when can I
 * fit them in?", which is what reception is asked all day. On a phone the week
 * is seven 40px columns, so the day's agenda is the only view offered there
 * and the toggle disappears with it.
 *
 * A doctor sees their own column; every other role sees the clinic. Reading
 * the whole calendar is `R` for every role, so this is a default rather than a
 * boundary — the boundary is in the API.
 */
export function AppointmentsPage(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const toast = useToast();
  const isMobile = useIsMobile();

  const doctors = useDoctors({ limit: 100 });
  const update = useUpdateAppointment();

  // Every time on this page is drawn in the clinic's zone, not the browser's —
  // see `clinic-zone.ts` for why that distinction is not academic.
  const clinic = useClinic();
  setClinicTimeZone(clinic.data);

  const [range, setRange] = useState<Range>('week');
  const [date, setDate] = useState(todayIso());
  const [doctorFilter, setDoctorFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarAppointment | undefined>();
  const [formDefaults, setFormDefaults] = useState<
    { date?: string; doctorId?: string; startsAt?: string } | undefined
  >();
  const [waitingOpen, setWaitingOpen] = useState(false);

  const role = user?.role;
  const wholeClinic = role ? seesWholeClinic(role) : true;
  const mayBook = role ? canBookAppointment(role) : false;
  const mayManageQueue = role ? canManageWaitingList(role) : false;

  /** A doctor's own calendar is the one backed by their user account. */
  const ownDoctorId = useMemo(
    () => doctors.data?.items.find((doctor) => doctor.userId === user?.id)?.id,
    [doctors.data, user?.id],
  );

  const effectiveDoctorId = wholeClinic ? doctorFilter : (ownDoctorId ?? '');
  const effectiveRange: Range = isMobile ? 'day' : range;

  const calendar = useCalendar({
    date,
    range: effectiveRange,
    ...(effectiveDoctorId !== '' && { doctorId: effectiveDoctorId }),
  });

  const waiting = useWaitingList({ limit: 1 });

  /*
   * Today's online bookings, for the front desk.
   *
   * The one number on this page that is not in the calendar feed already: a
   * booking sitting in `requested` for today is somebody who thinks they have
   * an appointment and whom nobody has answered. `limit: 1` because only the
   * total is wanted.
   */
  const frontDesk = seesPendingBookings(user?.role);
  const onlineToday = usePendingBookings({ from: todayIso(), to: todayIso(), limit: 1 }, frontDesk);

  const appointments = calendar.data?.appointments ?? [];
  const selected = appointments.find((entry) => entry.id === selectedId);

  /** Columns of the day grid: the filtered doctor, or all of them. */
  const columns = useMemo(() => {
    const all = doctors.data?.items ?? [];

    return effectiveDoctorId === '' ? all : all.filter((doctor) => doctor.id === effectiveDoctorId);
  }, [doctors.data, effectiveDoctorId]);

  const today = appointments.filter(
    (entry) => entry.startsAt.slice(0, 10) === todayIso() || range === 'day',
  );

  const todayStats = useMemo(() => {
    const ofToday = appointments.filter((entry) => {
      const local = new Date(entry.startsAt);
      return (
        `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(
          local.getDate(),
        ).padStart(2, '0')}` === todayIso()
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
      // Only over the appointments whose outcome is known; counting the
      // afternoon's bookings as absences would read 20% at nine in the morning.
      attendance: settled === 0 ? null : Math.round((attended.length / settled) * 100),
    };
  }, [appointments]);

  const step = (direction: -1 | 1): void =>
    setDate((current) => addDays(current, effectiveRange === 'week' ? direction * 7 : direction));

  const move = async (appointment: CalendarAppointment, minute: number): Promise<void> => {
    try {
      await update.mutateAsync({
        id: appointment.id,
        body: { startsAt: instantAt(date, minute) },
      });
      toast.success('appointments.moved');
    } catch (error) {
      // A 409 lands here: the slot was taken between the drag and the drop.
      toast.error(errorMessageKey(error));
    }
  };

  const openForm = (defaults?: { date?: string; doctorId?: string; startsAt?: string }): void => {
    setEditing(undefined);
    setFormDefaults(defaults);
    setFormOpen(true);
  };

  const label =
    effectiveRange === 'week'
      ? `${formatDate(startOfWeek(date))} – ${formatDate(addDays(startOfWeek(date), 6))}`
      : formatDate(date);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="appointments.title"
        subtitle="appointments.subtitle"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              icon={<Icon name="users" />}
              onClick={() => setWaitingOpen(true)}
            >
              {t('appointments.waiting.title')}
              {(waiting.data?.total ?? 0) > 0 && (
                <span className="ms-1 tabular-nums">({waiting.data?.total})</span>
              )}
            </Button>

            {mayBook && (
              <Button icon={<Icon name="plus" />} onClick={() => openForm({ date })}>
                {t('appointments.create')}
              </Button>
            )}
          </div>
        }
      />

      {/* Last on a phone, where four cards and a ribbon fill the screen before
          the calendar starts. The summary is worth reading; it is not worth
          reading *first* on the device the day is checked on. */}
      <div className="order-last sm:order-none">
        <StatRow>
          <StatCard
            icon="calendar"
            label={t('appointments.kpi.today')}
            value={todayStats.total}
            caption={formatDate(todayIso())}
          />
          <StatCard
            icon="user-plus"
            tone="success"
            label={t('appointments.kpi.arrived')}
            value={todayStats.attended}
          />
          <StatCard
            icon="clock"
            tone="warning"
            label={t('appointments.kpi.remaining')}
            value={todayStats.remaining}
          />
          <StatCard
            icon="activity"
            tone={
              todayStats.attendance !== null && todayStats.attendance < 70 ? 'danger' : 'primary'
            }
            label={t('appointments.kpi.attendance')}
            value={todayStats.attendance === null ? '—' : `${todayStats.attendance}%`}
            caption={t('appointments.kpi.attendanceCaption')}
          />
          {frontDesk && (
            <StatCard
              icon="globe"
              tone={(onlineToday.data?.total ?? 0) > 0 ? 'warning' : 'primary'}
              label={t('appointments.kpi.onlineToday')}
              value={onlineToday.data?.total ?? 0}
              caption={t('appointments.kpi.onlineTodayCaption')}
            />
          )}
        </StatRow>
      </div>

      <TodayRibbon
        appointments={today}
        onOpen={(appointment) => setSelectedId(appointment.id)}
        canMark={mayBook}
      />

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={<Icon name="chevron-start" />}
            aria-label={t('appointments.previous')}
            onClick={() => step(-1)}
          />
          <Button size="sm" variant="secondary" onClick={() => setDate(todayIso())}>
            {t('appointments.today')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={<Icon name="chevron-end" />}
            aria-label={t('appointments.next')}
            onClick={() => step(1)}
          />
          <span className="ms-1 text-value font-medium text-ink">{label}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:ms-auto">
          {wholeClinic && (
            <Select
              className="w-full sm:w-52"
              aria-label={t('appointments.doctor')}
              placeholder={t('appointments.allDoctors')}
              value={doctorFilter}
              options={(doctors.data?.items ?? []).map((doctor) => ({
                value: doctor.id,
                label: doctor.user.name,
              }))}
              onChange={(event) => setDoctorFilter(event.target.value)}
            />
          )}

          {/* The week is desktop-only, so the toggle is too. */}
          {!isMobile && (
            <SegmentedControl
              label={t('appointments.title')}
              value={range}
              onChange={(next) => setRange(next)}
              options={[
                { value: 'day', label: t('appointments.day') },
                { value: 'week', label: t('appointments.week') },
              ]}
            />
          )}
        </div>
      </div>

      {/* ── The calendar itself ─────────────────────────────────────── */}
      {/* A landmark of its own, so "the calendar" is addressable separately
          from the ribbon above it — which draws some of the same appointments
          and would otherwise be indistinguishable to a screen reader. */}
      <section aria-label={t('appointments.title')} className="flex min-w-0 flex-col gap-5">
        {calendar.isError && (
          <EmptyState icon="alert" title="errors.generic" hint="appointments.loadFailed" />
        )}

        {!calendar.isError && effectiveRange === 'week' && (
          <WeekView
            date={date}
            appointments={appointments}
            onOpen={(appointment) => setSelectedId(appointment.id)}
            onPickDay={(day) => {
              setDate(day);
              setRange('day');
            }}
          />
        )}

        {!calendar.isError && effectiveRange === 'day' && isMobile && (
          <AgendaList
            appointments={appointments}
            onOpen={(appointment) => setSelectedId(appointment.id)}
            showDoctor={wholeClinic}
          />
        )}

        {!calendar.isError && effectiveRange === 'day' && !isMobile && (
          <DayGrid
            doctors={columns}
            appointments={appointments}
            onOpen={(appointment) => setSelectedId(appointment.id)}
            {...(mayBook && { onMove: (appointment, minute) => void move(appointment, minute) })}
            {...(mayBook && {
              onPick: (doctorId, minute) =>
                openForm({ date, doctorId, startsAt: instantAt(date, minute) }),
            })}
          />
        )}
      </section>

      <AppointmentDrawer
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
        open={formOpen}
        onOpenChange={(next) => {
          setFormOpen(next);
          if (!next) {
            setEditing(undefined);
          }
        }}
        appointment={editing}
        defaults={formDefaults}
      />

      <WaitingListPanel
        open={waitingOpen}
        onOpenChange={setWaitingOpen}
        canManage={mayManageQueue}
      />
    </div>
  );
}
