import type { CalendarAppointment } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Badge, EmptyState, Icon, SegmentedControl } from "@clinic/ui";
import { RefreshBar } from "@clinic/ui/components/skeleton";
import { useSession } from "@web/shared/providers/session";
import { canMoveAppointment } from "@web/shared/permissions/appointments";
import { useAppointmentStep } from "@web/shared/queries/appointments";
import { useNowMinute } from "@web/shared/hooks/use-now-minute";
import { ScheduleTimeline } from "@web/modules/dashboard/components/schedule-timeline";
import { useScheduleDoctors } from "@web/modules/dashboard/hooks/use-schedule-doctors";
import { useDoctorFilter } from "@web/modules/dashboard/hooks/use-doctor-filter";
import { DASHBOARD_ALL_DOCTORS } from "@web/modules/dashboard/constants";

export interface TodayScheduleProps {
  readonly rows: readonly CalendarAppointment[];
  readonly isLoading: boolean;
  readonly isRefreshing: boolean;
  readonly linkPatients: boolean;
}

export function TodaySchedule({
  rows,
  isLoading,
  isRefreshing,
  linkPatients,
}: TodayScheduleProps): JSX.Element {
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
          value={doctorId ?? DASHBOARD_ALL_DOCTORS}
          onChange={(value) => setDoctorId(value === DASHBOARD_ALL_DOCTORS ? null : value)}
          options={[
            { value: DASHBOARD_ALL_DOCTORS, label: t("common.all") },
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
