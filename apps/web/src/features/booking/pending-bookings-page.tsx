import type { CalendarAppointment } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Button,
  EmptyState,
  FormField,
  Icon,
  Ltr,
  Modal,
  PageHeader,
  PersonName,
  PhoneLink,
  StatCard,
  StatRow,
  Table,
  Textarea,
  usePageParams,
  useToast,
  type Column,
} from "@clinic/ui";
import { toTimeLabel, minutesOf } from "@web/features/appointments/calendar-time";
import { setClinicTimeZone } from "@web/lib/clinic-zone";
import {
  canConfirmBooking,
  canRejectBooking,
  useConfirmBooking,
  usePendingBookings,
  useRejectBooking,
} from "@web/features/booking/queries";
import { useSession } from "@web/features/auth/session";
import { useClinic } from "@web/features/clinic/queries";
import { errorMessageKey } from "@web/lib/api-error";
import { formatDate, formatDateTime } from "@web/lib/format";
import { isRefetching } from "@clinic/ui/lib/use-delayed-loading";

// Anything in `requested` came from the booking page — either a clinic confirming by hand, or an
// unfinished OTP, which expires by itself. Both decisions also tell the patient.
export function PendingBookingsPage(): JSX.Element {
  const { t } = useTranslation();
  const { can } = useSession();
  const toast = useToast();
  const { page, perPage, setPage, setPerPage } = usePageParams(25);
  const [rejecting, setRejecting] = useState<CalendarAppointment>();
  const [reason, setReason] = useState("");

  // Every time here is the clinic's wall clock: reception reading 13:30 for a 16:30 appointment
  // would ring the wrong patient.
  const clinic = useClinic();
  setClinicTimeZone(clinic.data);

  const pending = usePendingBookings({ page, limit: perPage });
  const confirm = useConfirmBooking();
  const reject = useRejectBooking();

  const rows = pending.data?.items ?? [];
  const today = formatDate(new Date().toISOString());
  const todayCount = rows.filter((row) => formatDate(row.startsAt) === today).length;

  const onConfirm = async (row: CalendarAppointment): Promise<void> => {
    try {
      await confirm.mutateAsync(row.id);
      toast.success("booking.pending.confirmed");
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const onReject = async (): Promise<void> => {
    if (!rejecting) {
      return;
    }

    try {
      await reject.mutateAsync({ id: rejecting.id, reason: reason.trim() });
      setRejecting(undefined);
      setReason("");
      toast.success("booking.pending.rejected");
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const columns: readonly Column<CalendarAppointment>[] = [
    {
      key: "patient",
      header: "booking.pending.columns.patient",
      primary: true,
      render: (row) => (
        <span className="flex flex-col items-start gap-1">
          <span className="font-medium text-ink">{row.patientName}</span>
          {/* A record from the booking page has no file number of the clinic's making — nobody has
              seen this person's ID yet, and saying so stops it being discovered at the chair. */}
          {row.patientUnverified && (
            <Badge tone="warning" data-testid="pending-booking-unverified">
              {t("booking.pending.unverified")}
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: "phone",
      header: "booking.pending.columns.phone",
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
          <Ltr className="font-medium tabular-nums">{toTimeLabel(minutesOf(row.startsAt))}</Ltr>
        </span>
      ),
    },
    {
      key: "requestedAt",
      header: "booking.pending.columns.requestedAt",
      hideOnMobile: true,
      render: (row) => <Ltr>{formatDateTime(row.createdAt)}</Ltr>,
    },
    {
      key: "actions",
      header: "booking.pending.columns.actions",
      actions: true,
      render: (row) => (
        <span className="flex items-center gap-3">
          {canConfirmBooking(can) && (
            <Button
              size="sm"
              variant="ghost"
              icon={<Icon name="check" />}
              data-testid="pending-booking-confirm"
              onClick={() => void onConfirm(row)}
              disabled={confirm.isPending}
            >
              {t("booking.pending.confirm")}
            </Button>
          )}
          {canRejectBooking(can) && (
            <Button
              size="sm"
              variant="quiet"
              icon={<Icon name="x" />}
              data-testid="pending-booking-reject"
              onClick={() => {
                setRejecting(row);
                setReason("");
              }}
            >
              {t("booking.pending.reject")}
            </Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <div data-testid="pending-bookings-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="pending-bookings-header"
        title="booking.pending.title"
        subtitle="booking.pending.subtitle"
      />

      {rows.length > 0 && (
        <StatRow data-testid="pending-bookings-kpis">
          <StatCard
            icon="calendar"
            tone="primary"
            data-testid="pending-bookings-kpi-waiting"
            label={t("booking.pending.kpi.waiting")}
            value={pending.data?.total ?? 0}
            caption={t("booking.pending.kpi.waitingCaption")}
          />
          <StatCard
            icon="clock"
            tone="warning"
            data-testid="pending-bookings-kpi-today"
            label={t("booking.pending.kpi.today")}
            value={todayCount}
            caption={t("booking.pending.kpi.todayCaption")}
          />
        </StatRow>
      )}

      <Table
        data-testid="pending-bookings-table"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        isLoading={pending.isPending}
        isRefreshing={isRefetching(pending)}
        empty={
          <EmptyState
            icon="calendar"
            data-testid="pending-bookings-empty"
            title="booking.pending.empty"
            hint="booking.pending.emptyHint"
          />
        }
        pagination={{
          page,
          totalPages: pending.data?.totalPages ?? 0,
          onPageChange: setPage,
          perPage,
          onPerPageChange: setPerPage,
        }}
      />

      <Modal
        data-testid="pending-booking-reject-modal"
        open={rejecting !== undefined}
        onOpenChange={(open) => !open && setRejecting(undefined)}
        title={t("booking.pending.rejectTitle")}
        description={t("booking.pending.rejectBody")}
        footer={
          <>
            <Button
              variant="secondary"
              data-testid="pending-booking-reject-cancel"
              onClick={() => setRejecting(undefined)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              icon={<Icon name="x" />}
              data-testid="pending-booking-reject-confirm"
              isLoading={reject.isPending}
              disabled={reason.trim().length < 3}
              onClick={() => void onReject()}
            >
              {t("booking.pending.reject")}
            </Button>
          </>
        }
      >
        <FormField label="booking.pending.reasonLabel" htmlFor="reject-reason">
          <Textarea
            id="reject-reason"
            data-testid="pending-booking-reject-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
          />
        </FormField>
      </Modal>
    </div>
  );
}
