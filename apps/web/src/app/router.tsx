import { USER_ROLE } from "@clinic/shared";
import { lazyPage } from "@web/shared/lib/lazy-page";
import { Suspense, type JSX } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ASSISTANT_ROLES } from "@web/shared/lib/navigation";
import { AppLayout } from "@web/app/layout/app-layout";
import { RequireAuth, RequireRole } from "@web/modules/auth/components/guards";
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
import { PATIENT_FILE_ROLES } from "@web/shared/permissions/patients";
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

const LookupsPage = lazyPage(async () => ({
  default: (await import("@web/modules/lookups/pages/lookups-page")).LookupsPage,
}));

const ADMIN_ONLY = [USER_ROLE.ADMIN] as const;

const PATIENTS = [
  USER_ROLE.ADMIN,
  USER_ROLE.DOCTOR,
  USER_ROLE.VISITING_DOCTOR,
  USER_ROLE.RECEPTIONIST,
] as const;
const APPOINTMENTS = PATIENTS;
const LABS = [USER_ROLE.ADMIN, USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN] as const;
const INVENTORY = [USER_ROLE.ADMIN, USER_ROLE.TECHNICIAN] as const;
const DOCTOR_PAGE = [USER_ROLE.ADMIN, USER_ROLE.DOCTOR] as const;

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
            <RequireRole roles={ASSISTANT_ROLES} redirectTo={HOME}>
              <RouteChunk>
                <AssistantPage />
              </RouteChunk>
            </RequireRole>
          }
        />
        <Route
          path="/assistant/:conversationId"
          element={
            <RequireRole roles={ASSISTANT_ROLES} redirectTo={HOME}>
              <RouteChunk>
                <AssistantPage />
              </RouteChunk>
            </RequireRole>
          }
        />

        <Route
          path="/patients"
          element={
            <RequireRole roles={PATIENTS} redirectTo={HOME}>
              <PatientsPage />
            </RequireRole>
          }
        />

        <Route
          path="/patients/:id"
          element={
            <RequireRole roles={PATIENT_FILE_ROLES} redirectTo={HOME}>
              <PatientPage />
            </RequireRole>
          }
        />

        <Route
          path="/appointments"
          element={
            <RequireRole roles={APPOINTMENTS} redirectTo={HOME}>
              <RouteChunk>
                <AppointmentsSection />
              </RouteChunk>
            </RequireRole>
          }
        />

        <Route
          path="/labs"
          element={
            <RequireRole roles={LABS} redirectTo={HOME}>
              <LabsSection />
            </RequireRole>
          }
        />

        <Route
          path="/labs/:id"
          element={
            <RequireRole roles={LABS} redirectTo={HOME}>
              <LabPage />
            </RequireRole>
          }
        />

        <Route
          path="/inventory"
          element={
            <RequireRole roles={INVENTORY} redirectTo={HOME}>
              <InventorySection />
            </RequireRole>
          }
        />

        <Route
          path="/inventory/items/:id"
          element={
            <RequireRole roles={INVENTORY} redirectTo={HOME}>
              <ItemPage />
            </RequireRole>
          }
        />

        <Route
          path="/inventory/shopping-list"
          element={
            <RequireRole roles={INVENTORY} redirectTo={HOME}>
              <ShoppingListPage />
            </RequireRole>
          }
        />

        <Route
          path="/clinic"
          element={
            <RequireRole roles={ADMIN_ONLY} redirectTo={HOME}>
              <ClinicPage />
            </RequireRole>
          }
        />
        <Route
          path="/users"
          element={
            <RequireRole roles={ADMIN_ONLY} redirectTo={HOME}>
              <UsersSection />
            </RequireRole>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireRole roles={ADMIN_ONLY} redirectTo={HOME}>
              <SettingsSection />
            </RequireRole>
          }
        />
        <Route
          path="/doctors/:id"
          element={
            <RequireRole roles={DOCTOR_PAGE} redirectTo={HOME}>
              <DoctorPage />
            </RequireRole>
          }
        />
        <Route
          path="/clinic/lists"
          element={
            <RequireRole roles={ADMIN_ONLY} redirectTo={HOME}>
              <RouteChunk>
                <LookupsPage />
              </RouteChunk>
            </RequireRole>
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
