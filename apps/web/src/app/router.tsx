import { lazyPage } from "@web/shared/lib/lazy-page";
import { Suspense, type JSX } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { PAGE_CAPABILITIES } from "@web/shared/lib/navigation";
import { AppLayout } from "@web/app/layout/app-layout";
import { RequireAuth, RequireCapability } from "@web/modules/auth/components/guards";
import { ForgotPasswordPage } from "@web/modules/auth/pages/forgot-password-page";
import { LoginCodePage } from "@web/modules/auth/pages/login-code-page";
import { LoginPage } from "@web/modules/auth/pages/login-page";
import { SetPasswordPage } from "@web/modules/auth/pages/set-password-page";
import { ClinicPage } from "@web/modules/clinic/pages/clinic-page";
import { DashboardPage } from "@web/modules/dashboard/pages/dashboard-page";
import { DoctorPage } from "@web/modules/doctors/pages/doctor-page";
import { InventorySection } from "@web/modules/inventory/pages/inventory-section";
import { ItemPage } from "@web/modules/inventory/pages/item-page";
import { ShoppingListPage } from "@web/modules/inventory/pages/shopping-list-page";
import { LabsSection } from "@web/modules/labs/pages/labs-section";
import { LabPage } from "@web/modules/labs/pages/lab-page";
import { PatientPage } from "@web/modules/patients/pages/patient-page";
import { PatientsPage } from "@web/modules/patients/pages/patients-page";
import { ProfilePage } from "@web/modules/profile/pages/profile-page";
import { SettingsSection } from "@web/modules/settings/pages/settings-section";
import { UsersSection } from "@web/modules/users/pages/users-section";
import { Skeleton } from "@clinic/ui/components/skeleton";

const AppointmentsSection = lazyPage(async () => ({
  default: (await import("@web/modules/appointments/pages/appointments-section"))
    .AppointmentsSection,
}));

const AssistantPage = lazyPage(async () => ({
  default: (await import("@web/modules/assistant/pages/assistant-page")).AssistantPage,
}));

const PayrollPage = lazyPage(async () => ({
  default: (await import("@web/modules/payroll/pages/payroll-page")).PayrollPage,
}));
const LookupsPage = lazyPage(async () => ({
  default: (await import("@web/modules/lookups/pages/lookups-page")).LookupsPage,
}));

const HOME = "/dashboard";

function RedirectKeepingQuery({
  to,
  view,
}: {
  readonly to: string;
  readonly view?: string | undefined;
}): JSX.Element {
  const params = new URLSearchParams(useLocation().search);

  if (view !== undefined) {
    params.set("view", view);
  }

  const query = params.toString();

  return <Navigate to={query === "" ? to : `${to}?${query}`} replace />;
}

