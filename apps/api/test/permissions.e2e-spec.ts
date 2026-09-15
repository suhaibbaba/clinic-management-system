import { ITEM_CATEGORY, ITEM_UNIT, USER_ROLE, type Permissions } from '@clinic/shared';

import { auth, createTestContext, type TestClinic, type TestContext } from '@test/helpers/test-app';

/** A capability the receptionist does not ship with, reached by one GET. */
const AUDIT = { capability: 'audit.list', url: '/audit-log' };

describe('Permissions (e2e)', () => {
  let context: TestContext;
  let clinic: TestClinic;
  let otherClinic: TestClinic;
  let adminToken: string;
  let receptionToken: string;
  let otherReceptionToken: string;

  const grant = (role: string, capability: string, allowed: boolean, token = adminToken) =>
    context.app.inject({
      method: 'PATCH',
      url: '/permissions',
      headers: auth(token),
      payload: { role, capability, allowed },
    });

  const reachesAuditLog = async (token: string): Promise<number> => {
    const response = await context.app.inject({
      method: 'GET',
      url: AUDIT.url,
      headers: auth(token),
    });

    return response.statusCode;
  };

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();
    otherClinic = await context.createClinic();
    adminToken = await context.login(clinic.phones[USER_ROLE.ADMIN]);
    receptionToken = await context.login(clinic.phones[USER_ROLE.RECEPTIONIST]);
    otherReceptionToken = await context.login(otherClinic.phones[USER_ROLE.RECEPTIONIST]);
  });

  afterAll(async () => {
    await context.close();
  });

  it('lists every capability the route table declares, and an answer per role', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: '/permissions',
      headers: auth(adminToken),
    });
    const body = response.json<Permissions>();
    const roles = Object.fromEntries(body.roles.map((entry) => [entry.role, entry]));

    expect(response.statusCode).toBe(200);
    expect(body.capabilities.length).toBeGreaterThan(100);
    expect(body.capabilities.map((entry) => entry.key)).toContain(AUDIT.capability);
    // Every capability is answered for every role — a switch with nothing behind it would draw
    // itself off.
    for (const entry of body.roles) {
      expect(Object.keys(entry.allows)).toHaveLength(body.capabilities.length);
    }

    expect(roles[USER_ROLE.ADMIN]?.locked).toBe(true);
    expect(Object.values(roles[USER_ROLE.ADMIN]?.allows ?? {}).every(Boolean)).toBe(true);
    expect(roles[USER_ROLE.RECEPTIONIST]?.locked).toBe(false);
    expect(roles[USER_ROLE.RECEPTIONIST]?.allows[AUDIT.capability]).toBe(false);
  });

  it('refuses a receptionist both the list and the switch', async () => {
    const list = await context.app.inject({
      method: 'GET',
      url: '/permissions',
      headers: auth(receptionToken),
    });

    expect(list.statusCode).toBe(403);
    expect((await grant(USER_ROLE.DOCTOR, AUDIT.capability, true, receptionToken)).statusCode).toBe(
      403,
    );
  });

  it('a granted capability is reachable, and reachable no longer once it is taken back', async () => {
    expect(await reachesAuditLog(receptionToken)).toBe(403);

    expect((await grant(USER_ROLE.RECEPTIONIST, AUDIT.capability, true)).statusCode).toBe(204);
    expect(await reachesAuditLog(receptionToken)).toBe(200);

    expect((await grant(USER_ROLE.RECEPTIONIST, AUDIT.capability, false)).statusCode).toBe(204);
    expect(await reachesAuditLog(receptionToken)).toBe(403);
  });

  it('a capability the role ships with can be taken away', async () => {
    const before = await context.app.inject({
      method: 'GET',
      url: '/patients',
      headers: auth(receptionToken),
    });

    expect(before.statusCode).toBe(200);

    expect((await grant(USER_ROLE.RECEPTIONIST, 'patients.create', false)).statusCode).toBe(204);

    const create = await context.app.inject({
      method: 'POST',
      url: '/patients',
      headers: auth(receptionToken),
      payload: { name: 'مريض جديد', phone: '+970599111222' },
    });

    expect(create.statusCode).toBe(403);
    await grant(USER_ROLE.RECEPTIONIST, 'patients.create', true);
  });

  it('a grant belongs to the clinic that made it', async () => {
    expect((await grant(USER_ROLE.RECEPTIONIST, AUDIT.capability, true)).statusCode).toBe(204);

    expect(await reachesAuditLog(receptionToken)).toBe(200);
    expect(await reachesAuditLog(otherReceptionToken)).toBe(403);

    await grant(USER_ROLE.RECEPTIONIST, AUDIT.capability, false);
  });

  it('the session carries what the reader may do, so a screen can hide what they cannot', async () => {
    const before = await context.app.inject({
      method: 'GET',
      url: '/me',
      headers: auth(receptionToken),
    });

    expect(before.json<{ capabilities: string[] }>().capabilities).not.toContain(AUDIT.capability);
    expect(before.json<{ capabilities: string[] }>().capabilities).toContain('patients.create');

    await grant(USER_ROLE.RECEPTIONIST, AUDIT.capability, true);

    const after = await context.app.inject({
      method: 'GET',
      url: '/me',
      headers: auth(receptionToken),
    });

    expect(after.json<{ capabilities: string[] }>().capabilities).toContain(AUDIT.capability);
    await grant(USER_ROLE.RECEPTIONIST, AUDIT.capability, false);
  });

  it('a grant is the whole answer — no service keeps a second role table behind the guard', async () => {
    // Three stock movements are three endpoints with three permissions; the module used to check
    // the role again on the way past, which made a granted switch do nothing at all.
    const item = await context.app.inject({
      method: 'POST',
      url: '/inventory/items',
      headers: auth(adminToken),
      payload: {
        nameAr: 'قفازات',
        category: ITEM_CATEGORY.CONSUMABLE,
        unit: ITEM_UNIT.PIECE,
      },
    });
    const itemId = item.json<{ id: string }>().id;
    const purchase = () =>
      context.app.inject({
        method: 'POST',
        url: '/inventory/movements/purchase',
        headers: auth(receptionToken),
        payload: { itemId, quantity: '1', unitCost: '10' },
      });

    expect(item.statusCode).toBe(201);
    expect((await purchase()).statusCode).toBe(403);

    await grant(USER_ROLE.RECEPTIONIST, 'inventory.purchase', true);
    expect((await purchase()).statusCode).toBe(201);

    await grant(USER_ROLE.RECEPTIONIST, 'inventory.purchase', false);
    expect((await purchase()).statusCode).toBe(403);
  });

  it('the administrator cannot be edited, and an unknown permission is not stored', async () => {
    const admin = await grant(USER_ROLE.ADMIN, AUDIT.capability, false);
    const nonsense = await grant(USER_ROLE.DOCTOR, 'made.up', true);

    expect(admin.statusCode).toBe(400);
    expect(nonsense.statusCode).toBe(400);
    // The switch the admin was denied changed nothing: they still hold it.
    expect(await reachesAuditLog(adminToken)).toBe(200);
  });
});
