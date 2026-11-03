import {
  DASHBOARD_CUSTOMIZE_PARAM,
  DASHBOARD_WIDGET,
  DEFAULT_DASHBOARD_LAYOUT,
  normalizeDashboardLayout,
  type DashboardWidgetPlacement,
} from "@clinic/shared";
import { Suspense, useMemo, useState, type JSX } from "react";
import { lazyPage } from "@web/shared/lib/lazy-page";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Button, EmptyState, Icon, PageAction } from "@clinic/ui";
import { Skeleton } from "@clinic/ui/components/skeleton";
import { useSession } from "@web/shared/providers/session";
import { AppointmentFormModal } from "@web/modules/appointments/components/appointment-form-modal";
import { canBookAppointment } from "@web/shared/permissions/appointments";
import { canCustomizeDashboard } from "@web/shared/permissions/dashboard";
import { setClinicTimeZone } from "@web/shared/lib/clinic-locale";
import { useClinic } from "@web/shared/queries/clinic";
import { useDashboardLayout, useDashboardSummary } from "@web/modules/dashboard/queries";
import { MiniCalendar } from "@web/modules/dashboard/components/mini-calendar";
import { WelcomeBanner } from "@web/modules/dashboard/components/welcome-banner";
import { KeyNumbers } from "@web/modules/dashboard/components/key-numbers";
import { TodaySchedule } from "@web/modules/dashboard/components/today-schedule";
import { DashboardZones } from "@web/modules/dashboard/components/dashboard-zones";
import { NotesWidget } from "@web/modules/notes/components/notes-widget";
import { QuickActions } from "@web/modules/dashboard/components/quick-actions";
import { VisitsToday } from "@web/modules/dashboard/components/visits-today";
import { TopDebts } from "@web/modules/dashboard/components/top-debts";
import { NewPatients } from "@web/modules/dashboard/components/new-patients";
import { CollectionsChart } from "@web/modules/dashboard/components/collections-chart";
import { canOpenPatientFile } from "@web/shared/permissions/patients";
import { useDocumentTitle } from "@clinic/ui/lib/page-title";
import { useQueryLoading } from "@clinic/ui/lib/use-delayed-loading";

const DashboardCustomizePage = lazyPage(async () => ({
  default: (await import("@web/modules/dashboard/pages/dashboard-customize-page"))
    .DashboardCustomizePage,
}));

export function DashboardPage(): JSX.Element {
  const { can } = useSession();
  const [params] = useSearchParams();

  if (params.has(DASHBOARD_CUSTOMIZE_PARAM) && canCustomizeDashboard(can)) {
    return (
      <Suspense
        fallback={<Skeleton aria-hidden="true" className="h-[520px] w-full rounded-card" />}
      >
        <DashboardCustomizePage />
      </Suspense>
    );
  }

  return <DashboardView />;
}

function DashboardView(): JSX.Element {
  const { t } = useTranslation();
  const { user, can } = useSession();
  const [booking, setBooking] = useState(false);

  const clinic = useClinic();
  setClinicTimeZone(clinic.data);

  useDocumentTitle(t("dashboard.title"));

  const summary = useDashboardSummary();
  const saved = useDashboardLayout();
  const { showSkeleton, isRefreshing } = useQueryLoading(summary);
  const data = summary.data;
  const currency = clinic.data?.currency;

  const layout = useMemo(
    () => normalizeDashboardLayout(saved.data ?? DEFAULT_DASHBOARD_LAYOUT, can),
    [saved.data, can],
  );

  const present = (widget: DashboardWidgetPlacement): boolean =>
    widget.id !== DASHBOARD_WIDGET.KEY_NUMBERS || layout.keyNumbers.length > 0;

  const render = (widget: DashboardWidgetPlacement): JSX.Element => {
    switch (widget.id) {
      case DASHBOARD_WIDGET.GREETING:
        return <WelcomeBanner date={data?.date} schedule={data?.schedule ?? []} />;
      case DASHBOARD_WIDGET.KEY_NUMBERS:
        return (
          <KeyNumbers
            shown={layout.keyNumbers}
            data={data}
            currency={currency}
            isLoading={showSkeleton}
          />
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
  };

  return (
    <div data-testid="dashboard-page" className="flex flex-col gap-4">
      {canBookAppointment(can) && (
        <PageAction>
          <Button
            icon={<Icon name="plus" />}
            data-testid="dashboard-create-appointment"
            onClick={() => setBooking(true)}
          >
            {t("appointments.create")}
          </Button>
        </PageAction>
      )}

      <AppointmentFormModal
        data-testid="dashboard-appointment-modal"
        open={booking}
        onOpenChange={setBooking}
      />

      {summary.isError && (
        <EmptyState
          icon="alert"
          data-testid="dashboard-error"
          title="errors.unknown"
          hint="dashboard.failed"
        />
      )}

      {saved.isPending ? (
        <Skeleton aria-hidden="true" className="h-[520px] w-full rounded-card" />
      ) : (
        <DashboardZones data-testid="dashboard" layout={layout} present={present} render={render} />
      )}
    </div>
  );
}
