import {
  APPOINTMENT_TYPE,
  ATTACHMENT_TYPE,
  ITEM_CATEGORY,
  ITEM_UNIT,
  LOOKUP_LIST,
  PAYMENT_METHOD,
  SYSTEM_LOOKUPS,
  TOOTH_STATE,
  USER_ROLE,
  type LookupBundle,
  type LookupOption,
  type UserRole,
} from '@clinic/shared';

import { auth, createTestContext, type TestClinic, type TestContext } from '@test/helpers/test-app';
import { ensureSystemLookups } from '@api/database/system-lookups';

describe('Lookups (e2e)', () => {
  let context: TestContext;
  let clinic: TestClinic;
  const tokens = {} as Record<UserRole, string>;

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    for (const role of Object.values(USER_ROLE)) {
      tokens[role] = await context.login(clinic.phones[role]);
    }
  });

  afterAll(async () => {
    await context.close();
  });

  const list = async (
    listKey: string,
    token = tokens[USER_ROLE.ADMIN],
  ): Promise<LookupOption[]> => {
    const response = await context.app.inject({
      method: 'GET',
      url: `/lookups?listKey=${listKey}`,
      headers: auth(token),
    });

    expect(response.statusCode).toBe(200);

    return (response.json() as LookupBundle)[listKey] ?? [];
  };

  describe('the built-in rows', () => {
    // The migration's promise: the values the enum columns held are the codes of the rows that
    // replaced them.
    it('seeds every list a new clinic needs, keyed by the old enum values', async () => {
      const response = await context.app.inject({
        method: 'GET',
        url: '/lookups',
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });

      expect(response.statusCode).toBe(200);
      const bundle = response.json() as LookupBundle;

      for (const [listKey, rows] of Object.entries(SYSTEM_LOOKUPS)) {
        const codes = (bundle[listKey] ?? []).map((option) => option.code);
        expect(codes).toEqual(expect.arrayContaining(rows.map((row) => row.code)));
      }
    });

    // The exact values the columns held as Postgres enums — a code missing here is data that has
    // quietly stopped resolving to a name.
    it.each([
      [LOOKUP_LIST.TOOTH_STATE, Object.values(TOOTH_STATE)],
      [LOOKUP_LIST.APPOINTMENT_TYPE, Object.values(APPOINTMENT_TYPE)],
      [LOOKUP_LIST.PAYMENT_METHOD, Object.values(PAYMENT_METHOD)],
      [LOOKUP_LIST.ATTACHMENT_TYPE, Object.values(ATTACHMENT_TYPE)],
      [LOOKUP_LIST.ITEM_CATEGORY, Object.values(ITEM_CATEGORY)],
      [LOOKUP_LIST.ITEM_UNIT, Object.values(ITEM_UNIT)],
    ])('keeps every value the %s enum held, as a code', async (listKey, values) => {
      const codes = (await list(listKey)).map((option) => option.code);

      expect(codes).toEqual(expect.arrayContaining([...values]));
      // And each one resolves to something a person can read, in both languages.
      for (const option of await list(listKey)) {
        expect(option.nameAr).not.toBe('');
        expect(option.nameEn).not.toBe('');
      }
    });

    it('carries the chart behaviour the tooth chart draws from', async () => {
      const missing = (await list(LOOKUP_LIST.TOOTH_STATE)).find(
        (option) => option.code === 'missing',
      );

      expect(missing?.isSystem).toBe(true);
      expect(missing?.meta).toMatchObject({ chartBehavior: { shape: 'missing' } });
    });

    /** A built-in row is marked so the screen can warn, but nothing here refuses. */
    it('lets the clinic switch one off, and stops offering it', async () => {
      const [card] = (await list(LOOKUP_LIST.PAYMENT_METHOD)).filter(
        (option) => option.code === 'card',
      );

      const response = await context.app.inject({
        method: 'PATCH',
        url: `/lookups/${card?.id}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { isActive: false },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ code: 'card', isSystem: true, isActive: false });
      expect((await list(LOOKUP_LIST.PAYMENT_METHOD)).map((option) => option.code)).not.toContain(
        'card',
      );

      // Reversible, and this is the half of the pair that keeps the name: a
      // receipt written while it was off still reads "بطاقة".
      const back = await context.app.inject({
        method: 'PATCH',
        url: `/lookups/${card?.id}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { isActive: true },
      });

      expect(back.statusCode).toBe(200);
    });

    // In a clinic of its own: this one is destructive, and a shared fixture would make the tests
    // above depend on run order.
    it('lets the clinic delete one, and stops accepting the code', async () => {
      const own = await context.createClinic();
      const admin = await context.login(own.phones[USER_ROLE.ADMIN]);
      const [transfer] = (await list(LOOKUP_LIST.PAYMENT_METHOD, admin)).filter(
        (option) => option.code === 'transfer',
      );

      const response = await context.app.inject({
        method: 'DELETE',
        url: `/lookups/${transfer?.id}`,
        headers: auth(admin),
      });

      expect(response.statusCode).toBe(204);
      expect(
        (await list(LOOKUP_LIST.PAYMENT_METHOD, admin)).map((option) => option.code),
      ).not.toContain('transfer');

      // And this clinic only: one tenant emptying a list cannot empty another's.
      expect((await list(LOOKUP_LIST.PAYMENT_METHOD)).map((option) => option.code)).toContain(
        'transfer',
      );
    });

    // `ensureSystemLookups` upserts on every migration and every new clinic, so if it touched
    // anything but the system flag a clinic's deletions would come back on the next deploy.
    it('does not resurrect a retired built-in row on the next deploy', async () => {
      const own = await context.createClinic();
      const admin = await context.login(own.phones[USER_ROLE.ADMIN]);
      const rows = await list(LOOKUP_LIST.ITEM_UNIT, admin);
      const [removed] = rows.filter((option) => option.code === 'ampoule');
      const [switchedOff] = rows.filter((option) => option.code === 'ml');

      await context.app.inject({
        method: 'DELETE',
        url: `/lookups/${removed?.id}`,
        headers: auth(admin),
      });
      await context.app.inject({
        method: 'PATCH',
        url: `/lookups/${switchedOff?.id}`,
        headers: auth(admin),
        payload: { isActive: false },
      });

      // What a deploy does.
      await ensureSystemLookups(context.db, own.id);

      const after = await list(LOOKUP_LIST.ITEM_UNIT, admin);
      expect(after.map((option) => option.code)).not.toContain('ampoule');
      expect(after.map((option) => option.code)).not.toContain('ml');
    });

    /* The name is what people read; the code is what the application reads. */
    it('lets the clinic rename one', async () => {
      const [cash] = (await list(LOOKUP_LIST.PAYMENT_METHOD)).filter(
        (option) => option.code === 'cash',
      );

      const response = await context.app.inject({
        method: 'PATCH',
        url: `/lookups/${cash?.id}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { nameAr: 'خالص', nameEn: 'Settled' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ code: 'cash', nameAr: 'خالص' });
    });
  });

  describe('a clinic list of its own', () => {
    let createdId: string;

    it('derives a code from the English name', async () => {
      const response = await context.app.inject({
        method: 'POST',
        url: '/lookups',
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: {
          listKey: LOOKUP_LIST.TOOTH_STATE,
          nameAr: 'وجه تجميلي',
          nameEn: 'Veneer',
          color: '#c084fc',
        },
      });

      expect(response.statusCode).toBe(201);
      const option = response.json() as LookupOption;
      expect(option).toMatchObject({ code: 'veneer', isSystem: false, isActive: true });
      createdId = option.id;
    });

    it('refuses a second option with the same code', async () => {
      const response = await context.app.inject({
        method: 'POST',
        url: '/lookups',
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { listKey: LOOKUP_LIST.TOOTH_STATE, nameAr: 'آخر', nameEn: 'Veneer' },
      });

      expect(response.statusCode).toBe(409);
    });

    it('accepts the new code where the enum used to be the only answer', async () => {
      const response = await context.app.inject({
        method: 'POST',
        url: '/procedure-catalog',
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: {
          specialtyId: clinic.specialtyId,
          code: 'VNR-1',
          nameAr: 'وجه تجميلي',
          nameEn: 'Veneer',
          defaultPrice: '150.00',
          chartOutcome: 'veneer',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ chartOutcome: 'veneer' });
    });

    it('refuses a code that is on no list', async () => {
      const response = await context.app.inject({
        method: 'POST',
        url: '/procedure-catalog',
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: {
          specialtyId: clinic.specialtyId,
          code: 'VNR-2',
          nameAr: 'غير معروف',
          nameEn: 'Unknown',
          defaultPrice: '150.00',
          chartOutcome: 'sparkles',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('reorders a whole list at once', async () => {
      const before = await list(LOOKUP_LIST.TOOTH_STATE);
      const ids = [...before].reverse().map((option) => option.id);

      const response = await context.app.inject({
        method: 'PATCH',
        url: '/lookups/reorder',
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { listKey: LOOKUP_LIST.TOOTH_STATE, ids },
      });

      expect(response.statusCode).toBe(200);
      expect((await list(LOOKUP_LIST.TOOTH_STATE)).map((option) => option.id)).toEqual(ids);
    });

    it('soft-deletes one the clinic added, and stops offering it', async () => {
      const response = await context.app.inject({
        method: 'DELETE',
        url: `/lookups/${createdId}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });

      expect(response.statusCode).toBe(204);
      expect((await list(LOOKUP_LIST.TOOTH_STATE)).map((option) => option.code)).not.toContain(
        'veneer',
      );
    });
  });

  describe("permissions (ROLES.md: clinic settings are the admin's)", () => {
    it('lets every signed-in role read the lists', async () => {
      for (const role of [USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN]) {
        expect((await list(LOOKUP_LIST.APPOINTMENT_TYPE, tokens[role])).length).toBeGreaterThan(0);
      }
    });

    it.each([USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN])(
      'refuses %s a new option',
      async (role) => {
        const response = await context.app.inject({
          method: 'POST',
          url: '/lookups',
          headers: auth(tokens[role]),
          payload: { listKey: LOOKUP_LIST.APPOINTMENT_TYPE, nameAr: 'استشارة', nameEn: 'Consult' },
        });

        expect(response.statusCode).toBe(403);
      },
    );

    it('does not reach another clinic (a cross-clinic id is 404)', async () => {
      const other = await context.createClinic();
      const otherAdmin = await context.login(other.phones[USER_ROLE.ADMIN]);
      const [mine] = await list(LOOKUP_LIST.APPOINTMENT_TYPE);

      const response = await context.app.inject({
        method: 'PATCH',
        url: `/lookups/${mine?.id}`,
        headers: auth(otherAdmin),
        payload: { nameAr: 'مسروق' },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
