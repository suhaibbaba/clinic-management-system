import { USER_ROLE } from '@clinic/shared';
import type { JSX } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from '@web/components/layout/app-layout';
import { AuditPage } from '@web/features/audit/audit-page';
import { RequireAuth, RequireRole } from '@web/features/auth/guards';
import { LoginPage } from '@web/features/auth/login-page';
import { OverduePage } from '@web/features/billing/overdue-page';
import { ClinicPage } from '@web/features/clinic/clinic-page';
import { DoctorsPage } from '@web/features/doctors/doctors-page';
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
          path="/billing/overdue"
          element={
            <RequireRole roles={BILLING} redirectTo="/">
              <OverduePage />
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
