import {
  USER_ROLE,
  addDays,
  instantFromLocal,
  localDate,
  localWeekday,
  type PatientView,
} from "@clinic/shared";
import { eq } from "drizzle-orm";
import { clinics } from "@api/database/schema";
import {
  createPatient,
  seedClinicFixtures,
  uniquePhone,
  type PatientFixtures,
  nameParts,
} from "@test/helpers/patient-fixtures";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

const TIME_ZONE = "Asia/Damascus";

function nextMonday(): string {
  let date = localDate(new Date(), TIME_ZONE);

  do {
    date = addDays(date, 1);
  } while (localWeekday(date, TIME_ZONE) !== 1);

  return date;
}

const at = (date: string, time: string): string => {
  const [hours = "0", minutes = "0"] = time.split(":");

  return instantFromLocal(date, Number(hours) * 60 + Number(minutes), TIME_ZONE).toISOString();
};

describe("Inline patient registration (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let fixtures: PatientFixtures;
  let token: string;
  let monday: string;

  const findByPhone = async (phone: string): Promise<PatientView[]> => {
    const response = await context.app.inject({
      method: "GET",
      url: `/patients?search=${encodeURIComponent(phone)}`,
      headers: auth(token),
    });

    return (response.json() as { items: PatientView[] }).items;
  };

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();
    token = await context.login(clinic.phones[USER_ROLE.ADMIN]);

    fixtures = await seedClinicFixtures(context, clinic, token);

    await context.db
      .update(clinics)
      .set({
        workingHours: [{ weekday: 1, ranges: [{ start: "09:00", end: "17:00" }] }],
        settings: { timezone: TIME_ZONE },
      })
      .where(eq(clinics.id, clinic.id));

    monday = nextMonday();
  });

  afterAll(async () => {
    await context.close();
  });

  const book = (time: string, body: Record<string, unknown>) =>
    context.app.inject({
      method: "POST",
      url: "/appointments",
      headers: auth(token),
      payload: { doctorId: fixtures.doctorId, startsAt: at(monday, time), ...body },
    });

  it("registers the patient and books the appointment in one action", async () => {
    const phone = uniquePhone();

    const response = await book("09:00", {
      newPatient: { ...nameParts("سلمى أحمد الخطيب"), phone, gender: "female" },
    });

    expect(response.statusCode).toBe(201);

    const appointment = response.json() as { patientId: string; patientName: string };
    expect(appointment.patientName).toBe("سلمى أحمد الخطيب");

    const registered = await findByPhone(phone);
    expect(registered).toHaveLength(1);
    expect(registered[0]?.id).toBe(appointment.patientId);
    expect(registered[0]?.profileIncomplete).toBe(true);
  });

  it("rolls the patient back when the booking is refused", async () => {
    await book("10:00", { newPatient: { ...nameParts("أول مريض"), phone: uniquePhone() } });

    const phone = uniquePhone();

    const clash = await book("10:00", { newPatient: { ...nameParts("مريض مرفوض"), phone } });

    expect(clash.statusCode).toBe(409);
    expect(await findByPhone(phone)).toHaveLength(0);
  });

  it("audits the registration alongside the appointment", async () => {
    const phone = uniquePhone();

    const response = await book("13:00", { newPatient: { ...nameParts("مريض مُدقَّق"), phone } });
    const { patientId } = response.json() as { patientId: string };

    const trail = await context.app.inject({
      method: "GET",
      url: `/audit-log?entity=patients&entityId=${patientId}`,
      headers: auth(token),
    });

    expect(trail.json()).toMatchObject({
      items: [{ action: "create", newValue: { registeredInline: true } }],
    });
  });

  it("offers the existing patient rather than registering a second one on the same number", async () => {
    const phone = uniquePhone();
    const existingId = await createPatient(context, token, { ...nameParts("مريض قديم"), phone });

    const response = await book("11:00", { newPatient: { ...nameParts("اسم آخر"), phone } });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      existingPatient: { id: existingId, fullName: "مريض قديم" },
    });
  });

  it("refuses a body that names a patient both ways, or neither", async () => {
    const both = await book("12:00", {
      patientId: crypto.randomUUID(),
      newPatient: { ...nameParts("كلاهما"), phone: uniquePhone() },
    });
    const neither = await book("12:00", {});

    expect(both.statusCode).toBe(400);
    expect(neither.statusCode).toBe(400);
  });

  it("registers the patient and the queue entry together", async () => {
    const phone = uniquePhone();

    const response = await context.app.inject({
      method: "POST",
      url: "/waiting-list",
      headers: auth(token),
      payload: { newPatient: { ...nameParts("مريض الانتظار"), phone }, priority: "urgent" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ patientName: "مريض الانتظار" });
    expect(await findByPhone(phone)).toHaveLength(1);
  });
});
