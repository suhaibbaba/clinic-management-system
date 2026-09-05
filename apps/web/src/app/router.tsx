import { USER_ROLE } from '@clinic/shared';
import type { JSX } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from '@web/components/layout/app-layout';
import { AuditPage } from '@web/features/audit/audit-page';
import { RequireAuth, RequireRole } from '@web/features/auth/guards';
import { LoginPage } from '@web/features/auth/login-page';
import { ClinicPage } from '@web/features/clinic/clinic-page';
import { DoctorsPage } from '@web/features/doctors/doctors-page';
import { PatientPage } from '@web/features/patients/patient-page';
import { PatientsPage } from '@web/features/patients/patients-page';
import { ProfilePage } from '@web/features/profile/profile-page';
import { UsersPage } from '@web/features/users/users-page';

const ADMIN_ONLY = [USER_ROLE.ADMIN] as const;

/**
 * The patient file shows procedures, chart marks and attachments, which
 * ROLES.md gives to admin and doctor. A technician's read is limited to
 * lab-linked rows, which this screen cannot express, and a receptionist has
 * none of it — both are turned away here as well as by the API.
 */
const CLINICAL = [USER_ROLE.ADMIN, USER_ROLE.DOCTOR] as const;

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
            <RequireRole roles={CLINICAL} redirectTo="/">
              <PatientPage />
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