function RouteChunk({ children }: { readonly children: JSX.Element }): JSX.Element {
  return (
    <Suspense
      fallback={
        <div aria-hidden="true" className="flex flex-col gap-5">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-32 w-full rounded-card" />
          <Skeleton className="h-[360px] w-full rounded-card" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export function AppRoutes(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/login/code" element={<LoginCodePage />} />
      <Route path="/activate/:token" element={<SetPasswordPage purpose="activate" />} />
      <Route path="/reset/:token" element={<SetPasswordPage purpose="reset" />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to={HOME} replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />

        <Route
          path="/assistant"
          element={
            <RequireCapability capabilities={PAGE_CAPABILITIES.assistant} redirectTo={HOME}>
              <RouteChunk>
                <AssistantPage />
              </RouteChunk>
            </RequireCapability>
          }
        />
        <Route
          path="/assistant/:conversationId"
          element={
            <RequireCapability capabilities={PAGE_CAPABILITIES.assistant} redirectTo={HOME}>
              <RouteChunk>
                <AssistantPage />
              </RouteChunk>
            </RequireCapability>
          }
        />

        <Route
          path="/patients"
          element={
            <RequireCapability capabilities={PAGE_CAPABILITIES.patients} redirectTo={HOME}>
              <PatientsPage />
            </RequireCapability>
          }
        />

        <Route
          path="/patients/:id"
          element={
            <RequireCapability capabilities={PAGE_CAPABILITIES.patientFile} redirectTo={HOME}>
              <PatientPage />
            </RequireCapability>
          }
        />

        <Route
          path="/appointments"
          element={
            <RequireCapability capabilities={PAGE_CAPABILITIES.appointments} redirectTo={HOME}>
              <RouteChunk>
                <AppointmentsSection />
              </RouteChunk>
            </RequireCapability>
          }
        />

        <Route
          path="/labs"
          element={
            <RequireCapability capabilities={PAGE_CAPABILITIES.labs} redirectTo={HOME}>
              <LabsSection />
            </RequireCapability>
          }
        />

        <Route
          path="/labs/:id"
          element={
            <RequireCapability capabilities={PAGE_CAPABILITIES.labs} redirectTo={HOME}>
              <LabPage />
            </RequireCapability>
          }
        />

        <Route
          path="/inventory"
          element={
            <RequireCapability capabilities={PAGE_CAPABILITIES.inventory} redirectTo={HOME}>
              <InventorySection />
            </RequireCapability>
          }
        />

        <Route
          path="/inventory/items/:id"
          element={
            <RequireCapability capabilities={PAGE_CAPABILITIES.inventory} redirectTo={HOME}>
              <ItemPage />
            </RequireCapability>
          }
        />

        <Route
          path="/inventory/shopping-list"
          element={
            <RequireCapability capabilities={PAGE_CAPABILITIES.inventory} redirectTo={HOME}>
              <ShoppingListPage />
            </RequireCapability>
          }
        />

        <Route
          path="/clinic"
          element={
            <RequireCapability capabilities={PAGE_CAPABILITIES.clinic} redirectTo={HOME}>
              <ClinicPage />
            </RequireCapability>
          }
        />
        <Route
          path="/users"
          element={
            <RequireCapability capabilities={PAGE_CAPABILITIES.users} redirectTo={HOME}>
              <UsersSection />
            </RequireCapability>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireCapability capabilities={PAGE_CAPABILITIES.settings} redirectTo={HOME}>
              <SettingsSection />
            </RequireCapability>
          }
        />
        <Route
          path="/doctors/:id"
          element={
            <RequireCapability capabilities={PAGE_CAPABILITIES.doctor} redirectTo={HOME}>
              <DoctorPage />
            </RequireCapability>
          }
        />
        <Route
          path="/payroll"
          element={
            <RequireCapability capabilities={PAGE_CAPABILITIES.payroll} redirectTo={HOME}>
              <RouteChunk>
                <PayrollPage />
              </RouteChunk>
            </RequireCapability>
          }
        />
        <Route
          path="/clinic/lists"
          element={
            <RequireCapability capabilities={PAGE_CAPABILITIES.lists} redirectTo={HOME}>
              <RouteChunk>
                <LookupsPage />
              </RouteChunk>
            </RequireCapability>
          }
        />

        <Route
          path="/appointments/pending"
          element={<Navigate to="/appointments?status=pending" replace />}
        />
        <Route
          path="/billing/overdue"
          element={<Navigate to="/patients?filter=balance" replace />}
        />
        <Route path="/lab-orders" element={<Navigate to="/labs?tab=orders" replace />} />
        <Route path="/suppliers" element={<Navigate to="/inventory?tab=suppliers" replace />} />
        <Route path="/doctors" element={<Navigate to="/users?view=doctors" replace />} />
        <Route path="/clinic/translations" element={<RedirectKeepingQuery to="/settings" />} />
        <Route
          path="/assistant/settings"
          element={<RedirectKeepingQuery to="/settings" view="assistant" />}
        />
        <Route
          path="/permissions"
          element={<RedirectKeepingQuery to="/settings" view="permissions" />}
        />
        <Route path="/audit-log" element={<RedirectKeepingQuery to="/settings" view="audit" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
