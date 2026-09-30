import {
  CHART_TYPE,
  LOOKUP_LIST_KEYS,
  SYSTEM_LOOKUPS,
  LEDGER_ENTRY_KIND,
  PAYMENT_METHOD,
  PERFORMED_PROCEDURE_STATUS,
  PROCEDURE_OUTCOME,
  USER_ROLE,
  type AuthenticatedUserProfile,
  type CalendarAppointment,
  type CalendarFeed,
  type DashboardSummary,
  type Doctor,
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
  type User,
  type UserRole,
} from "@clinic/shared";

export const CLINIC_ID = "11111111-1111-4111-8111-111111111111";

export const SHIPPED_CAPABILITIES: Record<UserRole, readonly string[]> = {
  [USER_ROLE.ADMIN]: [
    "appointments.arrived",
    "appointments.cancel",
    "appointments.complete",
    "appointments.confirm",
    "appointments.convertToVisit",
    "appointments.create",
    "appointments.noShow",
    "appointments.start",
    "attachments.remove",
    "doctors.createVisiting",
    "inventory.adjust",
    "inventory.consume",
    "inventory.create",
    "inventory.purchase",
    "inventory.reverse",
    "lab-orders.cancel",
    "lab-orders.create",
    "lab-orders.fit",
    "lab-orders.ready",
    "lab-orders.receive",
    "lab-orders.return",
    "lab-orders.send",
    "lab-payments.create",
    "labs.create",
    "patient-attachments.presignUpload",
    "patients.create",
    "patients.remove",
    "patients.update",
    "payments.create",
    "payments.reverse",
    "pending-bookings.confirm",
    "pending-bookings.list",
    "pending-bookings.reject",
    "prescriptions.create",
    "prescriptions.remove",
    "procedures.create",
    "suppliers.create",
    "treatment-plans.create",
    "treatment-plans.remove",
    "treatment-plans.update",
    "users.invite",
    "users.remove",
    "users.resetPassword",
    "users.sendPasswordReset",
    "users.update",
    "waiting-list.create",
  ],
  [USER_ROLE.DOCTOR]: [
    "appointments.arrived",
    "appointments.cancel",
    "appointments.complete",
    "appointments.confirm",
    "appointments.convertToVisit",
    "appointments.create",
    "appointments.noShow",
    "appointments.start",
    "doctors.createVisiting",
    "inventory.consume",
    "lab-orders.cancel",
    "lab-orders.create",
    "lab-orders.fit",
    "lab-orders.return",
    "lab-orders.send",
    "patient-attachments.presignUpload",
    "patients.create",
    "patients.update",
    "prescriptions.create",
    "prescriptions.remove",
    "procedures.create",
    "treatment-plans.create",
    "treatment-plans.update",
  ],
  [USER_ROLE.VISITING_DOCTOR]: [
    "patient-attachments.presignUpload",
    "prescriptions.create",
    "prescriptions.remove",
    "procedures.create",
    "treatment-plans.create",
    "treatment-plans.update",
  ],
  [USER_ROLE.TECHNICIAN]: [
    "inventory.adjust",
    "inventory.consume",
    "inventory.create",
    "inventory.purchase",
    "lab-orders.cancel",
    "lab-orders.ready",
    "lab-orders.receive",
    "lab-orders.return",
    "lab-orders.send",
    "lab-payments.create",
    "labs.create",
    "suppliers.create",
  ],
  [USER_ROLE.RECEPTIONIST]: [
    "appointments.arrived",
    "appointments.cancel",
    "appointments.complete",
    "appointments.confirm",
    "appointments.create",
    "appointments.noShow",
    "appointments.start",
    "patients.create",
    "patients.update",
    "payments.create",
    "pending-bookings.confirm",
    "pending-bookings.list",
    "pending-bookings.reject",
    "waiting-list.create",
  ],
};

export const canFor =
  (role: UserRole) =>
  (capability: string): boolean =>
    SHIPPED_CAPABILITIES[role].includes(capability);

export function makeProfile(
  overrides: Partial<AuthenticatedUserProfile> = {},
): AuthenticatedUserProfile {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    clinicId: CLINIC_ID,
    clinic: {
      name: { ar: "عيادة النور", en: "Al Nour Clinic" },
      logoUrl: null,
      chartTypes: [CHART_TYPE.TOOTH_FDI],
      country: "PS",
    },
    name: { ar: "مدير العيادة", en: "Clinic Admin" },
    firstName: { ar: "مدير", en: "Clinic" },
    lastName: { ar: "العيادة", en: "Admin" },
    phone: "+963100000001",
    email: "admin@clinic.local",
    role: USER_ROLE.ADMIN,
    isActive: true,
    photoUrl: null,
    capabilities: [...SHIPPED_CAPABILITIES[overrides.role ?? USER_ROLE.ADMIN]],
    ...overrides,
  };
}

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    clinicId: CLINIC_ID,
    name: { ar: "ليلى حداد", en: "Layla Haddad" },
    firstName: { ar: "ليلى", en: "Layla" },
    lastName: { ar: "حداد", en: "Haddad" },
    phone: "+963100000002",
    activated: true,
    email: "layla@clinic.local",
    role: USER_ROLE.DOCTOR,
    isActive: true,
    photoUrl: null,
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-01-01T09:00:00.000Z",
    ...overrides,
  };
}

export function paginated<TItem>(
  items: TItem[],
  overrides: { total?: number; page?: number; totalPages?: number } = {},
) {
  return {
    items,
    page: overrides.page ?? 1,
    limit: 10,
    total: overrides.total ?? items.length,
    totalPages: overrides.totalPages ?? 1,
  };
}

export const PATIENT_ID = "44444444-4444-4444-8444-444444444444";
export const DOCTOR_ID = "55555555-5555-4555-8555-555555555555";

