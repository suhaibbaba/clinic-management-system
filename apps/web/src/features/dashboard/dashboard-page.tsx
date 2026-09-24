import type { CalendarAppointment } from "@clinic/shared";
import { useMemo, useState, type JSX, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import {
  Badge,
  Button,
  EmptyState,
  Icon,
  PageAction,
  SegmentedControl,
  StatCard,
  usePersonName,
  type StatTone,
} from "@clinic/ui";
import { RefreshBar, SkeletonKpi } from "@clinic/ui/components/skeleton";
import { useSession } from "@web/features/auth/session";
import { AppointmentFormModal } from "@web/features/appointments/appointment-form-modal";
import { canBookAppointment, canMoveAppointment } from "@web/features/appointments/permissions";
import { useAppointmentStep } from "@web/features/appointments/queries";
import { useNowMinute } from "@web/features/appointments/use-now-minute";
import { setClinicTimeZone } from "@web/lib/clinic-zone";
import { Money } from "@web/features/billing/money";
import { useClinic } from "@web/features/clinic/queries";
import { useDashboardSummary } from "@web/features/dashboard/queries";
import { MiniCalendar } from "@web/features/dashboard/mini-calendar";
import { ScheduleTimeline } from "@web/features/dashboard/schedule-timeline";
import { WelcomeBanner } from "@web/features/dashboard/welcome-banner";
import { NotesWidget } from "@web/features/notes/notes-widget";
import { canOpenPatientFile } from "@web/features/patients/permissions";
import { formatDate } from "@web/lib/format";
import { cn } from "@clinic/ui/lib/cn";
import { useDocumentTitle } from "@clinic/ui/lib/page-title";
import { useQueryLoading } from "@clinic/ui/lib/use-delayed-loading";

export function DashboardPage(): JSX.Element {
  const { t } = useTranslation();
  const { user, can } = useSession();
  const [booking, setBooking] = useState(false);

  // Every time drawn here is the clinic's wall clock, not the browser's — the
  // same reason the calendar and the booking queue set it.
  const clinic = useClinic();
  setClinicTimeZone(clinic.data);

  // The banner carries this screen's `<h1>`, so the tab title is set here rather than through
  // `PageHeader` — two headings saying "dashboard" is one too many.
  useDocumentTitle(t("dashboard.title"));

  const summary = useDashboardSummary();
  const { showSkeleton, isRefreshing } = useQueryLoading(summary);
  const data = summary.data;
  const currency = clinic.data?.currency;

  const overdue = data?.overdueTotal;
  const pending = data?.pendingBookings;

  return (
    <div data-testid="dashboard-page" className="flex flex-col gap-4">
      <WelcomeBanner date={data?.date} schedule={data?.schedule ?? []} />

      {/* The day's one action. It rides in the bar beside the bell, and on a phone — where the bar
          keeps no slot — it falls in here, under the banner that is this screen's heading. */}
      {canBookAppointment(can) && (
        <PageAction>
          <Button
            icon={<Icon name="plus" />}
            data-testid="dashboard-create-appointment"
            onClick={() => setBooking(true)}
          >
            {t("appointments.create")}
          </Button>
        </PageAction>
      )}

      <AppointmentFormModal
        data-testid="dashboard-appointment-modal"
        open={booking}
        onOpenChange={setBooking}
      />

      {summary.isError && (
        <EmptyState
          icon="alert"
          data-testid="dashboard-error"
          title="errors.unknown"
          hint="dashboard.failed"
        />
      )}

      {/* The reference's two-column body: the day beside a narrow column of things you glance at.
          One column below 1220px, where 292px of side leaves the panel too little. */}
      <div className="grid items-start gap-4 min-[1220px]:grid-cols-[1fr_292px]">
        <div className="flex min-w-0 flex-col gap-4">
          {showSkeleton && <SkeletonKpi count={3} />}

          {/* At `sm` a third column left each card 141px wide with 40px of padding — 101px for a
              figure that is 128px. */}
          {!showSkeleton && (
            <div data-testid="dashboard-kpis" className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <KpiLink to="/appointments" data-testid="dashboard-kpi-today-link">
                <StatCard
                  icon="calendar"
                  data-testid="dashboard-kpi-today"
                  label={t("dashboard.kpi.today")}
                  value={data?.appointmentsToday ?? "—"}
                  caption={data ? formatDate(data.date) : undefined}
                />
              </KpiLink>

              {pending !== undefined && (
                <KpiLink to="/appointments?status=pending" data-testid="dashboard-kpi-pending-link">
                  <StatCard
                    icon="clock"
                    data-testid="dashboard-kpi-pending"
                    tone={toneFor(pending > 0, "warning")}
                    label={t("dashboard.kpi.pending")}
                    value={pending}
                    caption={t("dashboard.kpi.pendingCaption")}
                  />
                </KpiLink>
              )}

              {overdue !== undefined && (
                <KpiLink to="/patients?filter=balance" data-testid="dashboard-kpi-overdue-link">
                  <StatCard
                    icon="money"
                    data-testid="dashboard-kpi-overdue"
                    tone={toneFor(Number(overdue) > 0, "danger")}
                    label={t("dashboard.kpi.overdue")}
                    value={<Money amount={overdue} currency={currency} />}
                    caption={t("dashboard.kpi.overdueCaption", {
                      count: data?.overduePatients ?? 0,
                    })}
                  />
                </KpiLink>
              )}
            </div>
          )}

          <TodaySchedule
            rows={data?.schedule ?? []}
            isLoading={summary.isPending}
            isRefreshing={isRefreshing}
            linkPatients={canOpenPatientFile(user?.role)}
          />
        </div>

        {/* Side by side below 1220px too, until there is no room for two of anything. */}
        <aside
          data-testid="dashboard-side"
          className="flex min-w-0 flex-col gap-4 max-[1219px]:flex-row max-[759px]:flex-col"
        >
          <MiniCalendar />
          <NotesWidget />
        </aside>
      </div>
    </div>
  );
}

const toneFor = (active: boolean, tone: StatTone): StatTone => (active ? tone : "neutral");

function KpiLink({
  to,
  children,
  "data-testid": testId,
}: {
  readonly to: string;
  readonly children: ReactNode;
  readonly "data-testid"?: string | undefined;
}): JSX.Element {
  return (
    <Link
      to={to}
      data-testid={testId}
      className={cn(
        "block rounded-card",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success-500",
      )}
    >
      {children}
    </Link>
  );
}

function TodaySchedule({
  rows,
  isLoading,
  isRefreshing,
  linkPatients,
}: {
  readonly rows: readonly CalendarAppointment[];
  readonly isLoading: boolean;
  readonly isRefreshing: boolean;
  readonly linkPatients: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const { can } = useSession();
  const confirm = useAppointmentStep();
  const [doctorId, setDoctorId] = useDoctorFilter();

  const doctors = useScheduleDoctors(rows);
  const shown = doctorId === null ? rows : rows.filter((row) => row.doctorId === doctorId);
  const nowMinute = useNowMinute();

  const head = (
    <>
      <h2>
        <Badge tone="wash" plain data-testid="dashboard-schedule-title">
          {t("dashboard.schedule.title")}
        </Badge>
      </h2>

      {doctors.length > 1 && (
        <SegmentedControl
          data-testid="dashboard-schedule-doctor"
          label={t("dashboard.schedule.byDoctor")}
          value={doctorId ?? ALL_DOCTORS}
          onChange={(value) => setDoctorId(value === ALL_DOCTORS ? null : value)}
          options={[
            { value: ALL_DOCTORS, label: t("common.all") },
            ...doctors.map((doctor) => ({ value: doctor.id, label: doctor.label })),
          ]}
        />
      )}

      <Link
        to="/appointments"
        data-testid="dashboard-schedule-see-all"
        className="inline-flex min-h-(--control-h) items-center gap-1 text-label font-medium text-primary-600 transition-colors duration-150 hover:text-primary-700 lg:min-h-0"
      >
        {t("dashboard.schedule.seeAll")}
        <Icon name="chevron-end" className="size-4" />
      </Link>
    </>
  );

  if (isLoading) {
    return <SkeletonTimeline />;
  }

  if (shown.length === 0) {
    return (
      <section
        data-testid="dashboard-schedule"
        aria-label={t("dashboard.schedule.title")}
        className="flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">{head}</div>
        <EmptyState
          icon="calendar"
          data-testid="dashboard-schedule-empty"
          title="dashboard.schedule.empty"
          hint="dashboard.schedule.emptyHint"
        />
      </section>
    );
  }

  return (
    <section
      data-testid="dashboard-schedule"
      aria-label={t("dashboard.schedule.title")}
      className="overflow-hidden rounded-card border border-line bg-surface shadow-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-[22px] py-[18px]">
        {head}
      </div>

      <RefreshBar active={isRefreshing} />

      <ScheduleTimeline
        data-testid="dashboard-timeline"
        rows={shown}
        linkPatients={linkPatients}
        nowMinute={nowMinute}
        onConfirm={
          canMoveAppointment(can, "confirm")
            ? (appointment) => confirm.mutate({ id: appointment.id, step: "confirm" })
            : undefined
        }
      />
    </section>
  );
}

const ALL_DOCTORS = "all";

/** Only the doctors who actually have somebody today — a chip per empty column is noise. */
function useScheduleDoctors(
  rows: readonly CalendarAppointment[],
): readonly { readonly id: string; readonly label: string }[] {
  const displayName = usePersonName();

  return useMemo(() => {
    const byId = new Map<string, string>();

    for (const row of rows) {
      byId.set(row.doctorId, displayName(row.doctorName));
    }

    return [...byId.entries()].map(([id, label]) => ({ id, label }));
  }, [rows, displayName]);
}

function useDoctorFilter(): readonly [string | null, (id: string | null) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get("doctor");

  const set = (id: string | null): void => {
    const next = new URLSearchParams(params);

    if (id === null) {
      next.delete("doctor");
    } else {
      next.set("doctor", id);
    }

    setParams(next, { replace: true });
  };

  return [raw, set];
}

function SkeletonTimeline(): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-card border border-line bg-surface shadow-card"
    >
      <div className="border-b border-line px-[22px] py-[18px]">
        <span className="skeleton block h-(--control-h-sm) w-32 rounded-field" />
      </div>

      <div className="flex flex-col gap-4 px-[22px] pt-2 pb-[22px]">
        {[0, 1, 2, 3, 4].map((row) => (
          <span key={row} className="skeleton block h-[62px] rounded-panel" />
        ))}
      </div>
    </div>
  );
}
