import { USER_ROLE } from '@clinic/shared';
import type { JSX } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from '@web/components/layout/app-layout';
import { AppointmentsSection } from '@web/features/appointments/appointments-section';
import { AuditPage } from '@web/features/audit/audit-page';
import { RequireAuth, RequireRole } from '@web/features/auth/guards';
import { LoginPage } from '@web/features/auth/login-page';
import { ClinicPage } from '@web/features/clinic/clinic-page';
import { DashboardPage } from '@web/features/dashboard/dashboard-page';
import { LookupsPage } from '@web/features/lookups/lookups-page';
import { DoctorsPage } from '@web/features/doctors/doctors-page';
import { InventorySection } from '@web/features/inventory/inventory-section';
import { ShoppingListPage } from '@web/features/inventory/shopping-list-page';
import { LabsSection } from '@web/features/labs/labs-section';
import { LabPage } from '@web/features/labs/lab-page';
import { PatientPage } from '@web/features/patients/patient-page';
import { PATIENT_FILE_ROLES } from '@web/features/patients/permissions';
import { PatientsPage } from '@web/features/patients/patients-page';
import { ProfilePage } from '@web/features/profile/profile-page';
import { UsersPage } from '@web/features/users/users-page';

const ADMIN_ONLY = [USER_ROLE.ADMIN] as const;

/**
 * The four sections of the sidebar, as route guards.
 *
 * These mirror `NAV_ITEMS` exactly, because a hidden entry that is still
 * reachable by typing its address is not hidden — it is merely hard to find,
 * which is the worst of both. The API remains the real boundary: these guards
 * decide what this application offers, not what a role is permitted, and a
 * request that slipped past them would still be refused.
 */
const PATIENTS = [USER_ROLE.ADMIN, USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST] as const;
const APPOINTMENTS = [USER_ROLE.ADMIN, USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST] as const;
const LABS = [USER_ROLE.ADMIN, USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN] as const;
const INVENTORY = [USER_ROLE.ADMIN, USER_ROLE.TECHNICIAN] as const;

/** The dashboard is where a role that may not be somewhere is sent instead. */
const HOME = '/dashboard';

/**
 * Routes mirror the sidebar, and every section carries the same role check —
 * so a hidden entry cannot be reached by typing its URL either. The API
 * remains the real boundary.
 */
export function AppRoutes(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

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
              <AppointmentsSection />
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
        <Route
          path="/clinic/lists"
          element={
            <RequireRole roles={ADMIN_ONLY} redirectTo={HOME}>
              <LookupsPage />
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
          path="/audit-log"
          element={
            <RequireRole roles={ADMIN_ONLY} redirectTo={HOME}>
              <AuditPage />
            </RequireRole>
          }
        />

        {/* ── The addresses this restructure retired ─────────────────── */}
        {/*
          Kept rather than dropped: these were bookmarked, pasted into chats
          and printed on nothing at all, but somebody's browser still knows
          them, and landing on a dashboard because a link rotted is a worse
          answer than landing where the page went. Each one carries its
          arrival straight to the tab or filter that replaced it.
        */}
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
