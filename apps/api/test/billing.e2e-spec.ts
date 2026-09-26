import {
  PAYMENT_ERROR,
  PAYMENT_METHOD,
  PERFORMED_PROCEDURE_STATUS,
  USER_ROLE,
  type Paginated,
  type PatientBalance,
  type Payment,
  type PerformedProcedure,
  type Statement,
} from "@clinic/shared";
import { and, eq, isNull } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { charges } from "@api/database/schema";
import {
  createPatient,
  procedurePayload,
  seedClinicFixtures,
  uniquePhone,
  type PatientFixtures,
  nameParts,
} from "@test/helpers/patient-fixtures";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

describe("Billing", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let fixtures: PatientFixtures;
  let adminToken: string;
  let doctorToken: string;
  let receptionistToken: string;
  let technicianToken: string;

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    adminToken = await context.login(clinic.phones[USER_ROLE.ADMIN]);
    doctorToken = await context.login(clinic.phones[USER_ROLE.DOCTOR]);
    receptionistToken = await context.login(clinic.phones[USER_ROLE.RECEPTIONIST]);
    technicianToken = await context.login(clinic.phones[USER_ROLE.TECHNICIAN]);

    fixtures = await seedClinicFixtures(context, clinic, adminToken);
  });

  afterAll(async () => {
    await context.close();
  });

  const newPatient = async (): Promise<string> =>
    createPatient(context, adminToken, { ...nameParts("سامي الأحمد"), phone: uniquePhone() });

  const recordProcedure = async (
    patientId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<PerformedProcedure> => {
    const response = await context.app.inject({
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
        ...overrides,
      },
    });

    expect(response.statusCode).toBe(201);

    return response.json() as PerformedProcedure;
  };

  const balanceOf = async (patientId: string, token = adminToken): Promise<PatientBalance> => {
    const response = await context.app.inject({
      method: "GET",
      url: `/patients/${patientId}/balance`,
      headers: auth(token),
    });

    expect(response.statusCode).toBe(200);

    return response.json() as PatientBalance;
  };

  const pay = async (
    patientId: string,
    amount: string,
    token = receptionistToken,
  ): Promise<Payment> => {
    const response = await context.app.inject({
      method: "POST",
      url: "/payments",
      headers: auth(token),
      payload: { patientId, amount, method: PAYMENT_METHOD.CASH },
    });

    expect(response.statusCode).toBe(201);

    return response.json() as Payment;
  };

  describe("balance", () => {
    it("is sum(charges) − sum(payments), reversals included", async () => {
      const patientId = await newPatient();

      await recordProcedure(patientId, { price: "150.00" });
      expect((await balanceOf(patientId)).balance).toBe("150.00");

      await pay(patientId, "50.00");
      expect((await balanceOf(patientId)).balance).toBe("100.00");

      const reversed = await pay(patientId, "30.00");
      expect((await balanceOf(patientId)).balance).toBe("70.00");

      const reversal = await context.app.inject({
        method: "POST",
        url: `/payments/${reversed.id}/reverse`,
        headers: auth(adminToken),
        payload: { reason: "Recorded against the wrong patient" },
      });

      expect(reversal.statusCode).toBe(201);
      expect((reversal.json() as Payment).amount).toBe("-30.00");

      // Back to where it was: the reversal is an ordinary negative row in the
      // same sum, and the original payment is still there to be read.
      const after = await balanceOf(patientId);
      expect(after.balance).toBe("100.00");
      expect(after.charged).toBe("150.00");
      expect(after.paid).toBe("50.00");
    });

    it("nets a discount off the charge", async () => {
      const patientId = await newPatient();

      await recordProcedure(patientId, {
        price: "200.00",
        discount: "25.00",
        discountReason: "Family rate",
      });

      expect((await balanceOf(patientId)).balance).toBe("175.00");
    });

    it("is only raised by work that has started", async () => {
      const patientId = await newPatient();

      const procedure = await recordProcedure(patientId, {
        price: "90.00",
        status: PERFORMED_PROCEDURE_STATUS.PLANNED,
      });

      expect((await balanceOf(patientId)).balance).toBe("0.00");

      const update = await context.app.inject({
        method: "PATCH",
        url: `/performed-procedures/${procedure.id}`,
        headers: auth(doctorToken),
        payload: { status: PERFORMED_PROCEDURE_STATUS.DONE },
      });

      expect(update.statusCode).toBe(200);
      expect((await balanceOf(patientId)).balance).toBe("90.00");
    });

    it("rides along in the patient header, and never for a technician", async () => {
      const patientId = await newPatient();
      await recordProcedure(patientId, { price: "120.00" });

      const forReception = await context.app.inject({
        method: "GET",
        url: `/patients/${patientId}`,
        headers: auth(receptionistToken),
      });

      expect(forReception.statusCode).toBe(200);
      expect(forReception.json()).toMatchObject({ balance: "120.00" });

      const forTechnician = await context.app.inject({
        method: "GET",
        url: `/patients/${patientId}`,
        headers: auth(technicianToken),
      });

      expect(forTechnician.statusCode).toBe(200);
      expect(forTechnician.json()).not.toHaveProperty("balance");
    });
  });

  describe("corrections", () => {
    it("re-prices a procedure by reversal, never by editing the charge", async () => {
      const patientId = await newPatient();
      const procedure = await recordProcedure(patientId, { price: "100.00" });

      const original = await context.db
        .select()
        .from(charges)
        .where(eq(charges.performedProcedureId, procedure.id));

      expect(original).toHaveLength(1);
      expect(original[0]?.amount).toBe("100.00");

      const update = await context.app.inject({
        method: "PATCH",
        url: `/performed-procedures/${procedure.id}`,
        headers: auth(doctorToken),
        payload: { price: "130.00" },
      });

      expect(update.statusCode).toBe(200);

      const rows = await context.db
        .select()
        .from(charges)
        .where(eq(charges.performedProcedureId, procedure.id));

      // Three rows, not one edited row: the original untouched, its reversal,
      // and the corrected charge.
      expect(rows).toHaveLength(3);
      expect(rows.find((row) => row.id === original[0]?.id)?.amount).toBe("100.00");
      expect(rows.filter((row) => row.reversesId !== null).map((row) => row.amount)).toEqual([
        "-100.00",
      ]);
      expect((await balanceOf(patientId)).balance).toBe("130.00");
    });

    it("reverses the charge when a procedure is soft-deleted", async () => {
      const patientId = await newPatient();
      const procedure = await recordProcedure(patientId, { price: "75.00" });

      const removal = await context.app.inject({
        method: "DELETE",
        url: `/performed-procedures/${procedure.id}`,
        headers: auth(adminToken),
      });

      expect(removal.statusCode).toBe(204);
      expect((await balanceOf(patientId)).balance).toBe("0.00");

      // Reversed, not deleted: both rows are still live and readable.
      const rows = await context.db
        .select()
        .from(charges)
        .where(and(eq(charges.performedProcedureId, procedure.id), isNull(charges.deletedAt)));

      expect(rows).toHaveLength(2);
    });

    it("leaves no orphan charge when the procedure insert fails", async () => {
      const patientId = await newPatient();
      const before = await context.db
        .select()
        .from(charges)
        .where(eq(charges.patientId, patientId));

      // The mark is rejected after the row would have been written, which is exactly the window a
      // charge outside the transaction would leak through.
      const response = await context.app.inject({
        method: "POST",
        url: "/performed-procedures",
        headers: auth(doctorToken),
        payload: {
          patientId,
          doctorId: fixtures.doctorId,
          procedureId: fixtures.catalogId,
          price: "10.00",
          chartMarks: [{ chartType: "body_region", location: { region: "knee", side: "left" } }],
        },
      });

      expect(response.statusCode).toBe(400);

      const after = await context.db.select().from(charges).where(eq(charges.patientId, patientId));

      expect(after).toHaveLength(before.length);
      expect((await balanceOf(patientId)).balance).toBe("0.00");
    });
  });

  describe("payments", () => {
    it("numbers receipts without gaps under concurrent writes", async () => {
      const patientId = await newPatient();
      await recordProcedure(patientId, { price: "100.00" });

      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          context.app.inject({
            method: "POST",
            url: "/payments",
            headers: auth(receptionistToken),
            payload: { patientId, amount: "10.00", method: PAYMENT_METHOD.CARD },
          }),
        ),
      );

      const numbers = results
        .map((response) => (response.json() as Payment).receiptNumber ?? 0)
        .sort((left, right) => left - right);

      expect(results.every((response) => response.statusCode === 201)).toBe(true);
      expect(new Set(numbers).size).toBe(numbers.length);
      expect(numbers.at(-1)! - numbers[0]!).toBe(numbers.length - 1);
    });

    it("refuses more than the patient owes, and lets them settle it exactly", async () => {
      const patientId = await newPatient();
      await recordProcedure(patientId, { price: "100.00" });

      const over = await context.app.inject({
        method: "POST",
        url: "/payments",
        headers: auth(receptionistToken),
        payload: { patientId, amount: "101.00", method: PAYMENT_METHOD.CASH },
      });

      expect(over.statusCode).toBe(409);
      expect(over.json()).toMatchObject({ message: PAYMENT_ERROR.EXCEEDS_BALANCE });

      await pay(patientId, "100.00");
      expect((await balanceOf(patientId)).balance).toBe("0.00");
    });

    it("lets an admin delete a payment: off the balance, kept on the admin's statement only", async () => {
      const patientId = await newPatient();
      await recordProcedure(patientId, { price: "100.00" });
      const payment = await pay(patientId, "40.00");

      const removal = await context.app.inject({
        method: "DELETE",
        url: `/payments/${payment.id}`,
        headers: auth(adminToken),
      });

      expect(removal.statusCode).toBe(204);
      expect((await balanceOf(patientId)).balance).toBe("100.00");

      const statementFor = async (token: string): Promise<Statement> => {
        const response = await context.app.inject({
          method: "GET",
          url: `/patients/${patientId}/statement`,
          headers: auth(token),
        });
        expect(response.statusCode).toBe(200);
        return response.json() as Statement;
      };

      const asAdmin = await statementFor(adminToken);
      const deleted = asAdmin.entries.find((entry) => entry.id === payment.id);

      expect(deleted?.deletedAt).toBeDefined();
      expect(deleted?.deletedBy).toMatchObject({ ar: expect.any(String), en: expect.any(String) });
      expect(deleted?.runningBalance).toBe("100.00");
      expect(asAdmin.closingBalance).toBe("100.00");

      // ROLES.md rule 4: a deleted row is the admin's to see, and absent for anyone else.
      const asReceptionist = await statementFor(receptionistToken);
      expect(asReceptionist.entries.map((entry) => entry.id)).not.toContain(payment.id);
      expect(asReceptionist.entries.every((entry) => entry.deletedAt === undefined)).toBe(true);
    });

    it("refuses to delete a reversed payment, or its reversal", async () => {
      const patientId = await newPatient();
      await recordProcedure(patientId, { price: "100.00" });
      const payment = await pay(patientId, "25.00");

      const reversal = await context.app.inject({
        method: "POST",
        url: `/payments/${payment.id}/reverse`,
        headers: auth(adminToken),
        payload: { reason: "Entered twice" },
      });
      expect(reversal.statusCode).toBe(201);

      for (const id of [payment.id, (reversal.json() as Payment).id]) {
        const removal = await context.app.inject({
          method: "DELETE",
          url: `/payments/${id}`,
          headers: auth(adminToken),
        });

        expect(removal.statusCode).toBe(409);
        expect(removal.json()).toMatchObject({ message: PAYMENT_ERROR.REVERSED });
      }
    });

    it("refuses to reverse the same payment twice", async () => {
      const patientId = await newPatient();
      await recordProcedure(patientId, { price: "100.00" });
      const payment = await pay(patientId, "20.00");

      const first = await context.app.inject({
        method: "POST",
        url: `/payments/${payment.id}/reverse`,
        headers: auth(adminToken),
        payload: { reason: "Duplicate entry" },
      });
      const second = await context.app.inject({
        method: "POST",
        url: `/payments/${payment.id}/reverse`,
        headers: auth(adminToken),
        payload: { reason: "Duplicate entry" },
      });

      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(400);
    });

    it("gives a receptionist create and read, and nothing else", async () => {
      const patientId = await newPatient();
      await recordProcedure(patientId, { price: "100.00" });
      const payment = await pay(patientId, "15.00");

      const list = await context.app.inject({
        method: "GET",
        url: `/payments?patientId=${patientId}`,
        headers: auth(receptionistToken),
      });

      expect(list.statusCode).toBe(200);
      expect((list.json() as Paginated<Payment>).total).toBe(1);

      // ROLES.md: "receptionist updating or deleting a payment → 403".
      const reversal = await context.app.inject({
        method: "POST",
        url: `/payments/${payment.id}/reverse`,
        headers: auth(receptionistToken),
        payload: { reason: "Should not be allowed" },
      });
      const removal = await context.app.inject({
        method: "DELETE",
        url: `/payments/${payment.id}`,
        headers: auth(receptionistToken),
        payload: { reason: "Should not be allowed" },
      });

      expect(reversal.statusCode).toBe(403);
      expect(removal.statusCode).toBe(403);
    });

    it("keeps a technician away from the money entirely", async () => {
      const patientId = await newPatient();

      const attempts = await Promise.all([
        context.app.inject({ method: "GET", url: "/payments", headers: auth(technicianToken) }),
        context.app.inject({
          method: "GET",
          url: `/patients/${patientId}/balance`,
          headers: auth(technicianToken),
        }),
        context.app.inject({
          method: "GET",
          url: "/billing/overdue",
          headers: auth(technicianToken),
        }),
      ]);

      expect(attempts.map((response) => response.statusCode)).toEqual([403, 403, 403]);
    });
  });

  describe("statement", () => {
    it("runs a balance down the entries and names the procedure only", async () => {
      const patientId = await newPatient();
      await recordProcedure(patientId, { price: "100.00" });
      await pay(patientId, "40.00");

      const response = await context.app.inject({
        method: "GET",
        url: `/patients/${patientId}/statement`,
        headers: auth(receptionistToken),
      });

      expect(response.statusCode).toBe(200);

      const statement = response.json() as Statement;

      expect(statement.entries.map((entry) => entry.runningBalance)).toEqual(["100.00", "60.00"]);
      expect(statement.closingBalance).toBe("60.00");
      // The catalog name, and nothing clinical alongside it.
      expect(statement.entries[0]?.description).toBe("Composite filling");
    });

    it("renders a PDF with the Arabic text embedded", async () => {
      const patientId = await newPatient();
      await recordProcedure(patientId, { price: "100.00" });

      const response = await context.app.inject({
        method: "GET",
        url: `/patients/${patientId}/statement.pdf`,
        headers: auth(receptionistToken),
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/pdf");

      const pdf = response.rawPayload;

      expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
      expect(pdf.subarray(-6).toString("latin1")).toContain("%%EOF");

      const document = await PDFDocument.load(pdf);
      const names = document.context
        .enumerateIndirectObjects()
        .map(([, value]) => String(value))
        .join(" ");

      // The app's own face, embedded, with the fallback that carries the shekel sign.
      expect(names).toContain("Tajawal");
      expect(names).toContain("Alef");
      expect(names).toContain("CIDFontType2");
    });

    it("prints a receipt for every payment", async () => {
      const patientId = await newPatient();
      await recordProcedure(patientId, { price: "100.00" });
      const payment = await pay(patientId, "35.00");

      const response = await context.app.inject({
        method: "GET",
        url: `/payments/${payment.id}/receipt`,
        headers: auth(receptionistToken),
      });

      expect(response.statusCode).toBe(200);
      expect(response.rawPayload.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    });
  });

  describe("overdue", () => {
    it("lists debtors who have not paid inside the window", async () => {
      const owing = await newPatient();
      const paid = await newPatient();

      await recordProcedure(owing, { price: "300.00" });
      await recordProcedure(paid, { price: "80.00" });
      await pay(paid, "80.00");

      // `afterDays` of one day means everything charged today counts, since the
      // owing patient has never paid at all.
      const response = await context.app.inject({
        method: "GET",
        url: "/billing/overdue?afterDays=1&limit=100",
        headers: auth(receptionistToken),
      });

      expect(response.statusCode).toBe(200);

      const page = response.json() as Paginated<{ patientId: string; balance: string }>;
      const ids = page.items.map((item) => item.patientId);

      expect(ids).toContain(owing);
      expect(ids).not.toContain(paid);
      expect(page.items.find((item) => item.patientId === owing)?.balance).toBe("300.00");
    });
  });

  // A server-side filter because a balance is an aggregate: filtering the page in hand would answer
  // "which of these twenty owe" and page wrongly.
  describe("patients?hasBalance", () => {
    it("returns only the patients who owe, and pages over those", async () => {
      const owing = await newPatient();
      const settled = await newPatient();

      await recordProcedure(owing, { price: "120.00" });
      await recordProcedure(settled, { price: "75.00" });
      await pay(settled, "75.00");

      const response = await context.app.inject({
        method: "GET",
        url: "/patients?hasBalance=true&limit=100",
        headers: auth(receptionistToken),
      });

      expect(response.statusCode).toBe(200);

      const page = response.json() as Paginated<{ id: string; balance?: string }>;
      const ids = page.items.map((item) => item.id);

      expect(ids).toContain(owing);
      expect(ids).not.toContain(settled);
      // The total is the count of debtors, not of patients — which is the
      // whole reason the filter is not applied after the page is cut.
      expect(page.total).toBe(page.items.length);
      expect(page.items.every((item) => Number(item.balance ?? "0") > 0)).toBe(true);
    });

    it("is ignored for a technician, whose responses carry no money at all", async () => {
      const owing = await newPatient();
      await recordProcedure(owing, { price: "90.00" });

      const [filtered, unfiltered] = await Promise.all([
        context.app.inject({
          method: "GET",
          url: "/patients?hasBalance=true&limit=100",
          headers: auth(technicianToken),
        }),
        context.app.inject({
          method: "GET",
          url: "/patients?limit=100",
          headers: auth(technicianToken),
        }),
      ]);

      // Honouring it would leak through the row count exactly what the
      // stripped `balance` field withholds (ROLES.md field rules).
      expect((filtered.json() as Paginated<unknown>).total).toBe(
        (unfiltered.json() as Paginated<unknown>).total,
      );
      expect((filtered.json() as Paginated<{ balance?: string }>).items[0]).not.toHaveProperty(
        "balance",
      );
    });
  });

  describe("patients?sort=balance", () => {
    it("orders by the computed balance, highest first unless asked otherwise", async () => {
      const most = await newPatient();
      const least = await newPatient();

      await recordProcedure(most, { price: "900.00" });
      await recordProcedure(least, { price: "50.00" });
      await pay(least, "30.00");

      const order = async (query: string, token: string): Promise<string[]> => {
        const response = await context.app.inject({
          method: "GET",
          url: `/patients?limit=100&${query}`,
          headers: auth(token),
        });

        expect(response.statusCode).toBe(200);

        return (response.json() as Paginated<{ id: string }>).items.map((item) => item.id);
      };

      const descending = await order("sort=balance", receptionistToken);
      const ascending = await order("sort=balance&dir=asc", receptionistToken);

      expect(descending.indexOf(most)).toBeLessThan(descending.indexOf(least));
      expect(ascending.indexOf(least)).toBeLessThan(ascending.indexOf(most));
      // The order alone would tell a technician who owes the most.
      expect(await order("sort=balance", technicianToken)).toEqual(
        await order("", technicianToken),
      );
    });
  });
});
