import {
  APPOINTMENT_STATUS,
  CHART_TYPE,
  LOOKUP_LIST_KEYS,
  SYSTEM_LOOKUPS,
  LEDGER_ENTRY_KIND,
  PAYMENT_METHOD,
  PERFORMED_PROCEDURE_STATUS,
  PROCEDURE_OUTCOME,
  USER_ROLE,
  type AuthenticatedUserProfile,
  type Attachment,
  type CalendarAppointment,
  type DashboardSummary,
  type Doctor,
  type OverduePatient,
  type PatientBalance,
  type PatientClinicalView,
  type Payment,
  type Statement,
  type StatementEntry,
  type PerformedProcedure,
  type ProcedureCatalogItem,
  type LookupBundle,
  type LookupListKey,
  type LookupOption,
  type ToothHistory,
  type TreatmentPlan,
  type TreatmentPlanItem,
  type User,
  type Visit,
} from '@clinic/shared';

export const CLINIC_ID = '11111111-1111-4111-8111-111111111111';

export function makeProfile(
  overrides: Partial<AuthenticatedUserProfile> = {},
): AuthenticatedUserProfile {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    clinicId: CLINIC_ID,
    name: 'مدير العيادة',
    phone: '+963100000001',
    email: 'admin@clinic.local',
    role: USER_ROLE.ADMIN,
    isActive: true,
    ...overrides,
  };
}

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    clinicId: CLINIC_ID,
    name: 'ليلى حداد',
    phone: '+963100000002',
    email: 'layla@clinic.local',
    role: USER_ROLE.DOCTOR,
    isActive: true,
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
    ...overrides,
  };
}

/**
 * A page of results.
 *
 * `total` defaults to what was passed, and can be overridden — a badge fed by
 * `limit: 1` reads the total off a page of one row, so a fixture that could
 * only ever report `items.length` could not stand in for it.
 */
export function paginated<TItem>(items: TItem[], overrides: { total?: number } = {}) {
  return {
    items,
    page: 1,
    limit: 10,
    total: overrides.total ?? items.length,
    totalPages: 1,
  };
}

export const PATIENT_ID = '44444444-4444-4444-8444-444444444444';
export const DOCTOR_ID = '55555555-5555-4555-8555-555555555555';

export function makePatient(overrides: Partial<PatientClinicalView> = {}): PatientClinicalView {
  return {
    id: PATIENT_ID,
    clinicId: CLINIC_ID,
    fileNumber: '00001',
    fullName: 'أحمد خالد الحسن',
    phone: '+963931000001',
    dateOfBirth: '1988-03-14',
    gender: 'male',
    address: 'المزة، دمشق',
    nationalId: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    notes: null,
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
    ...overrides,
  };
}

export function makeCatalogItem(
  overrides: Partial<ProcedureCatalogItem> = {},
): ProcedureCatalogItem {
  return {
    id: '66666666-6666-4666-8666-666666666666',
    clinicId: CLINIC_ID,
    specialtyId: '77777777-7777-4777-8777-777777777777',
    code: 'FILL-C',
    nameAr: 'حشوة تجميلية',
    nameEn: 'Composite filling',
    defaultPrice: '60.00',
    chartOutcome: PROCEDURE_OUTCOME.FILLING,
    isActive: true,
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
    ...overrides,
  };
}

