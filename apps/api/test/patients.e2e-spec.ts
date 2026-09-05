import { USER_ROLE, type UserRole } from '@clinic/shared';

import { createPatient, uniquePhone } from '@test/helpers/patient-fixtures';
import { auth, createTestContext, type TestClinic, type TestContext } from '@test/helpers/test-app';

describe('Patients (e2e)', () => {
  let context: TestContext;
  let clinic: TestClinic;
  const tokens = {} as Record<UserRole, string>;

  const names = {
    ahmad: 'أحمد خالد الحسن',
    layla: 'ليلى محمود العلي',
    omar: 'عمر سامي الخطيب',
  };

  let ahmadId: string;
  let ahmadFileNumber: string;
  let laylaPhone: string;

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

    ahmadId = await createPatient(context, tokens[USER_ROLE.RECEPTIONIST], {
      fullName: names.ahmad,
      phone: uniquePhone(),
      dateOfBirth: '1988-03-14',
      gender: 'male',
      address: 'المزة، دمشق',
    });

    laylaPhone = uniquePhone();
    await createPatient(context, tokens[USER_ROLE.RECEPTIONIST], {
      fullName: names.layla,
      phone: laylaPhone,
    });
    await createPatient(context, tokens[USER_ROLE.DOCTOR], {
      fullName: names.omar,
      phone: uniquePhone(),
    });

    const created = await context.app.inject({
      method: 'GET',
      url: `/patients/${ahmadId}`,
      headers: auth(tokens[USER_ROLE.ADMIN]),
    });
    ahmadFileNumber = (created.json() as { fileNumber: string }).fileNumber;
  });

  afterAll(async () => {
    await context.close();
  });

  const search = async (term: string, role: UserRole = USER_ROLE.ADMIN) => {
    const response = await context.app.inject({
      method: 'GET',
      url: `/patients?search=${encodeURIComponent(term)}`,
      headers: auth(tokens[role]),
    });

    expect(response.statusCode).toBe(200);
    return response.json() as { items: { id: string; fullName: string }[]; total: number };
  };

  describe('file numbers', () => {
    it('generates a sequential, zero-padded file number per clinic', async () => {
      expect(ahmadFileNumber).toMatch(/^\d{5}$/);

      const otherClinic = await context.createClinic();
      const otherToken = await context.login(otherClinic.phones[USER_ROLE.ADMIN]);
      const otherId = await createPatient(context, otherToken, {
        fullName: 'مريض عيادة أخرى',
        phone: uniquePhone(),
      });

      const other = await context.app.inject({
        method: 'GET',
        url: `/patients/${otherId}`,
        headers: auth(otherToken),
      });

      // Numbering restarts per clinic: the first patient of a fresh clinic is 1.
      expect((other.json() as { fileNumber: string }).fileNumber).toBe('00001');
    });

    it('never accepts a file number from the client', async () => {
      const id = await createPatient(context, tokens[USER_ROLE.ADMIN], {
        fullName: 'مريض بدون رقم ملف',
        phone: uniquePhone(),
        fileNumber: '99999',
      });

      const response = await context.app.inject({
        method: 'GET',
        url: `/patients/${id}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });

      expect((response.json() as { fileNumber: string }).fileNumber).not.toBe('99999');
    });
  });

  describe('search', () => {
    it('finds a patient by a fragment of the Arabic name', async () => {
      const result = await search('خالد');

      expect(result.items.map((item) => item.id)).toContain(ahmadId);
      expect(result.items.map((item) => item.fullName)).not.toContain(names.layla);
    });

    it('finds a patient by phone', async () => {
      const result = await search(laylaPhone.slice(-6));

      expect(result.items.map((item) => item.fullName)).toContain(names.layla);
    });

    it('finds a patient by file number', async () => {
      const result = await search(ahmadFileNumber);

      expect(result.items.map((item) => item.id)).toContain(ahmadId);
    });

    it('returns an empty page rather than everything for an unmatched term', async () => {
      const result = await search('لا-يوجد-هذا-الاسم');

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('never reaches another clinic, even by exact id', async () => {
      const otherClinic = await context.createClinic();
      const otherToken = await context.login(otherClinic.phones[USER_ROLE.ADMIN]);

      const response = await context.app.inject({
        method: 'GET',
        url: `/patients/${ahmadId}`,
        headers: auth(otherToken),
      });

      // 404, not 403: a 403 would confirm the id exists somewhere.
      expect(response.statusCode).toBe(404);
    });
  });

  describe('role views (ROLES.md field-level security)', () => {
    it('gives admin and doctor the full clinical view', async () => {
      for (const role of [USER_ROLE.ADMIN, USER_ROLE.DOCTOR]) {
        const response = await context.app.inject({
          method: 'GET',
          url: `/patients/${ahmadId}`,
          headers: auth(tokens[role]),
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ address: 'المزة، دمشق', gender: 'male' });
      }
    });

    it('strips the clinical fields for a receptionist and a technician', async () => {
      const publicFields = ['dateOfBirth', 'fileNumber', 'fullName', 'id', 'phone'];

      for (const role of [USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN]) {
        const response = await context.app.inject({
          method: 'GET',
          url: `/patients/${ahmadId}`,
          headers: auth(tokens[role]),
        });

        expect(response.statusCode).toBe(200);

        const body = response.json() as Record<string, unknown>;

        // The receptionist also gets the computed balance; the technician does
        // not, because ROLES.md keeps financial data out of their responses.
        expect(Object.keys(body).sort()).toEqual(
          (role === USER_ROLE.RECEPTIONIST ? [...publicFields, 'balance'] : publicFields).sort(),
        );
        expect(body).not.toHaveProperty('address');
        expect(body).not.toHaveProperty('notes');
      }
    });

    it('strips them in the list response too', async () => {
      const result = await search('خالد', USER_ROLE.RECEPTIONIST);

      for (const item of result.items) {
        expect(item).not.toHaveProperty('address');
      }
    });
  });

  describe('write permissions (ROLES.md patients matrix)', () => {
    it('lets a receptionist create and update basic info', async () => {
      const response = await context.app.inject({
        method: 'PATCH',
        url: `/patients/${ahmadId}`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
        payload: { phone: uniquePhone() },
      });

      expect(response.statusCode).toBe(200);
    });

    it('refuses a technician write — the matrix gives them read only', async () => {
      const response = await context.app.inject({
        method: 'POST',
        url: '/patients',
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
        payload: { fullName: 'محاولة من الفني', phone: uniquePhone() },
      });

      expect(response.statusCode).toBe(403);
    });

    it('refuses a non-admin delete and soft-deletes for admin', async () => {
      const id = await createPatient(context, tokens[USER_ROLE.ADMIN], {
        fullName: 'مريض للحذف',
        phone: uniquePhone(),
      });

      const asDoctor = await context.app.inject({
        method: 'DELETE',
        url: `/patients/${id}`,
        headers: auth(tokens[USER_ROLE.DOCTOR]),
      });
      expect(asDoctor.statusCode).toBe(403);

      const asAdmin = await context.app.inject({
        method: 'DELETE',
        url: `/patients/${id}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });
      expect(asAdmin.statusCode).toBe(204);

      // Soft delete: the row is gone from the API but still in the table.
      const afterDelete = await context.app.inject({
        method: 'GET',
        url: `/patients/${id}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });
      expect(afterDelete.statusCode).toBe(404);

      const rows = await context.db.execute(`select deleted_at from patients where id = '${id}'`);
      expect([...rows]).toHaveLength(1);
      expect([...rows][0]?.['deleted_at']).not.toBeNull();
    });
  });

  describe('medical history and allergy flags', () => {
    it('refuses a receptionist the medical history entirely', async () => {
      const response = await context.app.inject({
        method: 'GET',
        url: `/patients/${ahmadId}/medical-history`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      expect(response.statusCode).toBe(403);
    });

    it('gives a technician the allergy flags and nothing else', async () => {
      await context.app.inject({
        method: 'PATCH',
        url: `/patients/${ahmadId}/medical-history`,
        headers: auth(tokens[USER_ROLE.DOCTOR]),
        payload: {
          allergies: ['البنسلين'],
          chronicConditions: ['ارتفاع ضغط الدم'],
          currentMedications: ['أملوديبين'],
          notes: 'ملاحظة سريرية',
        },
      });

      const flags = await context.app.inject({
        method: 'GET',
        url: `/patients/${ahmadId}/allergy-flags`,
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
      });

      expect(flags.statusCode).toBe(200);
      expect(flags.json()).toEqual({
        patientId: ahmadId,
        hasAllergies: true,
        allergies: ['البنسلين'],
      });

      const history = await context.app.inject({
        method: 'GET',
        url: `/patients/${ahmadId}/medical-history`,
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
      });

      expect(history.statusCode).toBe(403);
    });

    it('returns an empty history rather than 404 before anything is recorded', async () => {
      const id = await createPatient(context, tokens[USER_ROLE.DOCTOR], {
        fullName: 'مريض جديد',
        phone: uniquePhone(),
      });

      const response = await context.app.inject({
        method: 'GET',
        url: `/patients/${id}/medical-history`,
        headers: auth(tokens[USER_ROLE.DOCTOR]),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ allergies: [], chronicConditions: [] });
    });
  });
});
