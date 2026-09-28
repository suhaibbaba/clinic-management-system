import { APPOINTMENT_STATUS, LOOKUP_LIST, type CalendarAppointment } from "@clinic/shared";
import { formatTime, formatDate } from "@web/shared/lib/format";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Badge,
  EmptyState,
  Ltr,
  PageHeader,
  PersonName,
  PhoneLink,
  Table,
  usePageParams,
  type Column,
} from "@clinic/ui";
import { todayIso } from "@web/shared/lib/dates";
import { setClinicTimeZone } from "@web/shared/lib/clinic-zone";
import { useAppointments } from "@web/modules/appointments/queries";
import { APPOINTMENT_STATUS_STYLES, statusLabelKey } from "@web/shared/lib/appointment-status";
import { useClinic } from "@web/shared/queries/clinic";
import { useLookupLabels } from "@web/shared/queries/lookups";

export function ConfirmedBookings(): JSX.Element {
  const { t } = useTranslation();
  const { page, perPage, setPage, setPerPage } = usePageParams();
  const typeLabel = useLookupLabels(LOOKUP_LIST.APPOINTMENT_TYPE);

  const clinic = useClinic();
  setClinicTimeZone(clinic.data);

  const query = useAppointments({
    page,
    limit: perPage,
    status: APPOINTMENT_STATUS.CONFIRMED,
    from: todayIso(),
  });

  const columns: readonly Column<CalendarAppointment>[] = [
    {
      key: "patient",
      header: "booking.pending.columns.patient",
      primary: true,
      render: (row) => (
        <Link
          to={`/patients/${row.patientId}`}
          data-testid="confirmed-booking-patient"
          className="font-medium text-primary-600 transition-colors duration-150 hover:text-primary-700"
        >
          {row.patientName}
        </Link>
      ),
    },
    {
      key: "phone",
      header: "booking.pending.columns.phone",
      hideOnMobile: true,
      render: (row) => <PhoneLink value={row.patientPhone} />,
    },
    {
      key: "doctor",
      header: "booking.pending.columns.doctor",
      render: (row) => <PersonName name={row.doctorName} />,
    },
    {
      key: "slot",
      header: "booking.pending.columns.slot",
      render: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          <Ltr>{formatDate(row.startsAt)}</Ltr>
          <Ltr className="font-medium tabular-nums">{formatTime(row.startsAt)}</Ltr>
        </span>
      ),
    },
    {
      key: "type",
      header: "appointments.type",
      hideOnMobile: true,
      render: (row) => (
        <span className="flex items-center gap-2">
          {typeLabel(row.type)}
          <Badge
            tone={APPOINTMENT_STATUS_STYLES[row.status].tone}
            data-testid="confirmed-booking-status"
          >
            {t(statusLabelKey(row.status))}
          </Badge>
        </span>
      ),
    },
  ];

  return (
    <div data-testid="confirmed-bookings" className="flex flex-col gap-5">
      <PageHeader
        data-testid="confirmed-bookings-header"
        title="appointments.confirmed.title"
        subtitle="appointments.confirmed.subtitle"
      />

      <Table
        data-testid="confirmed-bookings-table"
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={query.isPending}
        empty={
          <EmptyState
            icon="calendar"
            data-testid="confirmed-bookings-empty"
            title="appointments.confirmed.empty"
            hint="appointments.confirmed.emptyHint"
          />
        }
        pagination={{
          page,
          totalPages: query.data?.totalPages ?? 0,
          onPageChange: setPage,
          perPage,
          onPerPageChange: setPerPage,
        }}
      />
    </div>
  );
}
