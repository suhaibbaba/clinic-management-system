import type { CalendarAppointment } from '@clinic/shared';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Badge,
  Button,
  EmptyState,
  FormField,
  Modal,
  PageHeader,
  RowAction,
  StatCard,
  StatRow,
  Table,
  Textarea,
  useToast,
  type Column,
} from '@web/components/ui';
import { toTimeLabel, minutesOf } from '@web/features/appointments/calendar-time';
import { setClinicTimeZone } from '@web/features/appointments/clinic-zone';
import {
  useConfirmBooking,
  usePendingBookings,
  useRejectBooking,
} from '@web/features/booking/queries';
import { useClinic } from '@web/features/clinic/queries';
import { errorMessageKey } from '@web/lib/api-error';
import { formatDate, formatDateTime } from '@web/lib/format';

const PAGE_SIZE = 20;

/**
 * What strangers booked on the public page and nobody has answered yet.
 *
 * The list is `requested` appointments, which is the whole marker: reception's
 * own bookings are created confirmed, so anything sitting in `requested` came
 * from the booking page — either from a clinic that confirms by hand, or from
 * a patient who has not finished their OTP yet (those disappear by themselves
 * when the hold expires).
 *
 * Two decisions, both of which also *tell the patient*. That is the part a
 * generic calendar transition cannot do: the person is not in the building, so
 * a confirmation nobody sends is a patient who does not know they have an
 * appointment.
 */
export function PendingBookingsPage(): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState<CalendarAppointment>();
  const [reason, setReason] = useState('');

  // Every time on this screen is the clinic's wall clock, not the browser's:
  // reception reading 13:30 for a 16:30 appointment would ring the wrong
  // patient. The calendar does the same thing for the same reason.
  const clinic = useClinic();
  setClinicTimeZone(clinic.data);

  const pending = usePendingBookings({ page, limit: PAGE_SIZE });
  const confirm = useConfirmBooking();
  const reject = useRejectBooking();

  const rows = pending.data?.items ?? [];
  const today = formatDate(new Date().toISOString());
  const todayCount = rows.filter((row) => formatDate(row.startsAt) === today).length;

  const onConfirm = async (row: CalendarAppointment): Promise<void> => {
    try {
      await confirm.mutateAsync(row.id);
      toast.success('booking.pending.confirmed');
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
      setReason('');
      toast.success('booking.pending.rejected');
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const columns: readonly Column<CalendarAppointment>[] = [
    {
      key: 'patient',
      header: 'booking.pending.columns.patient',
      primary: true,
      render: (row) => (
        <span className="flex flex-col items-start gap-1">
          <span className="font-medium text-ink">{row.patientName}</span>
          {/*
           * A record created by the booking page carries no file number of the
           * clinic's own making — nobody at the desk has seen this person's ID
           * yet. Saying so on the row is what stops it being discovered at the
           * chair.
           */}
          {row.patientUnverified && <Badge tone="warning">{t('booking.pending.unverified')}</Badge>}
        </span>
      ),
    },
    {
      key: 'phone',
      header: 'booking.pending.columns.phone',
      render: (row) => (
        <a
          href={`tel:${row.patientPhone}`}
          dir="ltr"
          className="text-primary-600 transition-colors duration-150 hover:text-primary-700"
        >
          {row.patientPhone}
        </a>
      ),
    },
    {
      key: 'doctor',
      header: 'booking.pending.columns.doctor',
      render: (row) => row.doctorName,
    },
    {
      key: 'slot',
      header: 'booking.pending.columns.slot',
      render: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          <span dir="ltr">{formatDate(row.startsAt)}</span>
          <span dir="ltr" className="font-medium tabular-nums">
            {toTimeLabel(minutesOf(row.startsAt))}
          </span>
        </span>
      ),
    },
    {
      key: 'requestedAt',
      header: 'booking.pending.columns.requestedAt',
      hideOnMobile: true,
      render: (row) => <span dir="ltr">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: 'booking.pending.columns.actions',
      actions: true,
      render: (row) => (
        <span className="flex items-center gap-3">
          <RowAction onClick={() => void onConfirm(row)} disabled={confirm.isPending}>
            {t('booking.pending.confirm')}
          </RowAction>
          <RowAction
            tone="quiet"
            onClick={() => {
              setRejecting(row);
              setReason('');
            }}
          >
            {t('booking.pending.reject')}
          </RowAction>
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="booking.pending.title" subtitle="booking.pending.subtitle" />

      {rows.length > 0 && (
        <StatRow>
          <StatCard
            icon="calendar"
            tone="primary"
            label={t('booking.pending.kpi.waiting')}
            value={pending.data?.total ?? 0}
            caption={t('booking.pending.kpi.waitingCaption')}
          />
          <StatCard
            icon="clock"
            tone="warning"
            label={t('booking.pending.kpi.today')}
            value={todayCount}
            caption={t('booking.pending.kpi.todayCaption')}
          />
        </StatRow>
      )}

      <Table
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        isLoading={pending.isPending}
        empty={
          <EmptyState
            icon="calendar"
            title="booking.pending.empty"
            hint="booking.pending.emptyHint"
          />
        }
        pagination={{
          page,
          totalPages: pending.data?.totalPages ?? 0,
          total: pending.data?.total ?? 0,
          onPageChange: setPage,
        }}
      />

      <Modal
        open={rejecting !== undefined}
        onOpenChange={(open) => !open && setRejecting(undefined)}
        title={t('booking.pending.rejectTitle')}
        description={t('booking.pending.rejectBody')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(undefined)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              isLoading={reject.isPending}
              disabled={reason.trim().length < 3}
              onClick={() => void onReject()}
            >
              {t('booking.pending.reject')}
            </Button>
          </>
        }
      >
        <FormField label="booking.pending.reasonLabel" htmlFor="reject-reason">
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
          />
        </FormField>
      </Modal>
    </div>
  );
}
