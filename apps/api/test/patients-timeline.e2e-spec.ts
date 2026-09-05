import { TIMELINE_ENTRY_TYPE, USER_ROLE, type UserRole } from '@clinic/shared';

import {
  createPatient,
  procedurePayload,
  seedClinicFixtures,
  uniquePhone,
  type PatientFixtures,
} from '@test/helpers/patient-fixtures';
import { auth, createTestContext, type TestClinic, type TestContext } from '@test/helpers/test-app';

interface Entry {
  id: string;
  type: string;
  occurredAt: string;
  title: string;
  detail: Record<string, unknown>;
}

describe('Patient timeline (e2e)', () => {
  let context: TestContext;
  let clinic: TestClinic;
  let fixtures: PatientFixtures;
  const tokens = {} as Record<UserRole, string>;

  let patientId: string;

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

    fixtures = await seedClinicFixtures(context, clinic, tokens[USER_ROLE.ADMIN]);

    patientId = await createPatient(context, tokens[USER_ROLE.DOCTOR], {
      fullName: 'مريض الخط الزمني',
      phone: uniquePhone(),
    });

    const asDoctor = auth(tokens[USER_ROLE.DOCTOR]);

    await context.app.inject({
      method: 'POST',
      url: '/visits',
      headers: asDoctor,
      payload: {
        patientId,
        doctorId: fixtures.doctorId,
        visitDate: new Date(Date.now() - 3 * 86_400_000).toISOString(),
        complaint: 'ألم عند المضغ',
        diagnosis: 'التهاب لب سني عكوس',
      },
    });

    await context.app.inject({
      method: 'POST',
      url: '/performed-procedures',
      headers: asDoctor,
      payload: {
        ...procedurePayload({
          patientId,
          doctorId: fixtures.doctorId,
          procedureId: fixtures.catalogId,
          tooth: 46,
        }),
        performedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      },
    });

    await context.app.inject({
      method: 'POST',
      url: '/prescriptions',
      headers: asDoctor,
      payload: {
        patientId,
        doctorId: fixtures.doctorId,
        items: [
          { drug: 'أموكسيسيلين', dose: '٥٠٠ ملغ', frequency: 'كل ٨ ساعات', duration: '٥ أيام' },
        ],
      },
    });

    await context.app.inject({
      method: 'POST',
      url: '/treatment-plans',
      headers: asDoctor,
      payload: {
        patientId,
        doctorId: fixtures.doctorId,
        title: 'خطة معالجة',
        items: [{ procedureId: fixtures.catalogId }],
      },
    });
  });

  afterAll(async () => {
    await context.close();
  });

  const timeline = async (role: UserRole, query = '') =>
    context.app.inject({
      method: 'GET',
      url: `/patients/${patientId}/timeline${query}`,
      headers: auth(tokens[role]),
    });

  it('merges every record type into one reverse-chronological stream', async () => {
    const response = await timeline(USER_ROLE.DOCTOR);

    expect(response.statusCode).toBe(200);

    const { items, total } = response.json() as { items: Entry[]; total: number };

    expect(total).toBe(4);
    expect(items.map((item) => item.type).sort()).toEqual(
      [
        TIMELINE_ENTRY_TYPE.PRESCRIPTION,
        TIMELINE_ENTRY_TYPE.PROCEDURE,
        TIMELINE_ENTRY_TYPE.TREATMENT_PLAN,
        TIMELINE_ENTRY_TYPE.VISIT,
      ].sort(),
    );

    const timestamps = items.map((item) => Date.parse(item.occurredAt));
    expect([...timestamps].sort((a, b) => b - a)).toEqual(timestamps);
  });

  it('paginates across the merged stream, not per source', async () => {
    const first = await timeline(USER_ROLE.ADMIN, '?limit=2&page=1');
    const second = await timeline(USER_ROLE.ADMIN, '?limit=2&page=2');

    const firstPage = first.json() as { items: Entry[]; total: number; totalPages: number };
    const secondPage = second.json() as { items: Entry[] };

    expect(firstPage.items).toHaveLength(2);
    expect(secondPage.items).toHaveLength(2);
    expect(firstPage.total).toBe(4);
    expect(firstPage.totalPages).toBe(2);

    const ids = [...firstPage.items, ...secondPage.items].map((item) => item.id);
    expect(new Set(ids).size).toBe(4);
  });

  it('narrows to one type on request', async () => {
    const response = await timeline(USER_ROLE.DOCTOR, `?type=${TIMELINE_ENTRY_TYPE.VISIT}`);

    const { items } = response.json() as { items: Entry[] };
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('التهاب لب سني عكوس');
  });

  it('carries money as a string, never a JSON number', async () => {
    const response = await timeline(USER_ROLE.DOCTOR, `?type=${TIMELINE_ENTRY_TYPE.PROCEDURE}`);

    const entry = (response.json() as { items: Entry[] }).items[0];
    expect(entry?.detail['price']).toBe('60.00');
    expect(typeof entry?.detail['price']).toBe('string');
  });

  it('gives a receptionist only the financial and appointment entries', async () => {
    const response = await timeline(USER_ROLE.RECEPTIONIST);

    expect(response.statusCode).toBe(200);

    // Those modules do not exist yet, so the page is empty rather than
    // carrying a clinical entry a receptionist may not see.
    const { items, total } = response.json() as { items: Entry[]; total: number };
    expect(items).toEqual([]);
    expect(total).toBe(0);
  });

  it('cannot be widened by the type query parameter', async () => {
    const response = await timeline(USER_ROLE.RECEPTIONIST, `?type=${TIMELINE_ENTRY_TYPE.VISIT}`);

    expect(response.statusCode).toBe(200);
    expect((response.json() as { items: Entry[] }).items).toEqual([]);
  });

  it('refuses a technician entirely', async () => {
    const response = await timeline(USER_ROLE.TECHNICIAN);

    expect(response.statusCode).toBe(403);
  });

  it('never reaches another clinic', async () => {
    const otherClinic = await context.createClinic();
    const otherToken = await context.login(otherClinic.phones[USER_ROLE.ADMIN]);

    const response = await context.app.inject({
      method: 'GET',
      url: `/patients/${patientId}/timeline`,
      headers: auth(otherToken),
    });

    expect(response.statusCode).toBe(404);
  });
});
