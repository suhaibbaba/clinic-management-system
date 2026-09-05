import { USER_ROLE } from '@clinic/shared';
import type { JSX } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from '@web/components/layout/app-layout';
import { AuditPage } from '@web/features/audit/audit-page';
import { RequireAuth, RequireRole } from '@web/features/auth/guards';
import { LoginPage } from '@web/features/auth/login-page';
import { ClinicPage } from '@web/features/clinic/clinic-page';
import { DoctorsPage } from '@web/features/doctors/doctors-page';
import { ProfilePage } from '@web/features/profile/profile-page';
import { UsersPage } from '@web/features/users/users-page';

const ADMIN_ONLY = [USER_ROLE.ADMIN] as const;

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
        <Route index element={<Navigate to="/doctors" replace />} />
        <Route path="/doctors" element={<DoctorsPage />} />
        <Route path="/clinic" element={<ClinicPage />} />
        <Route path="/profile" element={<ProfilePage />} />

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
