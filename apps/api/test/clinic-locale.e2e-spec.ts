import {
  CLINIC_ERROR,
  LOOKUP_LIST,
  NOTIFICATION_TEMPLATE,
  USER_ROLE,
  type AuthenticatedUserProfile,
  type Clinic,
  type LookupOption,
} from "@clinic/shared";
import { eq } from "drizzle-orm";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";
import { clinics, users } from "@api/database/schema/core";
import { expenses } from "@api/database/schema/expenses";
import { NotificationsService } from "@api/modules/notifications/services/notifications.service";

describe("Clinic language and region (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let admin: string;

  const patch = (body: Record<string, unknown>) =>
    context.app.inject({ method: "PATCH", url: "/clinic", headers: auth(admin), payload: body });

  const me = async (): Promise<AuthenticatedUserProfile> =>
    (await context.app.inject({ method: "GET", url: "/me", headers: auth(admin) })).json();

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();
    admin = await context.login(clinic.phones[USER_ROLE.ADMIN]);
  });

  afterAll(async () => {
    await context.close();
  });

  it("gives an Arabic clinic its country's defaults in the session", async () => {
    const profile = await me();

    expect(profile.clinic.locale).toMatchObject({
      languages: ["ar", "en"],
      primaryLanguage: "ar",
      clock: "12h",
    });
  });

  it("turns a clinic Turkish: name, languages, clock, zone and currency", async () => {
    const response = await patch({
      name: { tr: "Nur Diş Kliniği", en: "Nur Dental" },
      country: "TR",
      currency: "TRY",
      settings: {
        timezone: "Europe/Istanbul",
        locale: { languages: ["tr", "en"], clock: "24h", weekStart: 1 },
        documents: { language: "tr" },
      },
    });

    expect(response.statusCode).toBe(200);
    expect((response.json() as Clinic).name).toEqual({ tr: "Nur Diş Kliniği", en: "Nur Dental" });

    const profile = await me();

    expect(profile.clinic.locale).toEqual({
      country: "TR",
      currency: "TRY",
      timeZone: "Europe/Istanbul",
      languages: ["tr", "en"],
      primaryLanguage: "tr",
      clock: "24h",
      weekStart: 1,
      numberLocale: "tr-TR-u-nu-latn",
    });
  });

  it("refuses a language, clock or zone it does not know", async () => {
    for (const settings of [
      { locale: { languages: ["xx"] } },
      { locale: { clock: "36h" } },
      { locale: { languages: [] } },
      { documents: { language: "xx" } },
      { timezone: "Mars/Olympus" },
    ]) {
      expect((await patch({ settings })).statusCode).toBe(400);
    }
  });

  it("stores a staff member's name in every language given", async () => {
    const response = await context.app.inject({
      method: "PATCH",
      url: `/users/${clinic.userIds[USER_ROLE.RECEPTIONIST]}`,
      headers: auth(admin),
      payload: { firstName: { tr: "Ayşe", en: "Ayse" }, lastName: { tr: "Yılmaz", en: "Yilmaz" } },
    });

    expect(response.statusCode).toBe(200);

    const [row] = await context.db
      .select({ name: users.name, normalized: users.normalizedName })
      .from(users)
      .where(eq(users.id, clinic.userIds[USER_ROLE.RECEPTIONIST]));

    expect(row?.name).toEqual({ tr: "Ayşe Yılmaz", en: "Ayse Yilmaz" });
    expect(row?.normalized).toContain("ayse yilmaz");
  });

  it("finds a Turkish name typed without Turkish letters", async () => {
    const response = await context.app.inject({
      method: "GET",
      url: "/users?search=yilmaz",
      headers: auth(admin),
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.stringify(response.json())).toContain("Yılmaz");
  });

  it("names a lookup option in Turkish", async () => {
    const response = await context.app.inject({
      method: "POST",
      url: "/lookups",
      headers: auth(admin),
      payload: { listKey: LOOKUP_LIST.APPOINTMENT_TYPE, name: { tr: "Diş taşı temizliği" } },
    });

    expect(response.statusCode).toBe(201);
    expect((response.json() as LookupOption).name).toEqual({ tr: "Diş taşı temizliği" });
  });

  it("sends a patient message in the clinic's document language", async () => {
    const notifications = context.app.get(NotificationsService);
    const sent = await notifications.send({
      clinicId: clinic.id,
      to: "+905321234567",
      template: NOTIFICATION_TEMPLATE.REMINDER_24H,
      vars: {
        clinic: { tr: "Nur Diş Kliniği", en: "Nur Dental" },
        doctor: { tr: "Dr. Can" },
        time: "14:30",
      },
    });

    expect(sent?.body).toBe(
      "Hatırlatma: Yarın saat 14:30 için Nur Diş Kliniği kliniğinde Dr. Can ile randevunuz var.",
    );
  });

  it("locks the currency once the clinic has recorded money", async () => {
    await context.db.insert(expenses).values({
      clinicId: clinic.id,
      spentOn: "2026-01-01",
      category: "rent",
      amount: "100.00",
      method: "cash",
    });

    const response = await patch({ currency: "EUR" });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ message: CLINIC_ERROR.CURRENCY_LOCKED });

    const [row] = await context.db
      .select({ currency: clinics.currency })
      .from(clinics)
      .where(eq(clinics.id, clinic.id));

    expect(row?.currency).toBe("TRY");
    expect((await patch({ currency: "TRY" })).statusCode).toBe(200);
  });
});
