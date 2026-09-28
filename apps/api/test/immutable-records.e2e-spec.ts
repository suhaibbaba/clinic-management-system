import { PAYMENT_METHOD, USER_ROLE } from "@clinic/shared";
import { sql } from "drizzle-orm";
import { payments } from "@api/database/schema";
import { createPatient, nameParts, uniquePhone } from "@test/helpers/patient-fixtures";
import { createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

describe("records the database itself keeps (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let paymentId: string;
  let patientId: string;

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();
    const admin = await context.login(clinic.phones[USER_ROLE.ADMIN]);

    patientId = await createPatient(context, admin, {
      ...nameParts("سجل ثابت"),
      phone: uniquePhone(),
    });

    const [payment] = await context.db
      .insert(payments)
      .values({ clinicId: clinic.id, patientId, amount: "50.00", method: PAYMENT_METHOD.CASH })
      .returning({ id: payments.id });
    paymentId = payment?.id ?? "";
  });

  afterAll(async () => {
    await context.close();
  });

  const refused = (statement: ReturnType<typeof sql>) =>
    expect(context.db.execute(statement)).rejects.toThrow();

  it("never lets anyone rewrite or remove an audit entry", async () => {
    await refused(sql`update audit_log set entity = entity where clinic_id = ${clinic.id}`);
    await refused(sql`delete from audit_log where clinic_id = ${clinic.id}`);
  });

  it("keeps a payment's amount and date, and a reversal once made", async () => {
    await refused(sql`update payments set amount = amount + 1 where id = ${paymentId}`);
    await refused(
      sql`update payments set created_at = now() - interval '1 day' where id = ${paymentId}`,
    );

    await context.db.execute(sql`update payments set reversed_at = now() where id = ${paymentId}`);
    await refused(sql`update payments set reversed_at = null where id = ${paymentId}`);
  });

  it("never hard-deletes a medical or financial row", async () => {
    await refused(sql`delete from patients where id = ${patientId}`);
    await refused(sql`delete from payments where id = ${paymentId}`);
  });
});
