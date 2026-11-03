import {
  DASHBOARD_KEY_NUMBER,
  type DashboardKeyNumber,
  type DashboardSummary,
} from "@clinic/shared";
import type { JSX, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { StatCard, type StatTone } from "@clinic/ui";
import { SkeletonKpi } from "@clinic/ui/components/skeleton";
import { Money } from "@web/shared/components/money";
import { formatDate } from "@web/shared/lib/format";
import { cn } from "@clinic/ui/lib/cn";

export interface KeyNumbersProps {
  readonly shown: readonly DashboardKeyNumber[];
  readonly data: DashboardSummary | undefined;
  readonly currency: string | undefined;
  readonly isLoading: boolean;
}

export function KeyNumbers({ shown, data, currency, isLoading }: KeyNumbersProps): JSX.Element {
  const { t } = useTranslation();

  if (isLoading) {
    return <SkeletonKpi count={shown.length} />;
  }

  const card = (key: DashboardKeyNumber): JSX.Element | null => {
    if (key === DASHBOARD_KEY_NUMBER.APPOINTMENTS_TODAY && data?.appointmentsToday !== undefined) {
      return (
        <KpiLink key={key} to="/appointments" data-testid="dashboard-kpi-today-link">
          <StatCard
            icon="calendar"
            data-testid="dashboard-kpi-today"
            label={t("dashboard.kpi.today")}
            value={data.appointmentsToday}
            caption={formatDate(data.date)}
          />
        </KpiLink>
      );
    }

    if (key === DASHBOARD_KEY_NUMBER.PENDING_BOOKINGS && data?.pendingBookings !== undefined) {
      return (
        <KpiLink
          key={key}
          to="/appointments?status=pending"
          data-testid="dashboard-kpi-pending-link"
        >
          <StatCard
            icon="clock"
            data-testid="dashboard-kpi-pending"
            tone={toneFor(data.pendingBookings > 0, "warning")}
            label={t("dashboard.kpi.pending")}
            value={data.pendingBookings}
            caption={t("dashboard.kpi.pendingCaption")}
          />
        </KpiLink>
      );
    }

    if (key === DASHBOARD_KEY_NUMBER.OVERDUE && data?.overdueTotal !== undefined) {
      return (
        <KpiLink key={key} to="/patients?filter=balance" data-testid="dashboard-kpi-overdue-link">
          <StatCard
            icon="money"
            data-testid="dashboard-kpi-overdue"
            tone={toneFor(Number(data.overdueTotal) > 0, "danger")}
            label={t("dashboard.kpi.overdue")}
            value={<Money amount={data.overdueTotal} currency={currency} />}
            caption={t("dashboard.kpi.overdueCaption", { count: data.overduePatients ?? 0 })}
          />
        </KpiLink>
      );
    }

    if (key === DASHBOARD_KEY_NUMBER.VISITS_TODAY && data?.visitsToday !== undefined) {
      return (
        <StatCard
          key={key}
          icon="stethoscope"
          data-testid="dashboard-kpi-visits"
          label={t("dashboard.kpi.visits")}
          value={data.visitsToday}
          caption={formatDate(data.date)}
        />
      );
    }

    if (key === DASHBOARD_KEY_NUMBER.COLLECTED_TODAY && data?.collectedToday !== undefined) {
      return (
        <StatCard
          key={key}
          icon="coins"
          data-testid="dashboard-kpi-collected"
          tone={toneFor(Number(data.collectedToday) > 0, "success")}
          label={t("dashboard.kpi.collected")}
          value={<Money amount={data.collectedToday} currency={currency} />}
          caption={formatDate(data.date)}
        />
      );
    }

    if (key === DASHBOARD_KEY_NUMBER.NEW_PATIENTS_TODAY && data?.newPatientsToday !== undefined) {
      return (
        <KpiLink key={key} to="/patients" data-testid="dashboard-kpi-new-patients-link">
          <StatCard
            icon="user-plus"
            data-testid="dashboard-kpi-new-patients"
            label={t("dashboard.kpi.newPatients")}
            value={data.newPatientsToday}
            caption={formatDate(data.date)}
          />
        </KpiLink>
      );
    }

    return null;
  };

  return (
    <div
      data-testid="dashboard-kpis"
      className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] gap-4"
    >
      {shown.map(card)}
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
      className={cn("block rounded-card", "focus-visible:outline-none")}
    >
      {children}
    </Link>
  );
}
