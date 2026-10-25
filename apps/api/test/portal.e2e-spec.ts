import {
  PAYMENT_METHOD,
  SITE_SECTIONS,
  SITE_SECTION,
  USER_ROLE,
  defaultSiteContent,
  type PortalAccount,
  type PortalRecord,
  type SiteSection,
} from "@clinic/shared";
import { eq } from "drizzle-orm";
import { attachments, clinics, portalCodes } from "@api/database/schema";
import type { SendNotification } from "@api/modules/notifications/lib/notifications";
import { NotificationsService } from "@api/modules/notifications/services/notifications.service";
import { PORTAL_COOKIE_NAME } from "@api/modules/portal/constants";
import { phoneKey } from "@api/modules/portal/lib/portal-code";
import {
  createPatient,
  procedurePayload,
  seedClinicFixtures,
  uniquePhone,
} from "@test/helpers/patient-fixtures";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

const notificationSettings = {
  notifications: {
    enabled: true,
    channel: "sms",
    remind24h: true,
    remind2h: true,
    templates: {},
  },
};

describe("Patient portal (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let neighbour: TestClinic;
  let admin: Record<string, string>;
  let familyPhone: string;
  let motherId: string;
  let childId: string;
  let strangerId: string;
  let neighbourPatientId: string;
  const sent: SendNotification[] = [];

  const inject = (
    method: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    headers: Record<string, string> = {},
    payload?: object,
  ) => context.app.inject({ method, url, headers, ...(payload !== undefined && { payload }) });

  const publish = async (
    headers: Record<string, string>,
    sections: readonly SiteSection[],
  ): Promise<void> => {
    const draft = { ...defaultSiteContent(), sections: [...sections] };

    expect((await inject("PUT", "/website/draft", headers, draft)).statusCode).toBe(200);
    expect((await inject("POST", "/website/publish", headers)).statusCode).toBe(200);
  };

  const lastCodeFor = (phone: string): string => {
    const message = sent.findLast((entry) => entry.to === phone);

    if (!message?.vars["code"]) {
      throw new Error(`No portal code was sent to ${phone}`);
    }

    return message.vars["code"];
  };

  const forgetCodes = (phone: string) =>
    context.db.delete(portalCodes).where(eq(portalCodes.phoneDigits, phoneKey(phone)));

  const signIn = async (phone: string, slug = clinic.slug): Promise<string> => {
    await forgetCodes(phone);
    expect((await inject("POST", `/public/portal/${slug}/code`, {}, { phone })).statusCode).toBe(
      202,
    );

    const response = await inject(
      "POST",
      `/public/portal/${slug}/session`,
      {},
      { phone, code: lastCodeFor(phone) },
    );

    expect(response.statusCode).toBe(200);

    const cookie = (response.cookies as { name: string; value: string }[]).find(
      (entry) => entry.name === PORTAL_COOKIE_NAME,
    );

    if (!cookie) {
      throw new Error("The portal session cookie was not set");
    }

    return `${PORTAL_COOKIE_NAME}=${cookie.value}`;
  };

  beforeAll(async () => {
    context = await createTestContext();

    const notifications = context.app.get(NotificationsService);
    const send = notifications.send.bind(notifications);
    jest.spyOn(notifications, "send").mockImplementation((message) => {
      sent.push(message);
      return send(message);
    });

    clinic = await context.createClinic();
    neighbour = await context.createClinic();

    for (const target of [clinic, neighbour]) {
      await context.db
        .update(clinics)
        .set({ settings: notificationSettings })
        .where(eq(clinics.id, target.id));
    }

    const adminToken = await context.login(clinic.phones[USER_ROLE.ADMIN]);
    admin = auth(adminToken);
    const { doctorId, catalogId } = await seedClinicFixtures(context, clinic, adminToken);

    familyPhone = uniquePhone();
    motherId = await createPatient(context, adminToken, {
      firstName: "Huda",
      lastName: "Saleh",
      phone: familyPhone,
    });
    childId = await createPatient(context, adminToken, {
      firstName: "Omar",
      lastName: "Saleh",
      phone: familyPhone,
    });
    strangerId = await createPatient(context, adminToken, {
      firstName: "Rami",
      lastName: "Haddad",
      phone: uniquePhone(),
    });

    const procedure = await inject(
      "POST",
      "/performed-procedures",
      admin,
      procedurePayload({ patientId: motherId, doctorId, procedureId: catalogId, tooth: 36 }),
    );
    expect(procedure.statusCode).toBe(201);

    const payment = await inject("POST", "/payments", admin, {
      patientId: motherId,
      amount: "20",
      method: PAYMENT_METHOD.CASH,
      note: "Paid by the husband at the desk",
    });
    expect(payment.statusCode).toBe(201);

    const neighbourAdminToken = await context.login(neighbour.phones[USER_ROLE.ADMIN]);
    neighbourPatientId = await createPatient(context, neighbourAdminToken, {
      firstName: "Lina",
      lastName: "Saleh",
      phone: familyPhone,
    });

    await publish(admin, SITE_SECTIONS);
    await publish(auth(neighbourAdminToken), SITE_SECTIONS);
  });

  beforeEach(() => context.resetThrottle());

  afterAll(async () => {
    await context.close();
  });

  it("is closed until the clinic switches the patient account on", async () => {
    const closed = await context.createClinic();
    const headers = auth(await context.login(closed.phones[USER_ROLE.ADMIN]));

    await publish(
      headers,
      SITE_SECTIONS.filter((section) => section !== SITE_SECTION.PORTAL),
    );

    const response = await inject(
      "POST",
      `/public/portal/${closed.slug}/code`,
      {},
      { phone: familyPhone },
    );

    expect(response.statusCode).toBe(404);
  });

  it("answers the same for a phone with no patient, and sends nothing", async () => {
    const before = sent.length;
    const response = await inject(
      "POST",
      `/public/portal/${clinic.slug}/code`,
      {},
      { phone: uniquePhone() },
    );

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({ sent: true });
    expect(sent.length).toBe(before);
  });

  it("holds back a second code asked for within a minute", async () => {
    await forgetCodes(familyPhone);
    const ask = () =>
      inject("POST", `/public/portal/${clinic.slug}/code`, {}, { phone: familyPhone });

    expect((await ask()).statusCode).toBe(202);
    const before = sent.length;
    expect((await ask()).statusCode).toBe(202);
    expect(sent.length).toBe(before);
  });

  it("refuses a wrong code and then lets the right one in once", async () => {
    await forgetCodes(familyPhone);
    expect(
      (await inject("POST", `/public/portal/${clinic.slug}/code`, {}, { phone: familyPhone }))
        .statusCode,
    ).toBe(202);

    const code = lastCodeFor(familyPhone);
    const wrong = code === "000000" ? "111111" : "000000";
    const session = (value: string) =>
      inject(
        "POST",
        `/public/portal/${clinic.slug}/session`,
        {},
        { phone: familyPhone, code: value },
      );

    expect((await session(wrong)).statusCode).toBe(401);
    expect((await session(code)).statusCode).toBe(200);
    expect((await session(code)).statusCode).toBe(401);
  });

  it("lists every patient on the phone, in this clinic only", async () => {
    const cookie = await signIn(familyPhone);
    const response = await inject("GET", "/public/portal/account", { cookie });
    const account = response.json() as PortalAccount;

    expect(response.statusCode).toBe(200);
    expect(account).toMatchObject({ clinicSlug: clinic.slug, currency: expect.any(String) });
    expect(account.patients.map((patient) => patient.id).sort()).toEqual(
      [motherId, childId].sort(),
    );
  });

  it("shows what the doctor did and what is owed, without the clinic's internal notes", async () => {
    const cookie = await signIn(familyPhone);
    const response = await inject("GET", `/public/portal/patients/${motherId}`, { cookie });
    const record = response.json() as PortalRecord;

    expect(response.statusCode).toBe(200);
    expect(record.treatments).toHaveLength(1);
    expect(record.treatments[0]).toMatchObject({ name: "Composite filling", teeth: [36] });
    expect(record.balance).toEqual({ charged: "60.00", paid: "20.00", balance: "40.00" });
    expect(record.statement.map((entry) => entry.kind)).toEqual(["payment", "charge"]);
    expect(response.body).not.toContain("Paid by the husband");
    expect(record.treatments[0]).not.toHaveProperty("materialCost");
    expect(record.treatments[0]).not.toHaveProperty("notes");
  });

  it("answers 404 for a patient on another phone or in another clinic", async () => {
    const cookie = await signIn(familyPhone);

    for (const id of [strangerId, neighbourPatientId]) {
      expect((await inject("GET", `/public/portal/patients/${id}`, { cookie })).statusCode).toBe(
        404,
      );
    }
  });

  it("signs a short-lived link to the patient's own file only", async () => {
    const file = (patientId: string) =>
      context.db
        .insert(attachments)
        .values({
          clinicId: clinic.id,
          patientId,
          r2Key: `clinic/${clinic.id}/patients/${patientId}/${patientId}-xray.png`,
          filename: "xray.png",
          mime: "image/png",
          sizeBytes: 1024,
        })
        .returning({ id: attachments.id });
    const [own] = await file(motherId);
    const [stranger] = await file(strangerId);
    const cookie = await signIn(familyPhone);
    const link = (patientId: string, attachmentId: string) =>
      inject("GET", `/public/portal/patients/${patientId}/attachments/${attachmentId}/link`, {
        cookie,
      });

    const record = (
      await inject("GET", `/public/portal/patients/${motherId}`, { cookie })
    ).json() as PortalRecord;

    expect(record.attachments.map((entry) => entry.id)).toEqual([own!.id]);
    expect(record.attachments[0]).not.toHaveProperty("r2Key");
    expect(record.attachments[0]).not.toHaveProperty("key");
    expect(record.attachments[0]?.previewUrl).toEqual(expect.any(String));
    expect((await link(motherId, own!.id)).json()).toMatchObject({ url: expect.any(String) });
    expect((await link(motherId, stranger!.id)).statusCode).toBe(404);
    expect((await link(strangerId, stranger!.id)).statusCode).toBe(404);
  });

  it("needs a session", async () => {
    expect((await inject("GET", "/public/portal/account")).statusCode).toBe(401);
    expect(
      (await inject("GET", "/public/portal/account", { cookie: `${PORTAL_COOKIE_NAME}=forged` }))
        .statusCode,
    ).toBe(401);
    expect((await inject("GET", `/public/portal/patients/${motherId}`, admin)).statusCode).toBe(
      401,
    );
  });

  it("locks a code after too many wrong tries", async () => {
    const phone = uniquePhone();
    await createPatient(context, await context.login(clinic.phones[USER_ROLE.ADMIN]), {
      firstName: "Sami",
      lastName: "Nasser",
      phone,
    });

    await inject("POST", `/public/portal/${clinic.slug}/code`, {}, { phone });
    const code = lastCodeFor(phone);
    const wrong = code === "000000" ? "111111" : "000000";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await inject("POST", `/public/portal/${clinic.slug}/session`, {}, { phone, code: wrong });
    }

    const response = await inject(
      "POST",
      `/public/portal/${clinic.slug}/session`,
      {},
      {
        phone,
        code,
      },
    );

    expect(response.statusCode).toBe(401);
  });

  it("ends the session on sign-out", async () => {
    const cookie = await signIn(familyPhone);

    expect((await inject("DELETE", "/public/portal/session", { cookie })).statusCode).toBe(204);
    expect((await inject("GET", "/public/portal/account", { cookie })).statusCode).toBe(401);
  });

  it("closes open sessions when the clinic switches the account off", async () => {
    const neighbourAdmin = auth(await context.login(neighbour.phones[USER_ROLE.ADMIN]));
    const cookie = await signIn(familyPhone, neighbour.slug);

    expect((await inject("GET", "/public/portal/account", { cookie })).statusCode).toBe(200);

    await publish(
      neighbourAdmin,
      SITE_SECTIONS.filter((section) => section !== SITE_SECTION.PORTAL),
    );

    expect((await inject("GET", "/public/portal/account", { cookie })).statusCode).toBe(401);
  });
});
