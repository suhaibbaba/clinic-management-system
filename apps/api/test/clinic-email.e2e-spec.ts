import { randomUUID } from "node:crypto";
import { USER_ROLE, VENDOR_SECRET_KIND } from "@clinic/shared";
import { eq } from "drizzle-orm";
import { clinics, users } from "@api/database/schema";
import { EMAIL_PROVIDER } from "@api/modules/email/constants";
import { type EmailProvider, type OutboundEmail } from "@api/modules/email/lib/email-provider";
import { SecretsService } from "@api/modules/secrets/services/secrets.service";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

const resendKeys: string[] = [];
const resendSends: { from: string; to: string[]; text: string }[] = [];

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation((key: string) => {
    resendKeys.push(key);

    return {
      emails: {
        send: (message: { from: string; to: string[]; text: string }) => {
          resendSends.push(message);
          return Promise.resolve({ error: null });
        },
      },
    };
  }),
}));

describe("A clinic's own email sender (e2e)", () => {
  let context: TestContext;
  let serverSent: OutboundEmail[];

  beforeAll(async () => {
    context = await createTestContext();
  });

  afterAll(async () => {
    await context.close();
  });

  beforeEach(() => {
    resendKeys.length = 0;
    resendSends.length = 0;
    serverSent = [];
    jest
      .spyOn(context.app.get<EmailProvider>(EMAIL_PROVIDER), "send")
      .mockImplementation((email) => {
        serverSent.push(email);
        return Promise.resolve();
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const sendOwnReset = async (clinic: TestClinic) =>
    context.app.inject({
      method: "POST",
      url: `/users/${clinic.userIds[USER_ROLE.RECEPTIONIST]}/send-password-reset`,
      headers: auth(await context.login(clinic.phones[USER_ROLE.RECEPTIONIST])),
      payload: {},
    });

  const emailOf = async (userId: string) =>
    (await context.db.select({ email: users.email }).from(users).where(eq(users.id, userId)))[0]
      ?.email;

  it("sends through the clinic's Resend account, linking to its dashboard domain", async () => {
    const clinic = await context.createClinic();
    const host = `admin.mail-${randomUUID().slice(0, 8)}.example.ps`;

    await context.db
      .update(clinics)
      .set({ appDomain: host, emailFrom: "Clinic <no-reply@mail.example.ps>" })
      .where(eq(clinics.id, clinic.id));
    await context.app
      .get(SecretsService)
      .storeVendorSecret(context.db, clinic.id, VENDOR_SECRET_KIND.RESEND_API_KEY, "re_clinic_key");

    expect((await sendOwnReset(clinic)).statusCode).toBe(204);

    expect(resendKeys).toEqual(["re_clinic_key"]);
    expect(resendSends).toHaveLength(1);
    expect(resendSends[0]?.from).toMatch(/<no-reply@mail\.example\.ps>$/);
    expect(resendSends[0]?.to).toEqual([await emailOf(clinic.userIds[USER_ROLE.RECEPTIONIST])]);
    expect(resendSends[0]?.text).toContain(`https://${host}/reset/`);
    expect(serverSent).toEqual([]);
  });

  it("falls back to the server's sender and address without the clinic's own", async () => {
    const clinic = await context.createClinic();

    await context.db
      .update(clinics)
      .set({ emailFrom: "Clinic <no-reply@mail.example.ps>" })
      .where(eq(clinics.id, clinic.id));

    expect((await sendOwnReset(clinic)).statusCode).toBe(204);

    expect(resendSends).toEqual([]);
    expect(serverSent).toHaveLength(1);
    expect(serverSent[0]?.text).toContain("http://localhost:5173/reset/");
  });
});
