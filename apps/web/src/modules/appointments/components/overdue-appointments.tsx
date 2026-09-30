import {
  APPOINTMENT_STATUS,
  LOOKUP_LIST,
  appointmentSettings,
  type CalendarAppointment,
} from "@clinic/shared";
import { formatDate, formatTime } from "@web/shared/lib/format";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  EmptyState,
  Ltr,
  PageHeader,
  PersonName,
  Table,
  usePageParams,
  useToast,
  type Column,
} from "@clinic/ui";
import { setClinicTimeZone } from "@web/shared/lib/clinic-zone";
import { errorToast } from "@web/shared/lib/api-error";
import { toIsoDate } from "@web/shared/lib/dates";
import { useAppointments } from "@web/modules/appointments/queries";
import { AppointmentDrawer } from "@web/modules/appointments/components/appointment-drawer";
import { APPOINTMENT_STATUS_STYLES, statusLabelKey } from "@web/shared/lib/appointment-status";
import { useAppointmentStep, type AppointmentStep } from "@web/shared/queries/appointments";
import { canMoveAppointment } from "@web/shared/permissions/appointments";
import { useClinic } from "@web/shared/queries/clinic";
import { useLookupLabels } from "@web/shared/queries/lookups";
import { useSession } from "@web/shared/providers/session";

export function OverdueAppointments(): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const { can } = useSession();
  const { page, perPage, setPage, setPerPage } = usePageParams();
  const typeLabel = useLookupLabels(LOOKUP_LIST.APPOINTMENT_TYPE);
  const step = useAppointmentStep();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const clinic = useClinic();
  setClinicTimeZone(clinic.data);
  const autoDays = appointmentSettings(clinic.data?.settings).autoNoShowDays;

  const query = useAppointments({ page, limit: perPage, overdue: true });
  const rows = query.data?.items ?? [];
  const selected = rows.find((row) => row.id === selectedId);

  const may = (name: AppointmentStep): boolean => canMoveAppointment(can, name);

  const settle = async (row: CalendarAppointment, steps: readonly AppointmentStep[]) => {
    setBusyId(row.id);

    try {
      for (const name of steps) {
        await step.mutateAsync({ id: row.id, step: name });
      }
      toast.success("appointments.updated");
    } catch (error) {
      toast.error(...errorToast(error));
    } finally {
      setBusyId(null);
    }
  };

  const attendedSteps = (row: CalendarAppointment): AppointmentStep[] | null => {
    if (row.status === APPOINTMENT_STATUS.CONFIRMED && may("arrived") && may("complete")) {
      return ["arrived", "complete"];
    }

    return (row.status === APPOINTMENT_STATUS.ARRIVED ||
      row.status === APPOINTMENT_STATUS.IN_PROGRESS) &&
      may("complete")
      ? ["complete"]
      : null;
  };

  const columns: readonly Column<CalendarAppointment>[] = [
    {
      key: "patient",
      header: "booking.pending.columns.patient",
      primary: true,
      render: (row) => (
        <Link
          to={`/patients/${row.patientId}`}
          data-testid="overdue-appointment-patient"
          onClick={(event) => event.stopPropagation()}
          className="font-medium text-primary-600 transition-colors duration-150 hover:text-primary-700"
        >
          {row.patientName}
        </Link>
      ),
    },
    {
      key: "slot",
      header: "appointments.date",
      render: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          <Ltr>{formatDate(row.startsAt)}</Ltr>
          <Ltr className="font-medium tabular-nums">{formatTime(row.startsAt)}</Ltr>
        </span>
      ),
    },
    {
      key: "doctor",
      header: "booking.pending.columns.doctor",
      hideOnMobile: true,
      render: (row) => <PersonName name={row.doctorName} />,
    },
    {
      key: "type",
      header: "appointments.type",
      hideOnMobile: true,
      render: (row) => typeLabel(row.type),
    },
    {
      key: "status",
      header: "appointments.overdue.status",
      besideTitleOnMobile: true,
      render: (row) => (
        <Badge tone={APPOINTMENT_STATUS_STYLES[row.status].tone} data-testid="overdue-status">
          {t(statusLabelKey(row.status))}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "common.actions",
      actions: true,
      align: "end",
      render: (row) => {
        const attended = attendedSteps(row);
        const noShow =
          (row.status === APPOINTMENT_STATUS.CONFIRMED ||
            row.status === APPOINTMENT_STATUS.ARRIVED) &&
          may("noShow");

        return (
          <span className="flex flex-wrap justify-end gap-2">
            {attended && (
              <Button
                size="sm"
                data-testid={`overdue-attended-${row.id}`}
                isLoading={busyId === row.id}
                aria-disabled={busyId !== null}
                onClick={() => busyId === null && void settle(row, attended)}
              >
                {t("appointments.overdue.attended")}
              </Button>
            )}
            {noShow && (
              <Button
                size="sm"
                variant="secondary"
                data-testid={`overdue-no-show-${row.id}`}
                aria-disabled={busyId !== null}
                onClick={() => busyId === null && void settle(row, ["noShow"])}
              >
                {t("appointments.actions.noShow")}
              </Button>
            )}
          </span>
        );
      },
    },
  ];

  return (
    <div data-testid="overdue-appointments" className="flex flex-col gap-5">
      <PageHeader
        data-testid="overdue-appointments-header"
        title="appointments.overdue.title"
        subtitle="appointments.overdue.subtitle"
      />

      <p data-testid="overdue-appointments-auto" className="text-meta text-ink-muted">
        {t("appointments.overdue.autoNoShow", { count: autoDays })}
      </p>

      <Table
        data-testid="overdue-appointments-table"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        isLoading={query.isPending}
        onRowClick={(row) => setSelectedId(row.id)}
        rowLabel={(row) => `${row.patientName} — ${formatDate(row.startsAt)}`}
        empty={
          <EmptyState
            icon="check"
            data-testid="overdue-appointments-empty"
            title="appointments.overdue.empty"
            hint="appointments.overdue.emptyHint"
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

      <AppointmentDrawer
        data-testid="overdue-appointment-drawer"
        appointment={selected}
        onClose={() => setSelectedId(null)}
        onEdit={(appointment) =>
          void navigate(`/appointments?view=day&date=${toIsoDate(new Date(appointment.startsAt))}`)
        }
      />
    </div>
  );
}
