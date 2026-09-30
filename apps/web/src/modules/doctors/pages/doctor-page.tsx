import { USER_ROLE, personName, type WeeklySchedule } from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router-dom";
import { Badge, Button, Icon, PageHeader, PersonName, useToast } from "@clinic/ui";
import { WorkingHours } from "@web/shared/components/working-hours";
import { weekFitsWithin } from "@web/shared/lib/week";
import { SkeletonForm } from "@clinic/ui/components/skeleton";
import { useSession } from "@web/shared/providers/session";
import { useClinic } from "@web/shared/queries/clinic";
import { useDoctor, useUpdateDoctorSchedule } from "@web/modules/doctors/queries";
import { TimeOffPanel } from "@web/modules/schedule/components/time-off-panel";
import { SettlementSection } from "@web/modules/doctors/components/settlement-section";
import { errorToast } from "@web/shared/lib/api-error";
import { setClinicTimeZone } from "@web/shared/lib/clinic-zone";
import { useDelayedLoading } from "@clinic/ui/lib/use-delayed-loading";

export function DoctorPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { id } = useParams<{ id: string }>();
  const { user, hasRole } = useSession();

  const doctor = useDoctor(id);
  const showSkeleton = useDelayedLoading(doctor.isPending);
  const clinic = useClinic();
  const updateSchedule = useUpdateDoctorSchedule();

  const [schedule, setSchedule] = useState<WeeklySchedule>([]);

  useEffect(() => {
    if (doctor.data) {
      setSchedule(doctor.data.weeklySchedule);
    }
  }, [doctor.data]);

  useEffect(() => {
    setClinicTimeZone(clinic.data);
  }, [clinic.data]);

  if (id === undefined) {
    return <Navigate to="/users?view=doctors" replace />;
  }

  if (doctor.isPending) {
    return showSkeleton ? <SkeletonForm fields={5} /> : <></>;
  }

  if (!doctor.data) {
    return <Navigate to="/users?view=doctors" replace />;
  }

  const isOwn = doctor.data.userId === user?.id;
  const canEdit = hasRole(USER_ROLE.ADMIN) || isOwn;
  const clinicHours = clinic.data?.workingHours ?? [];
  const fits = weekFitsWithin(schedule, clinicHours);

  const save = async (): Promise<void> => {
    try {
      await updateSchedule.mutateAsync({ id, weeklySchedule: schedule });
      toast.success("doctors.scheduleUpdated");
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <div data-testid="doctor-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="doctor-header"
        title="doctors.pageTitle"
        subtitle="doctors.pageSubtitle"
        actions={
          canEdit ? (
            <Button
              icon={<Icon name="check" />}
              data-testid="doctor-save-schedule"
              disabled={!fits}
              isLoading={updateSchedule.isPending}
              onClick={() => void save()}
            >
              {t("common.save")}
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <PersonName
          name={doctor.data.user.name}
          showBoth
          data-testid="doctor-name"
          className="text-section font-medium text-ink"
        />
        <Badge tone="info" data-testid="doctor-specialty">
          {doctor.data.specialty.name}
        </Badge>
        <span className="text-label text-ink-muted">
          {doctor.data.defaultAppointmentDurationMinutes} {t("doctors.durationUnit")}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          data-testid="doctor-schedule"
          className="border border-line rounded-card bg-surface shadow-card p-4"
        >
          <h2 className="mb-3 text-value font-medium text-ink">{t("doctors.schedule")}</h2>

          <WorkingHours
            value={schedule}
            onChange={setSchedule}
            disabled={!canEdit}
            idPrefix="doctor-hours"
            within={clinicHours}
            withinLabel={t("schedule.clinicHours")}
          />

          {!fits && (
            <p data-testid="doctor-schedule-warning" className="mt-3 text-label text-warning-700">
              {t("schedule.outsideBounds", { bounds: t("schedule.clinicHours") })}
            </p>
          )}
        </section>

        <section
          data-testid="doctor-time-off"
          className="border border-line rounded-card bg-surface shadow-card p-4"
        >
          <TimeOffPanel doctorId={id} canEdit={canEdit} />
        </section>
      </div>

      {doctor.data.isVisiting && hasRole(USER_ROLE.ADMIN) && (
        <div className="border border-line rounded-card bg-surface shadow-card p-4">
          <SettlementSection
            doctorId={id}
            doctorName={personName(doctor.data.user.name, i18n.language)}
          />
        </div>
      )}
    </div>
  );
}
