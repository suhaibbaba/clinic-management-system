import { randomUUID } from 'node:crypto';

import { CHART_TYPE, PROCEDURE_OUTCOME, USER_ROLE } from '@clinic/shared';

import { auth, type TestClinic, type TestContext } from '@test/helpers/test-app';

export interface PatientFixtures {
  readonly doctorId: string;
  readonly catalogId: string;
}

// Through the API rather than by inserting rows, so the fixtures exercise the same validation the
// suites test around.
export async function seedClinicFixtures(
  context: TestContext,
  clinic: TestClinic,
  adminToken: string,
): Promise<PatientFixtures> {
  const doctor = await context.app.inject({
    method: 'POST',
    url: '/doctors',
    headers: auth(adminToken),
    payload: {
      userId: clinic.userIds[USER_ROLE.DOCTOR],
      specialtyId: clinic.specialtyId,
      weeklySchedule: [{ weekday: 1, ranges: [{ start: '09:00', end: '17:00' }] }],
      defaultAppointmentDurationMinutes: 30,
    },
  });

  if (doctor.statusCode !== 201) {
    throw new Error(`Failed to create the test doctor: ${doctor.statusCode} ${doctor.body}`);
  }

  const catalogItem = await context.app.inject({
    method: 'POST',
    url: '/procedure-catalog',
    headers: auth(adminToken),
    payload: {
      specialtyId: clinic.specialtyId,
      code: `PROC-${randomUUID().slice(0, 8)}`,
      nameAr: 'حشوة تجميلية',
      nameEn: 'Composite filling',
      defaultPrice: '60.00',
      chartOutcome: PROCEDURE_OUTCOME.FILLING,
    },
  });

  if (catalogItem.statusCode !== 201) {
    throw new Error(
      `Failed to create the test catalog item: ${catalogItem.statusCode} ${catalogItem.body}`,
    );
  }

  return {
    doctorId: (doctor.json() as { id: string }).id,
    catalogId: (catalogItem.json() as { id: string }).id,
  };
}

export async function createPatient(
  context: TestContext,
  token: string,
  payload: { fullName: string; phone: string; [key: string]: unknown },
): Promise<string> {
  const response = await context.app.inject({
    method: 'POST',
    url: '/patients',
    headers: auth(token),
    payload,
  });

  if (response.statusCode !== 201) {
    throw new Error(`Failed to create the test patient: ${response.statusCode} ${response.body}`);
  }

  return (response.json() as { id: string }).id;
}

export function procedurePayload(input: {
  patientId: string;
  doctorId: string;
  procedureId: string;
  tooth: number;
  surfaces?: string[];
}): Record<string, unknown> {
  return {
    patientId: input.patientId,
    doctorId: input.doctorId,
    procedureId: input.procedureId,
    chartMarks: [
      {
        chartType: CHART_TYPE.TOOTH_FDI,
        location: { tooth: input.tooth, surfaces: input.surfaces ?? ['O'] },
      },
    ],
  };
}

/** Phone numbers are unique system-wide, so every fixture needs a fresh one. */
export function uniquePhone(): string {
  return `+9955${Math.floor(Math.random() * 1_000_000_000)}`;
}
