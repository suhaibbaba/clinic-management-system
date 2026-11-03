import {
  DASHBOARD_CUSTOMIZE_PARAM,
  DASHBOARD_WIDGET,
  DEFAULT_DASHBOARD_LAYOUT,
  normalizeDashboardLayout,
  type DashboardWidgetPlacement,
} from "@clinic/shared";
import { Suspense, useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Button, EmptyState, Icon, PageAction } from "@clinic/ui";
import { Skeleton } from "@clinic/ui/components/skeleton";
import { lazyPage } from "@web/shared/lib/lazy-page";
import { useSession } from "@web/shared/providers/session";
import { AppointmentFormModal } from "@web/modules/appointments/components/appointment-form-modal";
import { canBookAppointment } from "@web/shared/permissions/appointments";
import { canCustomizeDashboard } from "@web/shared/permissions/dashboard";
import { setClinicTimeZone } from "@web/shared/lib/clinic-locale";
import { useClinic } from "@web/shared/queries/clinic";
import { useDashboardLayout, useDashboardSummary } from "@web/modules/dashboard/queries";
import { DashboardZones } from "@web/modules/dashboard/components/dashboard-zones";
import { DashboardWidget } from "@web/modules/dashboard/components/dashboard-widget";
import { useDocumentTitle } from "@clinic/ui/lib/page-title";

const DashboardCustomizePage = lazyPage(async () => ({
  default: (await import("@web/modules/dashboard/pages/dashboard-customize-page"))
    .DashboardCustomizePage,
}));

export function DashboardPage(): JSX.Element {
  const { t } = useTranslation();
  const { can } = useSession();
  const [params] = useSearchParams();

  if (params.has(DASHBOARD_CUSTOMIZE_PARAM) && canCustomizeDashboard(can)) {
    return (
      <Suspense
        fallback={
          <>
            <h1 className="sr-only">{t("dashboard.customize.title")}</h1>
            <Skeleton aria-hidden="true" className="h-[520px] w-full rounded-card" />
          </>
        }
      >
        <DashboardCustomizePage />
      </Suspense>
    );
  }

  return <DashboardView />;
}

function DashboardView(): JSX.Element {
  const { t } = useTranslation();
  const { can } = useSession();
  const [booking, setBooking] = useState(false);

  const clinic = useClinic();
  setClinicTimeZone(clinic.data);

  useDocumentTitle(t("dashboard.title"));

  const summary = useDashboardSummary();
  const saved = useDashboardLayout();

  const layout = useMemo(
    () => normalizeDashboardLayout(saved.data ?? DEFAULT_DASHBOARD_LAYOUT, can),
    [saved.data, can],
  );

  const present = (widget: DashboardWidgetPlacement): boolean => {
    if (widget.id === DASHBOARD_WIDGET.KEY_NUMBERS) {
      return layout.keyNumbers.length > 0;
    }

    return widget.id !== DASHBOARD_WIDGET.QUICK_ACTIONS || (layout.quickActions ?? []).length > 0;
  };

  return (
    <div data-testid="dashboard-page" className="flex flex-col gap-4">
      <h1 className="sr-only">{t("dashboard.title")}</h1>

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
        <DashboardZones
          data-testid="dashboard"
          layout={layout}
          present={present}
          render={(widget) => (
            <DashboardWidget
              id={widget.id}
              keyNumbers={layout.keyNumbers}
              quickActions={layout.quickActions ?? []}
            />
          )}
        />
      )}
    </div>
  );
}
