import { APPOINTMENT_STATUS, LOOKUP_LIST, type CalendarAppointment } from '@clinic/shared';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import {
  Badge,
  type Column,
  EmptyState,
  Ltr,
  PageHeader,
  PersonName,
  PhoneLink,
  Table,
} from '@web/components/ui';
import { minutesOf, toTimeLabel, todayIso } from '@web/features/appointments/calendar-time';
import { setClinicTimeZone } from '@web/lib/clinic-zone';
import { useAppointments } from '@web/features/appointments/queries';
import { APPOINTMENT_STATUS_STYLES, statusLabelKey } from '@web/features/appointments/status';
import { useClinic } from '@web/features/clinic/queries';
import { useLookupLabels } from '@web/features/lookups/queries';
import { formatDate } from '@web/lib/format';

const PAGE_SIZE = 20;

/**
 * Everything that is settled and still to come.
 *
 * The counterpart of the pending queue, and the reason the two sit as tabs of
 * one page: they are the same appointments a decision apart, and reception
 * moves between them constantly. From today onwards, because a confirmed
 * appointment last March is history and belongs in the patient's file, not in
 * a list of what is coming.
 */
export function ConfirmedBookings(): JSX.Element {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const typeLabel = useLookupLabels(LOOKUP_LIST.APPOINTMENT_TYPE);

  // The clinic's wall clock, as everywhere else a time is drawn.
  const clinic = useClinic();
  setClinicTimeZone(clinic.data);

  const query = useAppointments({
    page,
    limit: PAGE_SIZE,
    status: APPOINTMENT_STATUS.CONFIRMED,
    from: todayIso(),
  });

  const columns: readonly Column<CalendarAppointment>[] = [
    {
      key: 'patient',
      header: 'booking.pending.columns.patient',
      primary: true,
      render: (row) => (
        <Link
          to={`/patients/${row.patientId}`}
          className="font-medium text-primary-600 transition-colors duration-150 hover:text-primary-700"
        >
          {row.patientName}
        </Link>
      ),
    },
    {
      key: 'phone',
      header: 'booking.pending.columns.phone',
      hideOnMobile: true,
      render: (row) => <PhoneLink value={row.patientPhone} />,
    },
    {
      key: 'doctor',
      header: 'booking.pending.columns.doctor',
      render: (row) => <PersonName name={row.doctorName} />,
    },
    {
      key: 'slot',
      header: 'booking.pending.columns.slot',
      render: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          <Ltr>{formatDate(row.startsAt)}</Ltr>
          <Ltr className="font-medium tabular-nums">{toTimeLabel(minutesOf(row.startsAt))}</Ltr>
        </span>
      ),
    },
    {
      key: 'type',
      header: 'appointments.type',
      hideOnMobile: true,
      render: (row) => (
        <span className="flex items-center gap-2">
          {typeLabel(row.type)}
          <Badge tone={APPOINTMENT_STATUS_STYLES[row.status].tone}>
            {t(statusLabelKey(row.status))}
          </Badge>
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="appointments.confirmed.title" subtitle="appointments.confirmed.subtitle" />

      <Table
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={query.isPending}
        empty={
          <EmptyState
            icon="calendar"
            title="appointments.confirmed.empty"
            hint="appointments.confirmed.emptyHint"
          />
        }
        pagination={{
          page,
          totalPages: query.data?.totalPages ?? 0,
          total: query.data?.total ?? 0,
          onPageChange: setPage,
        }}
      />
    </div>
  );
}