/** A performed procedure carrying one FDI chart mark. */
export function makeProcedure(
  tooth: number,
  overrides: Partial<PerformedProcedure> = {},
): PerformedProcedure {
  const id = overrides.id ?? `proc-${tooth}`;

  return {
    id,
    clinicId: CLINIC_ID,
    patientId: PATIENT_ID,
    visitId: null,
    doctorId: DOCTOR_ID,
    procedureId: makeCatalogItem().id,
    price: '60.00',
    discount: '0.00',
    discountReason: null,
    status: PERFORMED_PROCEDURE_STATUS.DONE,
    planItemId: null,
    performedAt: '2026-02-01T09:00:00.000Z',
    notes: null,
    createdAt: '2026-02-01T09:00:00.000Z',
    updatedAt: '2026-02-01T09:00:00.000Z',
    chartMarks: [
      {
        id: `mark-${tooth}`,
        clinicId: CLINIC_ID,
        performedProcedureId: id,
        chartType: CHART_TYPE.TOOTH_FDI,
        location: { tooth, surfaces: ['O'] },
        createdAt: '2026-02-01T09:00:00.000Z',
        updatedAt: '2026-02-01T09:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

export function makeDoctor(overrides: Partial<Doctor> = {}): Doctor {
  return {
    id: DOCTOR_ID,
    clinicId: CLINIC_ID,
    userId: makeUser().id,
    specialtyId: '77777777-7777-4777-8777-777777777777',
    weeklySchedule: [],
    defaultAppointmentDurationMinutes: 30,
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
    user: {
      id: makeUser().id,
      name: 'ليلى حداد',
      phone: '+963100000002',
      email: 'layla@clinic.local',
      isActive: true,
    },
    specialty: {
      id: '77777777-7777-4777-8777-777777777777',
      code: 'dental',
      name: 'Dentistry',
      chartType: CHART_TYPE.TOOTH_FDI,
    },
    ...overrides,
  };
}

export function makeToothHistory(
  tooth: number,
  overrides: Partial<ToothHistory> = {},
): ToothHistory {
  return {
    patientId: PATIENT_ID,
    tooth,
    procedures: [makeProcedure(tooth)],
    marks: makeProcedure(tooth).chartMarks ?? [],
    attachments: [] as Attachment[],
    ...overrides,
  };
}

export function makeVisit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: '88888888-8888-4888-8888-888888888888',
    clinicId: CLINIC_ID,
    patientId: PATIENT_ID,
    doctorId: DOCTOR_ID,
    visitDate: '2026-02-01T09:00:00.000Z',
    complaint: 'ألم عند المضغ',
    examination: 'نخر عميق على السطح الإطباقي',
    diagnosis: 'التهاب لب سني عكوس',
    notes: null,
    createdAt: '2026-02-01T09:00:00.000Z',
    updatedAt: '2026-02-01T09:00:00.000Z',
    ...overrides,
  };
}

export function makePlanItem(overrides: Partial<TreatmentPlanItem> = {}): TreatmentPlanItem {
  return {
    id: '99999999-9999-4999-8999-999999999999',
    clinicId: CLINIC_ID,
    treatmentPlanId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    procedureId: makeCatalogItem().id,
    estimatedPrice: '60.00',
    sortOrder: 0,
    status: 'planned',
    notes: null,
    createdAt: '2026-02-01T09:00:00.000Z',
    updatedAt: '2026-02-01T09:00:00.000Z',
    ...overrides,
  };
}

export function makeTreatmentPlan(overrides: Partial<TreatmentPlan> = {}): TreatmentPlan {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    clinicId: CLINIC_ID,
    patientId: PATIENT_ID,
    doctorId: DOCTOR_ID,
    title: 'خطة معالجة لثوية',
    status: 'active',
    notes: null,
    createdAt: '2026-02-01T09:00:00.000Z',
    updatedAt: '2026-02-01T09:00:00.000Z',
    items: [makePlanItem()],
    ...overrides,
  };
}

export function makeAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    clinicId: CLINIC_ID,
    patientId: PATIENT_ID,
    visitId: null,
    type: 'xray_periapical',
    filename: 'periapical-46.png',
    mime: 'image/png',
    sizeBytes: 2048,
    tooth: 46,
    note: null,
    createdAt: '2026-02-01T09:00:00.000Z',
    updatedAt: '2026-02-01T09:00:00.000Z',
    ...overrides,
  };
}

export function makeClinic() {
  return {
    id: CLINIC_ID,
    name: 'عيادة النور',
    logoKey: null,
    phone: '+963110000000',
    email: 'info@clinic.local',
    address: 'دمشق، سوريا',
    currency: 'USD',
    workingHours: [],
    settings: {},
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
  };
}

export const PAYMENT_ID = '66666666-6666-4666-8666-666666666666';

