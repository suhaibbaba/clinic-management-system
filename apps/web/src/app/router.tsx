import { USER_ROLE } from '@clinic/shared';
import type { JSX } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from '@web/components/layout/app-layout';
import { AppointmentsPage } from '@web/features/appointments/appointments-page';
import { AuditPage } from '@web/features/audit/audit-page';
import { RequireAuth, RequireRole } from '@web/features/auth/guards';
import { LoginPage } from '@web/features/auth/login-page';
import { OverduePage } from '@web/features/billing/overdue-page';
import { PendingBookingsPage } from '@web/features/booking/pending-bookings-page';
import { ClinicPage } from '@web/features/clinic/clinic-page';
import { LookupsPage } from '@web/features/lookups/lookups-page';
import { DoctorsPage } from '@web/features/doctors/doctors-page';
import { InventoryPage } from '@web/features/inventory/inventory-page';
import { ShoppingListPage } from '@web/features/inventory/shopping-list-page';
import { SuppliersPage } from '@web/features/inventory/suppliers-page';
import { LabOrdersPage } from '@web/features/labs/lab-orders-page';
import { LabPage } from '@web/features/labs/lab-page';
import { LabsPage } from '@web/features/labs/labs-page';
import { PatientPage } from '@web/features/patients/patient-page';
import { PatientsPage } from '@web/features/patients/patients-page';
import { ProfilePage } from '@web/features/profile/profile-page';
import { UsersPage } from '@web/features/users/users-page';

const ADMIN_ONLY = [USER_ROLE.ADMIN] as const;

/**
 * The patient file.
 *
 * Its clinical tabs are admin and doctor only, but a receptionist opens the
 * same file for the account tab — taking payments is their job (ROLES.md
 * billing matrix) — and the page shows them nothing else. A technician has no
 * reason to be here at all: no clinical detail they may read, and never any
 * financial data.
 */
const PATIENT_FILE = [USER_ROLE.ADMIN, USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST] as const;

/** Overdue balances: admin and receptionist (ROLES.md billing matrix). */
const BILLING = [USER_ROLE.ADMIN, USER_ROLE.RECEPTIONIST] as const;

/**
 * The labs module.
 *
 * A receptionist appears in no row of the ROLES.md labs matrix, so they have
 * neither a nav entry nor a route — typing the URL lands them back on their
 * own start page. The API refuses them either way.
 */
const LABS = [USER_ROLE.ADMIN, USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN] as const;

/**
 * The inventory module.
 *
 * The same three roles, for the same reason: a receptionist appears in no row
 * of the ROLES.md inventory matrix. The technician is the primary persona here
 * — it is their cupboard — and a doctor reads it and records what they used.
 */
const INVENTORY = [USER_ROLE.ADMIN, USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN] as const;

/** Answering online bookings is front-desk work, and the API says so too. */
const FRONT_DESK = [USER_ROLE.ADMIN, USER_ROLE.RECEPTIONIST] as const;

/**
 * Routes mirror the sidebar, and admin-only pages carry the same role check —
 * so a hidden entry cannot be reached by typing its URL either. The API remains
 * the real boundary.
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
        <Route index element={<Navigate to="/patients" replace />} />
        {/* Every role may look a patient up; the columns differ by role. */}
        <Route path="/patients" element={<PatientsPage />} />
        {/* Reading the calendar is open to every role. */}
        <Route path="/appointments" element={<AppointmentsPage />} />
        <Route path="/doctors" element={<DoctorsPage />} />
        <Route path="/clinic" element={<ClinicPage />} />
        <Route path="/profile" element={<ProfilePage />} />

        <Route
          path="/patients/:id"
          element={
            <RequireRole roles={PATIENT_FILE} redirectTo="/">
              <PatientPage />
            </RequireRole>
          }
        />

        <Route
          path="/appointments/pending"
          element={
            <RequireRole roles={FRONT_DESK} redirectTo="/">
              <PendingBookingsPage />
            </RequireRole>
          }
        />

        <Route
          path="/labs"
          element={
            <RequireRole roles={LABS} redirectTo="/">
              <LabsPage />
            </RequireRole>
          }
        />

        <Route
          path="/labs/:id"
          element={
            <RequireRole roles={LABS} redirectTo="/">
              <LabPage />
            </RequireRole>
          }
        />

        <Route
          path="/lab-orders"
          element={
            <RequireRole roles={LABS} redirectTo="/">
              <LabOrdersPage />
            </RequireRole>
          }
        />

        <Route
          path="/inventory"
          element={
            <RequireRole roles={INVENTORY} redirectTo="/">
              <InventoryPage />
            </RequireRole>
          }
        />

        <Route
          path="/inventory/shopping-list"
          element={
            <RequireRole roles={INVENTORY} redirectTo="/">
              <ShoppingListPage />
            </RequireRole>
          }
        />

        <Route
          path="/suppliers"
          element={
            <RequireRole roles={INVENTORY} redirectTo="/">
              <SuppliersPage />
            </RequireRole>
          }
        />

        <Route
          path="/billing/overdue"
          element={
            <RequireRole roles={BILLING} redirectTo="/">
              <OverduePage />
            </RequireRole>
          }
        />

        <Route
          path="/clinic/lists"
          element={
            <RequireRole roles={ADMIN_ONLY}>
              <LookupsPage />
            </RequireRole>
          }
        />
        <Route
          path="/users"
          element={
            <RequireRole roles={ADMIN_ONLY}>
              <UsersPage />
            </RequireRole>
          }
        />
        <Route
          path="/audit-log"
          element={
            <RequireRole roles={ADMIN_ONLY}>
              <AuditPage />
            </RequireRole>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
