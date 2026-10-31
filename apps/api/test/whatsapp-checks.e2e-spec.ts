import { createHmac } from "node:crypto";
import { USER_ROLE, WHATSAPP_STATUS, type WhatsAppCheck } from "@clinic/shared";
import { and, eq } from "drizzle-orm";
import { whatsAppChecks } from "@api/database/schema";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

const APP_SECRET = "test-whatsapp-app-secret";

process.env["WHATSAPP_APP_SECRET"] = APP_SECRET;
process.env["WHATSAPP_WEBHOOK_VERIFY_TOKEN"] = "test-verify-token";

const mobile = (): string =>
  `+9705${String(Math.floor(Math.random() * 100_000_000)).padStart(8, "0")}`;

describe("WhatsApp checks", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let other: TestClinic;
  let receptionistToken: string;
  let otherAdminToken: string;

  const check = (token: string, phone: string) =>
    context.app.inject({
      method: "POST",
      url: "/whatsapp-checks",
      headers: auth(token),
      payload: { phone },
    });

  const rowOf = async (clinicId: string, phone: string) => {
    const [row] = await context.db
      .select()
      .from(whatsAppChecks)
      .where(and(eq(whatsAppChecks.clinicId, clinicId), eq(whatsAppChecks.phone, phone)));

    return row;
  };

  const deliver = (
    statuses: readonly { id: string; status: string; errors?: { code: number }[] }[],
    signature?: string,
  ) => {
    const payload = JSON.stringify({ entry: [{ changes: [{ value: { statuses } }] }] });

    return context.app.inject({
      method: "POST",
      url: "/public/whatsapp/webhook",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256":
          signature ?? `sha256=${createHmac("sha256", APP_SECRET).update(payload).digest("hex")}`,
      },
      payload,
    });
  };

  const sentWith = async (messageId: string): Promise<string> => {
    const phone = mobile();

    expect((await check(receptionistToken, phone)).statusCode).toBe(200);

    await context.db
      .update(whatsAppChecks)
      .set({ providerMessageId: messageId })
      .where(and(eq(whatsAppChecks.clinicId, clinic.id), eq(whatsAppChecks.phone, phone)));

    return phone;
  };

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();
    other = await context.createClinic();
    receptionistToken = await context.login(clinic.phones[USER_ROLE.RECEPTIONIST]);
    otherAdminToken = await context.login(other.phones[USER_ROLE.ADMIN]);
  });

  afterAll(async () => {
    await context.close();
  });

  it("refuses a number that is not a mobile", async () => {
    const response = await check(receptionistToken, "+97022123456");

    expect(response.statusCode).toBe(400);
    expect(await rowOf(clinic.id, "+97022123456")).toBeUndefined();
  });

  it("sends once for the same number while the first check is in flight", async () => {
    const phone = mobile();
    const first = await check(receptionistToken, phone);

    expect(first.json<WhatsAppCheck>()).toMatchObject({
      phone,
      status: WHATSAPP_STATUS.UNKNOWN,
      checking: true,
    });

    const sent = await rowOf(clinic.id, phone);

    expect(sent?.codeHash).toEqual(expect.any(String));

    const second = await check(receptionistToken, phone.replace("+970", "00970"));

    expect(second.json<WhatsAppCheck>()).toMatchObject({ phone, checking: true });
    expect((await rowOf(clinic.id, phone))?.sentAt).toEqual(sent?.sentAt);
  });

  it("keeps a check inside its clinic", async () => {
    const phone = await sentWith(`wamid.scope.${Date.now()}`);
    const response = await context.app.inject({
      method: "GET",
      url: `/whatsapp-checks?phone=${encodeURIComponent(phone)}`,
      headers: auth(otherAdminToken),
    });

    expect(response.json<WhatsAppCheck>()).toMatchObject({
      status: WHATSAPP_STATUS.UNKNOWN,
      checking: false,
    });
  });

  it("refuses an unsigned delivery", async () => {
    const id = `wamid.unsigned.${Date.now()}`;
    const phone = await sentWith(id);
    const response = await deliver([{ id, status: "sent" }], "sha256=forged");

    expect(response.statusCode).toBe(403);
    expect((await rowOf(clinic.id, phone))?.status).toBe(WHATSAPP_STATUS.UNKNOWN);
  });

  it("maps deliveries to a status, and a later failure never undoes a delivery", async () => {
    const reached = `wamid.sent.${Date.now()}`;
    const missing = `wamid.missing.${Date.now()}`;
    const broken = `wamid.broken.${Date.now()}`;
    const reachedPhone = await sentWith(reached);
    const missingPhone = await sentWith(missing);
    const brokenPhone = await sentWith(broken);

    expect(
      (
        await deliver([
          { id: reached, status: "sent" },
          { id: missing, status: "failed", errors: [{ code: 131026 }] },
          { id: broken, status: "failed", errors: [{ code: 132001 }] },
        ])
      ).statusCode,
    ).toBe(200);

    await deliver([{ id: reached, status: "failed", errors: [{ code: 132001 }] }]);
    await deliver([{ id: reached, status: "delivered" }]);

    expect((await rowOf(clinic.id, reachedPhone))?.status).toBe(WHATSAPP_STATUS.AVAILABLE);
    expect((await rowOf(clinic.id, missingPhone))?.status).toBe(WHATSAPP_STATUS.UNAVAILABLE);
    expect((await rowOf(clinic.id, brokenPhone))?.status).toBe(WHATSAPP_STATUS.ERROR);
  });

  it("answers a settled number from its last check without sending again", async () => {
    const id = `wamid.settled.${Date.now()}`;
    const phone = await sentWith(id);

    await deliver([{ id, status: "read" }]);

    const before = await rowOf(clinic.id, phone);
    const again = await check(receptionistToken, phone);

    expect(again.json<WhatsAppCheck>()).toMatchObject({
      status: WHATSAPP_STATUS.AVAILABLE,
      checking: false,
    });
    expect((await rowOf(clinic.id, phone))?.sentAt).toEqual(before?.sentAt);
  });
});
