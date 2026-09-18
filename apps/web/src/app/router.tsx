import { USER_ROLE } from "@clinic/shared";
import { lazy, Suspense, type JSX } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@web/components/layout/app-layout";
import { RequireAuth, RequireRole } from "@web/features/auth/guards";
import { ForgotPasswordPage } from "@web/features/auth/forgot-password-page";
import { LoginPage } from "@web/features/auth/login-page";
import { SetPasswordPage } from "@web/features/auth/set-password-page";
import { ClinicPage } from "@web/features/clinic/clinic-page";
import { DashboardPage } from "@web/features/dashboard/dashboard-page";
import { DoctorPage } from "@web/features/doctors/doctor-page";
import { DoctorsPage } from "@web/features/doctors/doctors-page";
import { InventorySection } from "@web/features/inventory/inventory-section";
import { ShoppingListPage } from "@web/features/inventory/shopping-list-page";
import { LabsSection } from "@web/features/labs/labs-section";
import { LabPage } from "@web/features/labs/lab-page";
import { PatientPage } from "@web/features/patients/patient-page";
import { PATIENT_FILE_ROLES } from "@web/features/patients/permissions";
import { PatientsPage } from "@web/features/patients/patients-page";
import { ProfilePage } from "@web/features/profile/profile-page";
import { UsersPage } from "@web/features/users/users-page";
import { Skeleton } from "@clinic/ui/components/skeleton";

const AppointmentsSection = lazy(async () => ({
  default: (await import("@web/features/appointments/appointments-section")).AppointmentsSection,
}));

const AuditPage = lazy(async () => ({
  default: (await import("@web/features/audit/audit-page")).AuditPage,
}));

const PermissionsPage = lazy(async () => ({
  default: (await import("@web/features/permissions/permissions-page")).PermissionsPage,
}));

const LookupsPage = lazy(async () => ({
  default: (await import("@web/features/lookups/lookups-page")).LookupsPage,
}));

const TranslationsPage = lazy(async () => ({
  default: (await import("@web/features/translations/translations-page")).TranslationsPage,
}));

const ADMIN_ONLY = [USER_ROLE.ADMIN] as const;

// Mirrors `NAV_ITEMS`, because a hidden entry still reachable by typing its address is not hidden.
// The API remains the real boundary.
const PATIENTS = [USER_ROLE.ADMIN, USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST] as const;
const APPOINTMENTS = [USER_ROLE.ADMIN, USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST] as const;
const LABS = [USER_ROLE.ADMIN, USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN] as const;
const INVENTORY = [USER_ROLE.ADMIN, USER_ROLE.TECHNICIAN] as const;
/** A doctor reaches their own page from the user menu; admin reaches any. */
const DOCTOR_PAGE = [USER_ROLE.ADMIN, USER_ROLE.DOCTOR] as const;

/** The dashboard is where a role that may not be somewhere is sent instead. */
const HOME = "/dashboard";

function RouteChunk({ children }: { readonly children: JSX.Element }): JSX.Element {
  return (
    <Suspense fallback={<Skeleton aria-hidden="true" className="h-[520px] w-full rounded-card" />}>
      {children}
    </Suspense>
  );
}

export function AppRoutes(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Public by necessity: whoever opens these cannot sign in yet. One screen, two names — the
          letter that sent them here is what decides which. */}
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
          path="/inventory/shopping-list"
          element={
            <RequireRole roles={INVENTORY} redirectTo={HOME}>
              <ShoppingListPage />
            </RequireRole>
          }
        />

        {/* Settings — the collapsed group at the foot of the sidebar. */}
        <Route
          path="/clinic"
          element={
            <RequireRole roles={ADMIN_ONLY} redirectTo={HOME}>
              <ClinicPage />
            </RequireRole>
          }
        />
        <Route
          path="/doctors"
          element={
            <RequireRole roles={ADMIN_ONLY} redirectTo={HOME}>
              <DoctorsPage />
            </RequireRole>
          }
        />
        {/* Not admin-only, unlike the list it hangs off: ROLES.md lets a doctor edit their own
            schedule, and the service is what refuses somebody else's. */}
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
          path="/clinic/translations"
          element={
            <RequireRole roles={ADMIN_ONLY} redirectTo={HOME}>
              <RouteChunk>
                <TranslationsPage />
              </RouteChunk>
            </RequireRole>
          }
        />
        <Route
          path="/users"
          element={
            <RequireRole roles={ADMIN_ONLY} redirectTo={HOME}>
              <UsersPage />
            </RequireRole>
          }
        />
        <Route
          path="/permissions"
          element={
            <RequireRole roles={ADMIN_ONLY} redirectTo={HOME}>
              <RouteChunk>
                <PermissionsPage />
              </RouteChunk>
            </RequireRole>
          }
        />
        <Route
          path="/audit-log"
          element={
            <RequireRole roles={ADMIN_ONLY} redirectTo={HOME}>
              <RouteChunk>
                <AuditPage />
              </RouteChunk>
            </RequireRole>
          }
        />

        {/* The addresses this restructure retired */}
        {/* Kept rather than dropped: somebody's browser still knows these, and landing on a
            dashboard because a link rotted is worse than landing where the page went. */}
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
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
