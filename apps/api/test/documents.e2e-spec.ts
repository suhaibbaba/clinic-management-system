import {
  NOTIFICATION_STATUS,
  NOTIFICATION_TEMPLATE,
  PAYMENT_METHOD,
  PERFORMED_PROCEDURE_STATUS,
  USER_ROLE,
  type DocumentDelivery,
  type Payment,
} from "@clinic/shared";
import { and, eq } from "drizzle-orm";
import { notificationsLog } from "@api/database/schema";
import {
  createPatient,
  nameParts,
  procedurePayload,
  seedClinicFixtures,
  uniquePhone,
  type PatientFixtures,
} from "@test/helpers/patient-fixtures";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

describe("Documents", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let other: TestClinic;
  let fixtures: PatientFixtures;
  let adminToken: string;
  let doctorToken: string;
  let receptionistToken: string;
  let otherAdminToken: string;
  let patientId: string;
  let payment: Payment;

  const recipient = "+962790000123";

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();
    other = await context.createClinic();

    adminToken = await context.login(clinic.phones[USER_ROLE.ADMIN]);
    doctorToken = await context.login(clinic.phones[USER_ROLE.DOCTOR]);
    receptionistToken = await context.login(clinic.phones[USER_ROLE.RECEPTIONIST]);
    otherAdminToken = await context.login(other.phones[USER_ROLE.ADMIN]);

    fixtures = await seedClinicFixtures(context, clinic, adminToken);
    patientId = await createPatient(context, adminToken, {
      ...nameParts("سامي الأحمد"),
      phone: uniquePhone(),
    });

    const planned = await context.app.inject({
      method: "POST",
      url: "/performed-procedures",
      headers: auth(doctorToken),
      payload: {
        ...procedurePayload({
          patientId,
          doctorId: fixtures.doctorId,
          procedureId: fixtures.catalogId,
          tooth: 11,
        }),
        status: PERFORMED_PROCEDURE_STATUS.PLANNED,
        price: "250.00",
      },
    });

    expect(planned.statusCode).toBe(201);

    const done = await context.app.inject({
      method: "POST",
      url: "/performed-procedures",
      headers: auth(doctorToken),
      payload: {
        ...procedurePayload({
          patientId,
          doctorId: fixtures.doctorId,
          procedureId: fixtures.catalogId,
          tooth: 12,
        }),
        price: "100.00",
      },
    });

    expect(done.statusCode).toBe(201);

    const paid = await context.app.inject({
      method: "POST",
      url: "/payments",
      headers: auth(receptionistToken),
      payload: { patientId, amount: "40.00", method: PAYMENT_METHOD.CASH },
    });

    expect(paid.statusCode).toBe(201);
    payment = paid.json() as Payment;
  });

  afterAll(async () => {
    await context.close();
  });

  const isPdf = (payload: Buffer): boolean => payload.subarray(0, 5).toString("latin1") === "%PDF-";

  describe("printing", () => {
    it("renders the treatment plan for a clinical role", async () => {
      const response = await context.app.inject({
        method: "GET",
        url: `/patients/${patientId}/treatment-plan.pdf`,
        headers: auth(doctorToken),
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/pdf");
      expect(isPdf(response.rawPayload)).toBe(true);
    });

    it("keeps the treatment plan from a receptionist", async () => {
      const response = await context.app.inject({
        method: "GET",
        url: `/patients/${patientId}/treatment-plan.pdf`,
        headers: auth(receptionistToken),
      });

      expect(response.statusCode).toBe(403);
    });

    it("answers 404 for another clinic's patient", async () => {
      const response = await context.app.inject({
        method: "GET",
        url: `/patients/${patientId}/treatment-plan.pdf`,
        headers: auth(otherAdminToken),
      });

      expect(response.statusCode).toBe(404);
    });

    it("renders a doctor's settlement for the admin only", async () => {
      const url = `/doctors/${fixtures.doctorId}/settlement/print?from=2026-01-01&to=2026-12-31`;

      const admin = await context.app.inject({ method: "GET", url, headers: auth(adminToken) });

      expect(admin.statusCode).toBe(200);
      expect(isPdf(admin.rawPayload)).toBe(true);

      const doctor = await context.app.inject({ method: "GET", url, headers: auth(doctorToken) });

      expect(doctor.statusCode).toBe(403);
    });

    it("renders the month's payroll for the admin only", async () => {
      const admin = await context.app.inject({
        method: "GET",
        url: "/payroll/2026-09/print",
        headers: auth(adminToken),
      });

      expect(admin.statusCode).toBe(200);
      expect(isPdf(admin.rawPayload)).toBe(true);

      const receptionist = await context.app.inject({
        method: "GET",
        url: "/payroll/2026-09/print",
        headers: auth(receptionistToken),
      });

      expect(receptionist.statusCode).toBe(403);
    });
  });

  describe("sending on WhatsApp", () => {
    it("says whether the clinic can send documents", async () => {
      const response = await context.app.inject({
        method: "GET",
        url: "/document-delivery",
        headers: auth(receptionistToken),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json<DocumentDelivery>()).toEqual({ available: true });
    });

    it("sends a receipt and logs it against the number", async () => {
      const response = await context.app.inject({
        method: "POST",
        url: `/payments/${payment.id}/receipt/whatsapp`,
        headers: auth(receptionistToken),
        payload: { to: recipient },
      });

      expect(response.statusCode).toBe(204);

      const rows = await context.db
        .select()
        .from(notificationsLog)
        .where(
          and(
            eq(notificationsLog.clinicId, clinic.id),
            eq(notificationsLog.template, NOTIFICATION_TEMPLATE.DOCUMENT),
          ),
        );

      expect(rows).toHaveLength(1);
      expect(rows[0]?.to).toBe(recipient);
      expect(rows[0]?.status).toBe(NOTIFICATION_STATUS.SENT);
      expect(rows[0]?.vars).toEqual({ document: "إيصال قبض", clinic: expect.any(String) });
    });

    it("refuses a number that is not international", async () => {
      const response = await context.app.inject({
        method: "POST",
        url: `/payments/${payment.id}/receipt/whatsapp`,
        headers: auth(receptionistToken),
        payload: { to: "0790000123" },
      });

      expect(response.statusCode).toBe(400);
    });

    it("refuses another clinic's receipt as if it did not exist", async () => {
      const response = await context.app.inject({
        method: "POST",
        url: `/payments/${payment.id}/receipt/whatsapp`,
        headers: auth(otherAdminToken),
        payload: { to: recipient },
      });

      expect(response.statusCode).toBe(404);
    });

    it("holds sending to the same roles as printing", async () => {
      const plan = await context.app.inject({
        method: "POST",
        url: `/patients/${patientId}/treatment-plan/whatsapp`,
        headers: auth(receptionistToken),
        payload: { to: recipient },
      });

      expect(plan.statusCode).toBe(403);

      const payroll = await context.app.inject({
        method: "POST",
        url: "/payroll/2026-09/print/whatsapp",
        headers: auth(doctorToken),
        payload: { to: recipient },
      });

      expect(payroll.statusCode).toBe(403);
    });

    it("sends every document a role may print", async () => {
      const sends = [
        { url: `/patients/${patientId}/statement/whatsapp`, token: receptionistToken },
        { url: `/patients/${patientId}/treatment-plan/whatsapp`, token: doctorToken },
        { url: "/inventory/shopping-list/whatsapp", token: doctorToken },
        { url: "/payroll/2026-09/print/whatsapp", token: adminToken },
        {
          url: `/doctors/${fixtures.doctorId}/settlement/print/whatsapp?from=2026-01-01&to=2026-12-31`,
          token: adminToken,
        },
      ];

      for (const send of sends) {
        const response = await context.app.inject({
          method: "POST",
          url: send.url,
          headers: auth(send.token),
          payload: { to: recipient },
        });

        expect({ url: send.url, status: response.statusCode }).toEqual({
          url: send.url,
          status: 204,
        });
      }
    });
  });
});
