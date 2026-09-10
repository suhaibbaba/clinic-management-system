import { USER_ROLE, type WeeklySchedule } from '@clinic/shared';
import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams } from 'react-router-dom';

import { Badge, Button, Icon, PageHeader, PersonName, useToast } from '@web/components/ui';
import { WorkingHours } from '@web/components/schedule/working-hours';
import { weekFitsWithin } from '@web/components/schedule/week';
import { SkeletonForm } from '@web/components/ui/skeleton';
import { useSession } from '@web/features/auth/session';
import { useClinic } from '@web/features/clinic/queries';
import { useDoctor, useUpdateDoctorSchedule } from '@web/features/doctors/queries';
import { TimeOffPanel } from '@web/features/schedule/time-off-panel';
import { errorMessageKey } from '@web/lib/api-error';
import { setClinicTimeZone } from '@web/lib/clinic-zone';
import { useDelayedLoading } from '@web/lib/use-delayed-loading';

// A page rather than a modal: time off is a list that grows and belongs beside the hours it
// interrupts. Admin edits any, a doctor their own, everyone else reads.
export function DoctorPage(): JSX.Element {
  const { t } = useTranslation();
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

  // The absences below are wall-clock times in the clinic's zone, not the
  // browser's — see `lib/clinic-zone`.
  useEffect(() => {
    setClinicTimeZone(clinic.data);
  }, [clinic.data]);

  if (id === undefined) {
    return <Navigate to="/doctors" replace />;
  }

  if (doctor.isPending) {
    return showSkeleton ? <SkeletonForm fields={5} /> : <></>;
  }

  if (!doctor.data) {
    return <Navigate to="/doctors" replace />;
  }

  const isOwn = doctor.data.userId === user?.id;
  const canEdit = hasRole(USER_ROLE.ADMIN) || isOwn;
  const clinicHours = clinic.data?.workingHours ?? [];
  const fits = weekFitsWithin(schedule, clinicHours);

  const save = async (): Promise<void> => {
    try {
      await updateSchedule.mutateAsync({ id, weeklySchedule: schedule });
      toast.success('doctors.scheduleUpdated');
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <>
      <PageHeader
        title="doctors.pageTitle"
        subtitle="doctors.pageSubtitle"
        actions={
          canEdit ? (
            <Button
              icon={<Icon name="check" />}
              // Friendly rather than silent: the button explains itself instead
              // of a save that fails with a message about a weekday number.
              disabled={!fits}
              isLoading={updateSchedule.isPending}
              onClick={() => void save()}
            >
              {t('common.save')}
            </Button>
          ) : undefined
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <PersonName
          name={doctor.data.user.name}
          showBoth
          className="text-section font-semibold text-ink"
        />
        <Badge tone="info">{doctor.data.specialty.name}</Badge>
        <span className="text-label text-ink-muted">
          {doctor.data.defaultAppointmentDurationMinutes} {t('doctors.durationUnit')}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-card bg-surface shadow-card p-4">
          <p className="mb-3 text-value font-medium text-ink">{t('doctors.schedule')}</p>

          <WorkingHours
            value={schedule}
            onChange={setSchedule}
            disabled={!canEdit}
            idPrefix="doctor-hours"
            within={clinicHours}
            withinLabel={t('schedule.clinicHours')}
          />

          {!fits && (
            <p className="mt-3 text-label text-warning-700">
              {t('schedule.outsideBounds', { bounds: t('schedule.clinicHours') })}
            </p>
          )}
        </section>

        <section className="rounded-card bg-surface shadow-card p-4">
          <TimeOffPanel doctorId={id} canEdit={canEdit} />
        </section>
      </div>
    </>
  );
}
