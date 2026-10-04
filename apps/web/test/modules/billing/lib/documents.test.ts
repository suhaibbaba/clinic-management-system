import { describe, expect, it } from "vitest";
import { receiptSource, statementSource } from "@web/modules/billing/lib/documents";
import { authTokens } from "@web/shared/lib/auth-tokens";
import { mockApi } from "@test/helpers/render";

const PAYMENT_ID = "55555555-5555-4555-8555-555555555555";
const PATIENT_ID = "22222222-2222-4222-8222-222222222222";

describe("billing documents", () => {
  it("offers sending only to a role allowed to send", () => {
    expect(receiptSource(PAYMENT_ID, 12, "+962790000123", false).send).toBeUndefined();
    expect(receiptSource(PAYMENT_ID, 12, "+962790000123", true).send).toBeTypeOf("function");
  });

  it("names the receipt file by its number, and fills in the patient's number", () => {
    const source = receiptSource(PAYMENT_ID, 12, "+962790000123", true);

    expect(source.filename).toBe("receipt-12.pdf");
    expect(source.recipient).toBe("+962790000123");
  });

  it("sends the receipt to the number given, not the one it was opened with", async () => {
    authTokens.clear();
    const api = mockApi({
      [`POST /payments/${PAYMENT_ID}/receipt/whatsapp`]: { status: 204 },
    });

    await receiptSource(PAYMENT_ID, 12, "+962790000123", true).send?.("+962790000999");

    expect(api.calls.at(-1)).toMatchObject({
      method: "POST",
      body: { to: "+962790000999" },
    });
  });

  it("sends the statement for the period on screen", async () => {
    authTokens.clear();
    const api = mockApi({
      [`POST /patients/${PATIENT_ID}/statement/whatsapp`]: { status: 204 },
    });

    await statementSource(PATIENT_ID, { from: "2026-09-01T00:00:00.000Z" }, null, true).send?.(
      "+962790000999",
    );

    expect(api.calls.at(-1)?.url).toContain("from=2026-09-01");
  });
});
