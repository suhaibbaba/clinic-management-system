import { DASHBOARD_WIDGET, type DashboardKeyNumber, type DashboardWidgetId } from "@clinic/shared";
import type { JSX } from "react";
import { useSession } from "@web/shared/providers/session";
import { useClinic } from "@web/shared/queries/clinic";
import { canOpenPatientFile } from "@web/shared/permissions/patients";
import { useQueryLoading } from "@clinic/ui/lib/use-delayed-loading";
import { useDashboardSummary } from "@web/modules/dashboard/queries";
import { MiniCalendar } from "@web/modules/dashboard/components/mini-calendar";
import { WelcomeBanner } from "@web/modules/dashboard/components/welcome-banner";
import { KeyNumbers } from "@web/modules/dashboard/components/key-numbers";
import { TodaySchedule } from "@web/modules/dashboard/components/today-schedule";
import { QuickActions } from "@web/modules/dashboard/components/quick-actions";
import { VisitsToday } from "@web/modules/dashboard/components/visits-today";
import { TopDebts } from "@web/modules/dashboard/components/top-debts";
import { NewPatients } from "@web/modules/dashboard/components/new-patients";
import { CollectionsChart } from "@web/modules/dashboard/components/collections-chart";
import { NotesWidget } from "@web/modules/notes/components/notes-widget";

export interface DashboardWidgetProps {
  readonly id: DashboardWidgetId;
  readonly keyNumbers: readonly DashboardKeyNumber[];
}

export function DashboardWidget({ id, keyNumbers }: DashboardWidgetProps): JSX.Element {
  const { user, can } = useSession();
  const clinic = useClinic();
  const summary = useDashboardSummary();
  const { showSkeleton, isRefreshing } = useQueryLoading(summary);
  const data = summary.data;
  const currency = clinic.data?.currency;

  switch (id) {
    case DASHBOARD_WIDGET.GREETING:
      return <WelcomeBanner date={data?.date} schedule={data?.schedule ?? []} />;
    case DASHBOARD_WIDGET.KEY_NUMBERS:
      return (
        <KeyNumbers shown={keyNumbers} data={data} currency={currency} isLoading={showSkeleton} />
      );
    case DASHBOARD_WIDGET.SCHEDULE:
      return (
        <TodaySchedule
          rows={data?.schedule ?? []}
          isLoading={summary.isPending}
          isRefreshing={isRefreshing}
          linkPatients={user !== null && canOpenPatientFile(can)}
        />
      );
    case DASHBOARD_WIDGET.CALENDAR:
      return <MiniCalendar />;
    case DASHBOARD_WIDGET.NOTES:
      return <NotesWidget />;
    case DASHBOARD_WIDGET.QUICK_ACTIONS:
      return <QuickActions currency={currency} />;
    case DASHBOARD_WIDGET.VISITS_TODAY:
      return <VisitsToday currency={currency} />;
    case DASHBOARD_WIDGET.TOP_DEBTS:
      return <TopDebts currency={currency} />;
    case DASHBOARD_WIDGET.NEW_PATIENTS:
      return <NewPatients />;
    case DASHBOARD_WIDGET.COLLECTIONS:
      return <CollectionsChart currency={currency} />;
  }
}
