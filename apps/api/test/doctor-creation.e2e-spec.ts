import { USER_ROLE, type Doctor, type Paginated, type User } from "@clinic/shared";
import { eq } from "drizzle-orm";

import { users } from "@api/database/schema";
import {
  auth,
  createTestContext,
  TEST_PASSWORD,
  type TestClinic,
  type TestContext,
} from "@test/helpers/test-app";

/** The one the harness's `login` sends, so a created account can be signed into here. */
const password = TEST_PASSWORD;

// A doctor is an account and a profile, and neither half is any use alone. These assert that the
// pair is written together and that there is no door left open to produce one without the other.
describe("Doctor creation (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let token: string;

  const uniquePhone = (): string => `+9944${Math.floor(Math.random() * 1_000_000_000)}`;

  const staffMatching = async (search: string): Promise<User[]> => {
    const response = await context.app.inject({
      method: "GET",
      url: `/users?search=${encodeURIComponent(search)}`,
      headers: auth(token),
    });

    return (response.json() as Paginated<User>).items;
  };

  const listDoctors = async (): Promise<number> => {
    const response = await context.app.inject({
      method: "GET",
      url: "/doctors?limit=100",
      headers: auth(token),
    });

    return (response.json() as Paginated<Doctor>).total;
  };

  const createDoctor = (body: Record<string, unknown>) =>
    context.app.inject({
      method: "POST",
      url: "/doctors",
      headers: auth(token),
      payload: { specialtyId: clinic.specialtyId, ...body },
    });

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();
    token = await context.login(clinic.phones[USER_ROLE.ADMIN]);
  });

  afterAll(async () => {
    await context.close();
  });

  it("creates the account and the profile in one request", async () => {
    const phone = uniquePhone();

    const response = await createDoctor({
      newUser: { name: { ar: "د. ليلى حداد", en: "Dr. Layla Haddad" }, phone, password },
      weeklySchedule: [{ weekday: 1, ranges: [{ start: "09:00", end: "17:00" }] }],
    });

    expect(response.statusCode).toBe(201);

    const doctor = response.json() as Doctor;
    expect(doctor.user.name).toEqual({ ar: "د. ليلى حداد", en: "Dr. Layla Haddad" });
    expect(doctor.weeklySchedule).toHaveLength(1);

    // The account is real: it signs in, and it is a doctor.
    await expect(context.login(phone)).resolves.toEqual(expect.any(String));

    const [row] = await context.db.select().from(users).where(eq(users.id, doctor.userId));
    expect(row?.role).toBe(USER_ROLE.DOCTOR);
  });

  it("creates neither when the specialty is not this clinic's", async () => {
    const phone = uniquePhone();

    const response = await createDoctor({
      specialtyId: crypto.randomUUID(),
      newUser: { name: { ar: "د. مرفوض", en: "Dr. Rejected" }, phone, password },
    });

    expect(response.statusCode).toBe(400);
    expect(await staffMatching(phone)).toHaveLength(0);
  });

  // The clash is raised inside the transaction, after the profile half is already lined up: what it
  // proves is that a rejection there takes the whole request with it.
  it("rolls the profile back when the account is refused", async () => {
    const phone = uniquePhone();

    await createDoctor({
      newUser: { name: { ar: "د. الأول", en: "Dr. First" }, phone, password },
    });

    const before = await listDoctors();

    const again = await createDoctor({
      newUser: { name: { ar: "د. الثاني", en: "Dr. Second" }, phone, password },
    });

    expect(again.statusCode).toBe(409);
    expect(await listDoctors()).toBe(before);
  });

  describe("the orphan guard", () => {
    it("refuses the doctor role on the users screen", async () => {
      const create = await context.app.inject({
        method: "POST",
        url: "/users",
        headers: auth(token),
        payload: {
          name: { ar: "يتيم", en: "Orphan" },
          phone: uniquePhone(),
          password,
          role: USER_ROLE.DOCTOR,
        },
      });

      expect(create.statusCode).toBe(400);
    });

    it("refuses promoting an existing user to doctor on the users screen", async () => {
      const created = await context.app.inject({
        method: "POST",
        url: "/users",
        headers: auth(token),
        payload: {
          name: { ar: "موظف استقبال", en: "Receptionist" },
          phone: uniquePhone(),
          password,
          role: USER_ROLE.RECEPTIONIST,
        },
      });

      const { id } = created.json() as User;

      const promote = await context.app.inject({
        method: "PATCH",
        url: `/users/${id}`,
        headers: auth(token),
        payload: { role: USER_ROLE.DOCTOR },
      });

      expect(promote.statusCode).toBe(400);
    });

    it("promotes an existing user when the doctors screen links them", async () => {
      const created = await context.app.inject({
        method: "POST",
        url: "/users",
        headers: auth(token),
        payload: {
          name: { ar: "فنّي سابق", en: "Former technician" },
          phone: uniquePhone(),
          password,
          role: USER_ROLE.TECHNICIAN,
        },
      });

      const { id } = created.json() as User;
      const response = await createDoctor({ userId: id });

      expect(response.statusCode).toBe(201);

      const [row] = await context.db.select().from(users).where(eq(users.id, id));
      expect(row?.role).toBe(USER_ROLE.DOCTOR);
    });

    it("deactivates the account when the profile is removed", async () => {
      const phone = uniquePhone();

      const created = await createDoctor({
        newUser: { name: { ar: "د. مغادر", en: "Dr. Leaver" }, phone, password },
      });

      const doctor = created.json() as Doctor;

      const removed = await context.app.inject({
        method: "DELETE",
        url: `/doctors/${doctor.id}`,
        headers: auth(token),
      });

      expect(removed.statusCode).toBe(204);

      const [row] = await context.db.select().from(users).where(eq(users.id, doctor.userId));
      expect(row?.isActive).toBe(false);
      await expect(context.login(phone)).rejects.toThrow();
    });

    it("refuses a second profile for one account", async () => {
      const created = await createDoctor({
        newUser: { name: { ar: "د. واحد", en: "Dr. One" }, phone: uniquePhone(), password },
      });

      const doctor = created.json() as Doctor;
      const again = await createDoctor({ userId: doctor.userId });

      expect(again.statusCode).toBe(409);
    });
  });
});
