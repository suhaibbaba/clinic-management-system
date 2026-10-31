import { createHmac } from "node:crypto";
import { USER_ROLE, WHATSAPP_STATUS } from "@clinic/shared";
import { and, eq } from "drizzle-orm";
import { whatsAppChecks } from "@api/database/schema";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

const AUTH_TOKEN = "test-twilio-auth-token";
const CALLBACK_URL = "https://api.example.test/public/twilio/status";

process.env["TWILIO_AUTH_TOKEN"] = AUTH_TOKEN;
process.env["TWILIO_STATUS_CALLBACK_URL"] = CALLBACK_URL;

const mobile = (): string =>
  `+9705${String(Math.floor(Math.random() * 100_000_000)).padStart(8, "0")}`;

const signatureOf = (params: Record<string, string>): string =>
  createHmac("sha1", AUTH_TOKEN)
    .update(
      Object.keys(params)
        .sort()
        .reduce((joined, key) => `${joined}${key}${params[key]}`, CALLBACK_URL),
    )
    .digest("base64");

describe("Twilio delivery statuses", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let receptionistToken: string;

  const rowOf = async (phone: string) => {
    const [row] = await context.db
      .select()
      .from(whatsAppChecks)
      .where(and(eq(whatsAppChecks.clinicId, clinic.id), eq(whatsAppChecks.phone, phone)));

    return row;
  };

  const sentWith = async (sid: string): Promise<string> => {
    const phone = mobile();

    expect(
      (
        await context.app.inject({
          method: "POST",
          url: "/whatsapp-checks",
          headers: auth(receptionistToken),
          payload: { phone },
        })
      ).statusCode,
    ).toBe(200);

    await context.db
      .update(whatsAppChecks)
      .set({ providerMessageId: sid })
      .where(and(eq(whatsAppChecks.clinicId, clinic.id), eq(whatsAppChecks.phone, phone)));

    return phone;
  };

  const report = (params: Record<string, string>, signature?: string) =>
    context.app.inject({
      method: "POST",
      url: "/public/twilio/status",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": signature ?? signatureOf(params),
      },
      payload: new URLSearchParams(params).toString(),
    });

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();
    receptionistToken = await context.login(clinic.phones[USER_ROLE.RECEPTIONIST]);
  });

  afterAll(async () => {
    await context.close();
  });

  it("refuses an unsigned status", async () => {
    const sid = `SMunsigned${Date.now()}`;
    const phone = await sentWith(sid);
    const response = await report({ MessageSid: sid, MessageStatus: "delivered" }, "forged=");

    expect(response.statusCode).toBe(403);
    expect((await rowOf(phone))?.status).toBe(WHATSAPP_STATUS.UNKNOWN);
  });

  it("maps statuses, and a later failure never undoes a delivery", async () => {
    const reached = `SMreached${Date.now()}`;
    const missing = `SMmissing${Date.now()}`;
    const broken = `SMbroken${Date.now()}`;
    const reachedPhone = await sentWith(reached);
    const missingPhone = await sentWith(missing);
    const brokenPhone = await sentWith(broken);

    expect((await report({ MessageSid: reached, MessageStatus: "sent" })).statusCode).toBe(204);
    await report({ MessageSid: missing, MessageStatus: "undelivered", ErrorCode: "63024" });
    await report({ MessageSid: broken, MessageStatus: "failed", ErrorCode: "63016" });
    await report({ MessageSid: reached, MessageStatus: "failed", ErrorCode: "63016" });

    expect((await rowOf(reachedPhone))?.status).toBe(WHATSAPP_STATUS.AVAILABLE);
    expect((await rowOf(missingPhone))?.status).toBe(WHATSAPP_STATUS.UNAVAILABLE);
    expect((await rowOf(brokenPhone))?.status).toBe(WHATSAPP_STATUS.ERROR);
  });

  it("ignores a status that settles nothing", async () => {
    const sid = `SMqueued${Date.now()}`;
    const phone = await sentWith(sid);

    expect((await report({ MessageSid: sid, MessageStatus: "queued" })).statusCode).toBe(204);
    expect((await rowOf(phone))?.status).toBe(WHATSAPP_STATUS.UNKNOWN);
  });
});
