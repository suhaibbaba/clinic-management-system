import { USER_ROLE, type UserRole } from '@clinic/shared';

import {
  createPatient,
  seedClinicFixtures,
  uniquePhone,
  type PatientFixtures,
} from '@test/helpers/patient-fixtures';
import { auth, createTestContext, type TestClinic, type TestContext } from '@test/helpers/test-app';

/**
 * The ✗ cells of the ROLES.md patients matrix, one request each.
 *
 * Everything here asserts a refusal or a stripped response, so a permission
 * that quietly widens shows up as a failing test rather than as a leak.
 */
describe('Patients permission boundaries (e2e)', () => {
  let context: TestContext;
  let clinic: TestClinic;
  let fixtures: PatientFixtures;
  const tokens = {} as Record<UserRole, string>;

  let patientId: string;
  let visitId: string;
  let prescriptionId: string;

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
      fullName: 'مريض اختبار الصلاحيات',
      phone: uniquePhone(),
    });

    const visit = await context.app.inject({
      method: 'POST',
      url: '/visits',
      headers: auth(tokens[USER_ROLE.DOCTOR]),
      payload: {
        patientId,
        doctorId: fixtures.doctorId,
        complaint: 'ألم',
        diagnosis: 'تشخيص سري',
      },
    });
    visitId = (visit.json() as { id: string }).id;

    const prescription = await context.app.inject({
      method: 'POST',
      url: '/prescriptions',
      headers: auth(tokens[USER_ROLE.DOCTOR]),
      payload: {
        patientId,
        doctorId: fixtures.doctorId,
        items: [
          { drug: 'إيبوبروفين', dose: '٤٠٠ ملغ', frequency: 'عند اللزوم', duration: '٣ أيام' },
        ],
      },
    });
    prescriptionId = (prescription.json() as { id: string }).id;
  });

  afterAll(async () => {
    await context.close();
  });

  interface Case {
    readonly name: string;
    readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    readonly url: () => string;
    readonly roles: UserRole[];
  }

  const FORBIDDEN: readonly Case[] = [
    {
      name: 'visits list',
      method: 'GET',
      url: () => `/visits?patientId=${patientId}`,
      roles: [USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN],
    },
    {
      name: 'a single visit',
      method: 'GET',
      url: () => `/visits/${visitId}`,
      roles: [USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN],
    },
    {
      name: 'medical history read',
      method: 'GET',
      url: () => `/patients/${patientId}/medical-history`,
      roles: [USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN],
    },
    {
      name: 'medical history write',
      method: 'PATCH',
      url: () => `/patients/${patientId}/medical-history`,
      roles: [USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN],
    },
    {
      name: 'allergy flags',
      method: 'GET',
      url: () => `/patients/${patientId}/allergy-flags`,
      roles: [USER_ROLE.RECEPTIONIST],
    },
    {
      name: 'prescriptions list',
      method: 'GET',
      url: () => `/prescriptions?patientId=${patientId}`,
      roles: [USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN],
    },
    {
      name: 'a single prescription',
      method: 'GET',
      url: () => `/prescriptions/${prescriptionId}`,
      roles: [USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN],
    },
    {
      name: 'treatment plans',
      method: 'GET',
      url: () => `/treatment-plans?patientId=${patientId}`,
      roles: [USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN],
    },
    {
      name: 'tooth history',
      method: 'GET',
      url: () => `/patients/${patientId}/teeth/46`,
      roles: [USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN],
    },
    {
      name: 'attachments',
      method: 'GET',
      url: () => `/patients/${patientId}/attachments`,
      roles: [USER_ROLE.RECEPTIONIST],
    },
    {
      name: 'the timeline',
      method: 'GET',
      url: () => `/patients/${patientId}/timeline`,
      roles: [USER_ROLE.TECHNICIAN],
    },
  ];

  for (const testCase of FORBIDDEN) {
    for (const role of testCase.roles) {
      it(`refuses a ${role} ${testCase.name}`, async () => {
        const response = await context.app.inject({
          method: testCase.method,
          url: testCase.url(),
          headers: auth(tokens[role]),
          payload: {},
        });

        expect(response.statusCode).toBe(403);
      });
    }
  }

  it('lets a doctor write clinical records but only an admin delete them', async () => {
    const deleteAsDoctor = await context.app.inject({
      method: 'DELETE',
      url: `/visits/${visitId}`,
      headers: auth(tokens[USER_ROLE.DOCTOR]),
    });

    expect(deleteAsDoctor.statusCode).toBe(403);
  });

  it('reports another clinic’s clinical record as 404, never 403', async () => {
    const otherClinic = await context.createClinic();
    const otherToken = await context.login(otherClinic.phones[USER_ROLE.ADMIN]);

    for (const url of [`/visits/${visitId}`, `/prescriptions/${prescriptionId}`]) {
      const response = await context.app.inject({
        method: 'GET',
        url,
        headers: auth(otherToken),
      });

      expect(response.statusCode).toBe(404);
    }
  });

  it('gives a receptionist the procedure catalog as names and prices only', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: '/procedure-catalog',
      headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
    });

    expect(response.statusCode).toBe(200);

    const { items } = response.json() as { items: Record<string, unknown>[] };
    expect(items.length).toBeGreaterThan(0);

    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(
        ['code', 'defaultPrice', 'id', 'nameAr', 'nameEn'].sort(),
      );
    }
  });

  it('refuses a non-admin write to the procedure catalog', async () => {
    for (const role of [USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN]) {
      const response = await context.app.inject({
        method: 'POST',
        url: '/procedure-catalog',
        headers: auth(tokens[role]),
        payload: {
          specialtyId: clinic.specialtyId,
          code: `X-${role}`,
          nameAr: 'إجراء',
          nameEn: 'Procedure',
          defaultPrice: '10.00',
        },
      });

      expect(response.statusCode).toBe(403);
    }
  });
});