export function makePatient(overrides: Partial<PatientClinicalView> = {}): PatientClinicalView {
  return {
    id: PATIENT_ID,
    clinicId: CLINIC_ID,
    fileNumber: "00001",
    fullName: "أحمد خالد الحسن",
    firstName: "أحمد",
    middleName: "خالد",
    lastName: "الحسن",
    phone: "+963931000001",
    whatsapp: null,
    dateOfBirth: "1988-03-14",
    gender: "male",
    address: "المزة، دمشق",
    nationalId: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    notes: null,
    profileIncomplete: false,
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-01-01T09:00:00.000Z",
    ...overrides,
  };
}

export function makeCatalogItem(
  overrides: Partial<ProcedureCatalogItem> = {},
): ProcedureCatalogItem {
  return {
    id: "66666666-6666-4666-8666-666666666666",
    clinicId: CLINIC_ID,
    specialtyId: "77777777-7777-4777-8777-777777777777",
    code: "FILL-C",
    name: "Composite filling",
    defaultPrice: "60.00",
    chartOutcome: PROCEDURE_OUTCOME.FILLING,
    isActive: true,
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-01-01T09:00:00.000Z",
    ...overrides,
  };
}

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
    price: "60.00",
    discount: "0.00",
    discountReason: null,
    status: PERFORMED_PROCEDURE_STATUS.DONE,
    treatmentPlanId: null,
    performedAt: "2026-02-01T09:00:00.000Z",
    notes: null,
    createdAt: "2026-02-01T09:00:00.000Z",
    updatedAt: "2026-02-01T09:00:00.000Z",
    chartMarks: [
      {
        id: `mark-${tooth}`,
        clinicId: CLINIC_ID,
        performedProcedureId: id,
        chartType: CHART_TYPE.TOOTH_FDI,
        location: { tooth, surfaces: ["O"] },
        createdAt: "2026-02-01T09:00:00.000Z",
        updatedAt: "2026-02-01T09:00:00.000Z",
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
    specialtyId: "77777777-7777-4777-8777-777777777777",
    weeklySchedule: [],
    defaultAppointmentDurationMinutes: 30,
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-01-01T09:00:00.000Z",
    user: {
      id: makeUser().id,
      name: { ar: "ليلى حداد", en: "Layla Haddad" },
      phone: "+963100000002",
      email: "layla@clinic.local",
      isActive: true,
      photoUrl: null,
    },
    specialty: {
      id: "77777777-7777-4777-8777-777777777777",
      code: "dental",
      name: "Dentistry",
      chartType: CHART_TYPE.TOOTH_FDI,
    },
    isVisiting: false,
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
    ...overrides,
  };
}

export function makeClinic() {
  return {
    id: CLINIC_ID,
    name: { ar: "عيادة النور", en: "Al Nour Clinic" },
    logoKey: null,
    phone: "+963110000000",
    email: "info@clinic.local",
    address: "دمشق، سوريا",
    currency: "USD",
    workingHours: [],
    settings: {},
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-01-01T09:00:00.000Z",
  };
}

export const PAYMENT_ID = "66666666-6666-4666-8666-666666666666";

export function makeBalance(overrides: Partial<PatientBalance> = {}): PatientBalance {
  return {
    patientId: PATIENT_ID,
    charged: "150.00",
    paid: "50.00",
    balance: "100.00",
    lastPaymentAt: "2026-09-01T10:00:00.000Z",
    ...overrides,
  };
}

export function makeStatementEntry(overrides: Partial<StatementEntry> = {}): StatementEntry {
  return {
    id: "77777777-7777-4777-8777-777777777777",
    kind: LEDGER_ENTRY_KIND.CHARGE,
    occurredAt: "2026-08-20T09:00:00.000Z",
    description: "حشوة تجميلية",
    amount: "150.00",
    runningBalance: "150.00",
    receiptNumber: null,
    isReversal: false,
    isReversed: false,
    note: null,
    ...overrides,
  };
}

export function makeStatement(overrides: Partial<Statement> = {}): Statement {
  return {
    patientId: PATIENT_ID,
    from: null,
    to: null,
    openingBalance: "0.00",
    closingBalance: "100.00",
    entries: [
      makeStatementEntry(),
      makeStatementEntry({
        id: PAYMENT_ID,
        kind: LEDGER_ENTRY_KIND.PAYMENT,
        occurredAt: "2026-09-01T10:00:00.000Z",
        description: "دفعة على الحساب",
        note: "دفعة على الحساب",
        amount: "-50.00",
        runningBalance: "100.00",
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
    amount: "50.00",
    method: PAYMENT_METHOD.CASH,
    note: null,
    receiptNumber: 12,
    reversesId: null,
    receivedBy: null,
    createdAt: "2026-09-01T10:00:00.000Z",
    ...overrides,
  };
}

export function makeCalendarFeed(appointments: readonly CalendarAppointment[] = []): CalendarFeed {
  return {
    from: "2026-09-01",
    to: "2026-10-01",
    appointments: [...appointments],
    closures: [],
    timeOff: [],
  };
}

export function makeDashboardSummary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    date: "2026-09-07",
    appointmentsToday: 3,
    pendingBookings: 2,
    overdueTotal: "450.00",
    overduePatients: 4,
    schedule: [],
    ...overrides,
  };
}

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
    id: overrides.code ?? "lookup-1",
    clinicId: CLINIC_ID,
    listKey: LOOKUP_LIST_KEYS[0],
    code: "code",
    nameAr: "خيار",
    nameEn: "Option",
    color: null,
    sortOrder: 0,
    isSystem: false,
    isActive: true,
    meta: {},
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-01-01T09:00:00.000Z",
    ...overrides,
  };
}
