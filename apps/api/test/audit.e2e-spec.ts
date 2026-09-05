import { AUDIT_ACTION, USER_ROLE, type UserRole } from '@clinic/shared';

import { auth, createTestContext, type TestClinic, type TestContext } from '@test/helpers/test-app';

interface AuditEntry {
  action: string;
  entity: string;
  entityId: string;
  userId: string | null;
  clinicId: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
}

describe('Audit log (e2e)', () => {
  let context: TestContext;
  let clinic: TestClinic;
  let adminToken: string;
  const tokens = {} as Record<UserRole, string>;

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    for (const role of [
      USER_ROLE.ADMIN,
      USER_ROLE.DOCTOR,
      USER_ROLE.RECEPTIONIST,
      USER_ROLE.TECHNICIAN,
    ]) {
      tokens[role] = await context.login(clinic.phones[role]);
    }
    adminToken = tokens[USER_ROLE.ADMIN];
  });

  afterAll(async () => {
    await context.close();
  });

  const entriesFor = async (entityId: string): Promise<AuditEntry[]> => {
    const response = await context.app.inject({
      method: 'GET',
      url: `/audit-log?entityId=${entityId}&limit=100`,
      headers: auth(adminToken),
    });

    expect(response.statusCode).toBe(200);
    return response.json().items as AuditEntry[];
  };

  const createUser = async (name: string) => {
    const response = await context.app.inject({
      method: 'POST',
      url: '/users',
      headers: auth(adminToken),
      payload: {
        name,
        phone: `+9944${Math.floor(Math.random() * 1_000_000_000)}`,
        password: 'CreatedUser123!',
        role: USER_ROLE.RECEPTIONIST,
      },
    });

    expect(response.statusCode).toBe(201);
    return response.json() as { id: string; name: string; isActive: boolean };
  };

  it('records a create with no old value and the new row as the new value', async () => {
    const user = await createUser('Audit Created');

    const entries = await entriesFor(user.id);
    const created = entries.find((entry) => entry.action === AUDIT_ACTION.CREATE);

    expect(created).toBeDefined();
    expect(created?.entity).toBe('users');
    expect(created?.clinicId).toBe(clinic.id);
    expect(created?.userId).toBe(clinic.userIds[USER_ROLE.ADMIN]);
    expect(created?.oldValue).toBeNull();
    expect(created?.newValue).toMatchObject({ name: 'Audit Created', isActive: true });
  });

  it('records an update with the correct old and new values', async () => {
    const user = await createUser('Before Update');

    const updated = await context.app.inject({
      method: 'PATCH',
      url: `/users/${user.id}`,
      headers: auth(adminToken),
      payload: { name: 'After Update', isActive: false },
    });

    expect(updated.statusCode).toBe(200);

    const entries = await entriesFor(user.id);
    const update = entries.find((entry) => entry.action === AUDIT_ACTION.UPDATE);

    expect(update).toBeDefined();
    expect(update?.oldValue).toMatchObject({ name: 'Before Update', isActive: true });
    expect(update?.newValue).toMatchObject({ name: 'After Update', isActive: false });
  });

  it('records a soft delete with the previous row and a null new value', async () => {
    const user = await createUser('To Be Deleted');

    const deleted = await context.app.inject({
      method: 'DELETE',
      url: `/users/${user.id}`,
      headers: auth(adminToken),
    });

    expect(deleted.statusCode).toBe(204);

    const entries = await entriesFor(user.id);
    const remove = entries.find((entry) => entry.action === AUDIT_ACTION.DELETE);

    expect(remove).toBeDefined();
    expect(remove?.oldValue).toMatchObject({ name: 'To Be Deleted' });
    expect(remove?.newValue).toBeNull();
  });

  it('never stores a password hash in the trail', async () => {
    const user = await createUser('Secret Check');

    await context.app.inject({
      method: 'PATCH',
      url: `/users/${user.id}`,
      headers: auth(adminToken),
      payload: { name: 'Secret Check Renamed' },
    });

    const serialised = JSON.stringify(await entriesFor(user.id));

    expect(serialised).not.toContain('passwordHash');
    expect(serialised).not.toContain('password');
    expect(serialised).not.toContain('$argon2');
  });

  it("records clinic settings updates against the caller's own clinic", async () => {
    const response = await context.app.inject({
      method: 'PATCH',
      url: '/clinic',
      headers: auth(adminToken),
      payload: { name: 'Renamed Clinic' },
    });

    expect(response.statusCode).toBe(200);

    const entries = await entriesFor(clinic.id);
    const update = entries.find((entry) => entry.entity === 'clinics');

    expect(update).toBeDefined();
    expect(update?.oldValue).toMatchObject({ id: clinic.id });
    expect(update?.newValue).toMatchObject({ name: 'Renamed Clinic' });
  });

  it('filters by entity, action and user', async () => {
    const user = await createUser('Filter Target');

    const byAction = await context.app.inject({
      method: 'GET',
      url: `/audit-log?entity=users&action=${AUDIT_ACTION.CREATE}&entityId=${user.id}`,
      headers: auth(adminToken),
    });

    const items = byAction.json().items as AuditEntry[];

    expect(items).toHaveLength(1);
    expect(items[0]?.action).toBe(AUDIT_ACTION.CREATE);

    const byOtherUser = await context.app.inject({
      method: 'GET',
      url: `/audit-log?entityId=${user.id}&userId=${clinic.userIds[USER_ROLE.DOCTOR]}`,
      headers: auth(adminToken),
    });

    expect(byOtherUser.json().items).toHaveLength(0);
  });

  it('paginates', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: '/audit-log?page=1&limit=2',
      headers: auth(adminToken),
    });

    const body = response.json();

    expect(body.items.length).toBeLessThanOrEqual(2);
    expect(body).toMatchObject({ page: 1, limit: 2 });
    expect(typeof body.total).toBe('number');
  });

  describe('immutability', () => {
    // Checked as admin: admin passes every role check, so a 404 here proves the
    // route does not exist rather than that it was refused.
    it.each([
      ['POST', '/audit-log'],
      ['PATCH', '/audit-log'],
      ['PUT', '/audit-log'],
      ['DELETE', '/audit-log'],
    ])('exposes no %s %s', async (method, url) => {
      const response = await context.app.inject({
        method: method as 'POST',
        url,
        headers: auth(adminToken),
        payload: {},
      });

      expect(response.statusCode).toBe(404);
    });

    it.each([['PATCH'], ['PUT'], ['DELETE']])('exposes no %s /audit-log/:id', async (method) => {
      const entries = await context.app.inject({
        method: 'GET',
        url: '/audit-log?limit=1',
        headers: auth(adminToken),
      });
      const id = (entries.json().items as { id: string }[])[0]?.id;

      const response = await context.app.inject({
        method: method as 'PATCH',
        url: `/audit-log/${id ?? '00000000-0000-4000-8000-000000000000'}`,
        headers: auth(adminToken),
        payload: {},
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('access', () => {
    it.each([USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN])(
      'refuses %s',
      async (role) => {
        const response = await context.app.inject({
          method: 'GET',
          url: '/audit-log',
          headers: auth(tokens[role]),
        });

        expect(response.statusCode).toBe(403);
      },
    );
  });
});