export function makeBalance(overrides: Partial<PatientBalance> = {}): PatientBalance {
  return {
    patientId: PATIENT_ID,
    charged: '150.00',
    paid: '50.00',
    balance: '100.00',
    lastPaymentAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

export function makeStatementEntry(overrides: Partial<StatementEntry> = {}): StatementEntry {
  return {
    id: '77777777-7777-4777-8777-777777777777',
    kind: LEDGER_ENTRY_KIND.CHARGE,
    occurredAt: '2026-08-20T09:00:00.000Z',
    description: 'حشوة تجميلية',
    amount: '150.00',
    runningBalance: '150.00',
    receiptNumber: null,
    isReversal: false,
    ...overrides,
  };
}

export function makeStatement(overrides: Partial<Statement> = {}): Statement {
  return {
    patientId: PATIENT_ID,
    from: null,
    to: null,
    openingBalance: '0.00',
    closingBalance: '100.00',
    entries: [
      makeStatementEntry(),
      makeStatementEntry({
        id: PAYMENT_ID,
        kind: LEDGER_ENTRY_KIND.PAYMENT,
        occurredAt: '2026-09-01T10:00:00.000Z',
        description: 'دفعة على الحساب',
        amount: '-50.00',
        runningBalance: '100.00',
        receiptNumber: 12,
      }),
    ],
    ...overrides,
  };
}

export function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: PAYMENT_ID,
    clinicId: CLINIC_ID,
    patientId: PATIENT_ID,
    amount: '50.00',
    method: PAYMENT_METHOD.CASH,
    note: null,
    receiptNumber: 12,
    reversesId: null,
    receivedBy: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

export function makeOverduePatient(overrides: Partial<OverduePatient> = {}): OverduePatient {
  return {
    patientId: PATIENT_ID,
    fileNumber: '00001',
    fullName: 'أحمد خالد الحسن',
    phone: '+963931000001',
    balance: '300.00',
    lastPaymentAt: '2026-06-01T10:00:00.000Z',
    daysSinceLastPayment: 96,
    ...overrides,
  };
}

export const APPOINTMENT_ID = '66666666-6666-4666-8666-666666666666';

/**
 * One row of the calendar.
 *
 * `startsAt` is a real instant rather than a fixed string so a test can say
 * "today at ten" without knowing what today is; the clinic's zone is what
 * turns it back into a wall-clock time on screen.
 */
export function makeCalendarAppointment(
  overrides: Partial<CalendarAppointment> = {},
): CalendarAppointment {
  const startsAt = overrides.startsAt ?? '2026-09-07T10:00:00.000Z';

  return {
    id: APPOINTMENT_ID,
    clinicId: CLINIC_ID,
    patientId: PATIENT_ID,
    doctorId: DOCTOR_ID,
    startsAt,
    durationMinutes: 30,
    endsAt: new Date(new Date(startsAt).getTime() + 30 * 60_000).toISOString(),
    type: 'checkup',
    status: APPOINTMENT_STATUS.CONFIRMED,
    reason: null,
    notes: null,
    visitId: null,
    cancelledReason: null,
    patientName: 'أحمد خالد الحسن',
    patientPhone: '+963931000001',
    patientFileNumber: '00001',
    patientUnverified: false,
    doctorName: 'ليلى حداد',
    createdAt: startsAt,
    updatedAt: startsAt,
    ...overrides,
  };
}

/**
 * The landing page's aggregate, with every figure present.
 *
 * The API omits the ones a role may not read, so a test for role shaping
 * builds the narrower response by passing `undefined` for a field rather than
 * by reaching for a second fixture.
 */
export function makeDashboardSummary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    date: '2026-09-07',
    appointmentsToday: 3,
    pendingBookings: 2,
    overdueTotal: '450.00',
    overduePatients: 4,
    schedule: [],
    ...overrides,
  };
}

/**
 * The editable lists as a clinic starts with them.
 *
 * Built from the same `SYSTEM_LOOKUPS` the API seeds from, so a test that
 * renders a dropdown sees exactly the rows a real clinic would — and a test
 * that adds a row to one of them is adding a row to a real list, not to a
 * fixture that happens to resemble one.
 */
export function makeLookupBundle(
  extra: Partial<Record<LookupListKey, readonly Partial<LookupOption>[]>> = {},
): LookupBundle {
  const bundle: Record<string, LookupOption[]> = {};

  for (const listKey of LOOKUP_LIST_KEYS) {
    bundle[listKey] = SYSTEM_LOOKUPS[listKey].map((row, index) =>
      makeLookupOption({
        id: `${listKey}-${row.code}`,
        listKey,
        code: row.code,
        nameAr: row.nameAr,
        nameEn: row.nameEn,
        color: row.color ?? null,
        sortOrder: index,
        isSystem: true,
        meta: row.meta ?? {},
      }),
    );
  }

  for (const [listKey, rows] of Object.entries(extra)) {
    const list = (bundle[listKey] ??= []);
    for (const row of rows) {
      list.push(
        makeLookupOption({ listKey: listKey as LookupListKey, sortOrder: list.length, ...row }),
      );
    }
  }

  return bundle;
}

export function makeLookupOption(overrides: Partial<LookupOption> = {}): LookupOption {
  return {
    id: overrides.code ?? 'lookup-1',
    clinicId: CLINIC_ID,
    listKey: LOOKUP_LIST_KEYS[0],
    code: 'code',
    nameAr: 'خيار',
    nameEn: 'Option',
    color: null,
    sortOrder: 0,
    isSystem: false,
    isActive: true,
    meta: {},
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
    ...overrides,
  };
}
