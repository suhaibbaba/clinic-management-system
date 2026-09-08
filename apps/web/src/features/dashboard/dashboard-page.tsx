import type { CalendarAppointment } from '@clinic/shared';
import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import {
  Badge,
  EmptyState,
  Icon,
  Ltr,
  PageHeader,
  StatCard,
  Table,
  type Column,
  type StatTone,
} from '@web/components/ui';
import { useSession } from '@web/features/auth/session';
import { minutesOf, toTimeLabel } from '@web/features/appointments/calendar-time';
import { setClinicTimeZone } from '@web/features/appointments/clinic-zone';
import { APPOINTMENT_STATUS_STYLES, statusLabelKey } from '@web/features/appointments/status';
import { Money } from '@web/features/billing/money';
import { useClinic } from '@web/features/clinic/queries';
import { useDashboardSummary } from '@web/features/dashboard/queries';
import { canOpenPatientFile } from '@web/features/patients/permissions';
import { formatDate } from '@web/lib/format';
import { cn } from '@web/lib/cn';

/**
 * Where everyone lands.
 *
 * Three numbers and the day's list — the questions somebody actually opens
 * this app with: how busy is today, is anybody waiting on an answer, and how
 * much is outstanding. Each number is a door rather than a decoration: the
 * card is the link to the screen that shows the rows behind it, because a
 * count you cannot act on is trivia.
 *
 * Which cards exist follows the response, not the role: the API omits the
 * figures a role may not read (ROLES.md), so a missing field draws no card at
 * all. That is the same rule the patient table follows — the columns exist
 * exactly when the data does — and it means this page never has to keep its
 * own copy of the permission matrix.
 */
export function DashboardPage(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();

  // Every time drawn here is the clinic's wall clock, not the browser's — the
  // same reason the calendar and the booking queue set it.
  const clinic = useClinic();
  setClinicTimeZone(clinic.data);

  const summary = useDashboardSummary();
  const data = summary.data;
  const currency = clinic.data?.currency;

  const overdue = data?.overdueTotal;
  const pending = data?.pendingBookings;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="dashboard.title" subtitle="dashboard.subtitle" />

      {summary.isError && (
        <EmptyState icon="alert" title="errors.unknown" hint="dashboard.failed" />
      )}

      {/*
        Two up on a phone and three across from `sm`, rather than the shared
        four-column `StatRow`: there are three cards here at most, and a
        four-column grid would leave a hole where the fourth is not.
      */}
      {/*
        Two across until there is room for three.

        At `sm` the third column made each card 141px wide with 40px of its own
        padding — 101px for a figure that is 128px, and for a label that wraps
        to two lines and then overflows anyway. Three of these belong on a
        laptop, not on a tablet held in one hand at the desk.
      */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <KpiLink to="/appointments">
          <StatCard
            icon="calendar"
            label={t('dashboard.kpi.today')}
            value={data?.appointmentsToday ?? '—'}
            caption={data ? formatDate(data.date) : undefined}
          />
        </KpiLink>

        {pending !== undefined && (
          <KpiLink to="/appointments?status=pending">
            <StatCard
              icon="clock"
              // Warning only while somebody is actually waiting: a permanent
              // amber card is a card nobody reads.
              tone={toneFor(pending > 0, 'warning')}
              label={t('dashboard.kpi.pending')}
              value={pending}
              caption={t('dashboard.kpi.pendingCaption')}
            />
          </KpiLink>
        )}

        {overdue !== undefined && (
          <KpiLink to="/patients?filter=balance">
            <StatCard
              icon="money"
              tone={toneFor(Number(overdue) > 0, 'danger')}
              label={t('dashboard.kpi.overdue')}
              value={<Money amount={overdue} currency={currency} />}
              caption={t('dashboard.kpi.overdueCaption', { count: data?.overduePatients ?? 0 })}
            />
          </KpiLink>
        )}
      </div>

      <TodaySchedule
        rows={data?.schedule ?? []}
        isLoading={summary.isPending}
        linkPatients={canOpenPatientFile(user?.role)}
      />
    </div>
  );
}

/** A neutral card when there is nothing to flag, the given tone when there is. */
const toneFor = (active: boolean, tone: StatTone): StatTone => (active ? tone : 'neutral');

/**
 * A KPI card that is a link.
 *
 * The anchor wraps the card rather than sitting inside it, so the whole tile
 * is the target — a card whose only clickable part is a caption is a card
 * people report as broken. `block` and the focus ring are here because the
 * card itself knows nothing about being a link.
 */
function KpiLink({
  to,
  children,
}: {
  readonly to: string;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <Link
      to={to}
      className={cn(
        'block rounded-card transition-shadow duration-150 hover:shadow-float',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
      )}
    >
      {children}
    </Link>
  );
}

/** The day, in order, with a link out to the calendar it is a slice of. */
function TodaySchedule({
  rows,
  isLoading,
  linkPatients,
}: {
  readonly rows: readonly CalendarAppointment[];
  readonly isLoading: boolean;
  /**
   * Whether the patient's name opens their file.
   *
   * A technician reads the day — the calendar is `R` for every role — but the
   * file behind the name is not theirs to open, and a link that bounces the
   * reader back to where they came from is worse than plain text.
   */
  readonly linkPatients: boolean;
}): JSX.Element {
  const { t } = useTranslation();

  const columns: readonly Column<CalendarAppointment>[] = [
    {
      key: 'time',
      header: 'dashboard.schedule.time',
      render: (row) => (
        <Ltr className="font-semibold tabular-nums">{toTimeLabel(minutesOf(row.startsAt))}</Ltr>
      ),
    },
    {
      key: 'patient',
      header: 'dashboard.schedule.patient',
      primary: true,
      render: (row) =>
        linkPatients ? (
          <Link
            to={`/patients/${row.patientId}`}
            className="font-medium text-primary-600 transition-colors duration-150 hover:text-primary-700"
          >
            {row.patientName}
          </Link>
        ) : (
          <span className="font-medium text-ink">{row.patientName}</span>
        ),
    },
    {
      key: 'doctor',
      header: 'dashboard.schedule.doctor',
      hideOnMobile: true,
      render: (row) => row.doctorName,
    },
    {
      key: 'status',
      header: 'dashboard.schedule.status',
      render: (row) => (
        <Badge tone={APPOINTMENT_STATUS_STYLES[row.status].tone}>
          {t(statusLabelKey(row.status))}
        </Badge>
      ),
    },
  ];

  return (
    <section aria-label={t('dashboard.schedule.title')} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-value font-semibold text-ink">{t('dashboard.schedule.title')}</h2>

        <Link
          to="/appointments"
          // A 20px-tall link is a 20px-tall target: the same blue text inside
          // a 44px box on touch, unchanged on a laptop.
          className="inline-flex min-h-11 items-center gap-1 text-label font-medium text-primary-600 transition-colors duration-150 hover:text-primary-700 lg:min-h-0"
        >
          {t('dashboard.schedule.seeAll')}
          <Icon name="chevron-end" className="size-4" />
        </Link>
      </div>

      <Table
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        empty={
          <EmptyState
            icon="calendar"
            title="dashboard.schedule.empty"
            hint="dashboard.schedule.emptyHint"
          />
        }
      />
    </section>
  );
}
