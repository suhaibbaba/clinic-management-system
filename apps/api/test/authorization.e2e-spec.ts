import { USER_ROLE, USER_ROLES, type UserRole } from '@clinic/shared';

import { auth, createTestContext, type TestClinic, type TestContext } from '@test/helpers/test-app';

/** Every endpoint ROLES.md restricts to admin, with the verb it is reached by. */
const ADMIN_ONLY_ROUTES = [
  { method: 'GET' as const, url: '/users' },
  { method: 'POST' as const, url: '/users' },
  { method: 'GET' as const, url: '/audit-log' },
  { method: 'PATCH' as const, url: '/clinic' },
  { method: 'POST' as const, url: '/doctors' },
];

const NON_ADMIN_ROLES: UserRole[] = USER_ROLES.filter((role) => role !== USER_ROLE.ADMIN);

describe('Authorization (e2e)', () => {
  let context: TestContext;
  let clinic: TestClinic;
  let otherClinic: TestClinic;
  const tokens = {} as Record<UserRole, string>;

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();
    otherClinic = await context.createClinic();

    for (const role of USER_ROLES) {
      tokens[role] = await context.login(clinic.phones[role]);
    }
  });

  afterAll(async () => {
    await context.close();
  });

  describe('RolesGuard', () => {
    it.each(NON_ADMIN_ROLES)('refuses %s on every admin-only route', async (role) => {
      for (const route of ADMIN_ONLY_ROUTES) {
        const response = await context.app.inject({
          method: route.method,
          url: route.url,
          headers: auth(tokens[role]),
          ...(route.method === 'GET' ? {} : { payload: {} }),
        });

        expect({ role, ...route, status: response.statusCode }).toEqual({
          role,
          ...route,
          status: 403,
        });
      }
    });

    it('admin passes every one of them', async () => {
      const listUsers = await context.app.inject({
        method: 'GET',
        url: '/users',
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });
      const auditLog = await context.app.inject({
        method: 'GET',
        url: '/audit-log',
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });

      expect(listUsers.statusCode).toBe(200);
      expect(auditLog.statusCode).toBe(200);
    });

    it.each(USER_ROLES)('lets %s read doctors and clinic settings', async (role) => {
      const doctors = await context.app.inject({
        method: 'GET',
        url: '/doctors',
        headers: auth(tokens[role]),
      });
      const clinicSettings = await context.app.inject({
        method: 'GET',
        url: '/clinic',
        headers: auth(tokens[role]),
      });

      expect(doctors.statusCode).toBe(200);
      expect(clinicSettings.statusCode).toBe(200);
    });

    it.each(USER_ROLES)('lets %s read their own profile', async (role) => {
      const response = await context.app.inject({
        method: 'GET',
        url: '/me',
        headers: auth(tokens[role]),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ role, clinicId: clinic.id });
    });
  });

  describe('clinic scoping', () => {
    it("reports another clinic's user id as 404, not 403", async () => {
      const foreignUserId = otherClinic.userIds[USER_ROLE.RECEPTIONIST];

      const response = await context.app.inject({
        method: 'GET',
        url: `/users/${foreignUserId}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });

      expect(response.statusCode).toBe(404);
    });

    it('refuses to update a user in another clinic and leaves it untouched', async () => {
      const foreignUserId = otherClinic.userIds[USER_ROLE.DOCTOR];

      const response = await context.app.inject({
        method: 'PATCH',
        url: `/users/${foreignUserId}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { name: 'Hijacked' },
      });

      expect(response.statusCode).toBe(404);

      const foreignAdminToken = await context.login(otherClinic.phones[USER_ROLE.ADMIN]);
      const stillIntact = await context.app.inject({
        method: 'GET',
        url: `/users/${foreignUserId}`,
        headers: auth(foreignAdminToken),
      });

      expect(stillIntact.json().name).not.toBe('Hijacked');
    });

    it('refuses to soft-delete a user in another clinic', async () => {
      const foreignUserId = otherClinic.userIds[USER_ROLE.TECHNICIAN];

      const response = await context.app.inject({
        method: 'DELETE',
        url: `/users/${foreignUserId}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });

      expect(response.statusCode).toBe(404);
    });

    it("never lists another clinic's users", async () => {
      const response = await context.app.inject({
        method: 'GET',
        url: '/users?limit=100',
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });

      const ids = (response.json().items as { id: string; clinicId: string }[]).map((u) => u.id);

      expect(ids).not.toContain(otherClinic.userIds[USER_ROLE.ADMIN]);
      expect(
        (response.json().items as { clinicId: string }[]).every((u) => u.clinicId === clinic.id),
      ).toBe(true);
    });

    it("returns only the caller's own clinic from /clinic", async () => {
      const response = await context.app.inject({
        method: 'GET',
        url: '/clinic',
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });

      expect(response.json().id).toBe(clinic.id);
    });

    it('ignores a clinicId supplied in a request body', async () => {
      const response = await context.app.inject({
        method: 'POST',
        url: '/users',
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: {
          name: 'Injected Clinic',
          phone: `+9955${Date.now().toString().slice(-8)}`,
          password: 'InjectedPass123!',
          role: USER_ROLE.RECEPTIONIST,
          // Not part of the schema, and never read from the body regardless.
          clinicId: otherClinic.id,
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().clinicId).toBe(clinic.id);
    });
  });

  describe('doctor schedule ownership', () => {
    it("lets a doctor update their own schedule but not another doctor's", async () => {
      const created = await context.app.inject({
        method: 'POST',
        url: '/doctors',
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: {
          userId: clinic.userIds[USER_ROLE.DOCTOR],
          specialtyId: clinic.specialtyId,
        },
      });

      expect(created.statusCode).toBe(201);
      const doctorId = created.json().id;

      const own = await context.app.inject({
        method: 'PATCH',
        url: `/doctors/${doctorId}/schedule`,
        headers: auth(tokens[USER_ROLE.DOCTOR]),
        payload: { weeklySchedule: [{ weekday: 1, ranges: [{ start: '09:00', end: '12:00' }] }] },
      });

      expect(own.statusCode).toBe(200);
      expect(own.json().weeklySchedule).toEqual([
        { weekday: 1, ranges: [{ start: '09:00', end: '12:00' }] },
      ]);

      // A different doctor account in the same clinic must not reach this row.
      const otherDoctorToken = await context.login(otherClinic.phones[USER_ROLE.DOCTOR]);
      const foreign = await context.app.inject({
        method: 'PATCH',
        url: `/doctors/${doctorId}/schedule`,
        headers: auth(otherDoctorToken),
        payload: { weeklySchedule: [] },
      });

      expect(foreign.statusCode).toBe(404);
    });

    it('refuses a receptionist changing any schedule', async () => {
      const response = await context.app.inject({
        method: 'PATCH',
        url: `/doctors/${otherClinic.userIds[USER_ROLE.DOCTOR]}/schedule`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
        payload: { weeklySchedule: [] },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
