import {
  PAYMENT_METHOD,
  PERFORMED_PROCEDURE_STATUS,
  USER_ROLE,
  type Paginated,
  type PatientBalance,
  type Payment,
  type PerformedProcedure,
  type Statement,
} from '@clinic/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { PDFDocument } from 'pdf-lib';

import { charges } from '@api/database/schema';
import {
  createPatient,
  procedurePayload,
  seedClinicFixtures,
  uniquePhone,
  type PatientFixtures,
} from '@test/helpers/patient-fixtures';
import { auth, createTestContext, type TestClinic, type TestContext } from '@test/helpers/test-app';

/**
 * The money ledgers.
 *
 * The properties asserted here are the ones CLAUDE.md states as law: a balance
 * is always sum(charges) − sum(payments), an amount is never edited, and a
 * procedure and its charge either both exist or neither does.
 */
describe('Billing', () => {
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
    createPatient(context, adminToken, { fullName: 'سامي الأحمد', phone: uniquePhone() });

  const recordProcedure = async (
    patientId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<PerformedProcedure> => {
    const response = await context.app.inject({
      method: 'POST',
      url: '/performed-procedures',
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
      method: 'GET',
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
      method: 'POST',
      url: '/payments',
      headers: auth(token),
      payload: { patientId, amount, method: PAYMENT_METHOD.CASH },
    });

    expect(response.statusCode).toBe(201);

    return response.json() as Payment;
  };

  describe('balance', () => {
    it('is sum(charges) − sum(payments), reversals included', async () => {
      const patientId = await newPatient();

      await recordProcedure(patientId, { price: '150.00' });
      expect((await balanceOf(patientId)).balance).toBe('150.00');

      await pay(patientId, '50.00');
      expect((await balanceOf(patientId)).balance).toBe('100.00');

      const reversed = await pay(patientId, '30.00');
      expect((await balanceOf(patientId)).balance).toBe('70.00');

      const reversal = await context.app.inject({
        method: 'POST',
        url: `/payments/${reversed.id}/reverse`,
        headers: auth(adminToken),
        payload: { reason: 'Recorded against the wrong patient' },
      });

      expect(reversal.statusCode).toBe(201);
      expect((reversal.json() as Payment).amount).toBe('-30.00');

      // Back to where it was: the reversal is an ordinary negative row in the
      // same sum, and the original payment is still there to be read.
      const after = await balanceOf(patientId);
      expect(after.balance).toBe('100.00');
      expect(after.charged).toBe('150.00');
      expect(after.paid).toBe('50.00');
    });

    it('nets a discount off the charge', async () => {
      const patientId = await newPatient();

      await recordProcedure(patientId, {
        price: '200.00',
        discount: '25.00',
        discountReason: 'Family rate',
      });

      expect((await balanceOf(patientId)).balance).toBe('175.00');
    });

    it('is only raised by work that has started', async () => {
      const patientId = await newPatient();

      const procedure = await recordProcedure(patientId, {
        price: '90.00',
        status: PERFORMED_PROCEDURE_STATUS.PLANNED,
      });

      expect((await balanceOf(patientId)).balance).toBe('0.00');

      const update = await context.app.inject({
        method: 'PATCH',
        url: `/performed-procedures/${procedure.id}`,
        headers: auth(doctorToken),
        payload: { status: PERFORMED_PROCEDURE_STATUS.DONE },
      });

      expect(update.statusCode).toBe(200);
      expect((await balanceOf(patientId)).balance).toBe('90.00');
    });

    it('rides along in the patient header, and never for a technician', async () => {
      const patientId = await newPatient();
      await recordProcedure(patientId, { price: '120.00' });

      const forReception = await context.app.inject({
        method: 'GET',
        url: `/patients/${patientId}`,
        headers: auth(receptionistToken),
      });

      expect(forReception.statusCode).toBe(200);
      expect(forReception.json()).toMatchObject({ balance: '120.00' });

      const forTechnician = await context.app.inject({
        method: 'GET',
        url: `/patients/${patientId}`,
        headers: auth(technicianToken),
      });

      expect(forTechnician.statusCode).toBe(200);
      expect(forTechnician.json()).not.toHaveProperty('balance');
    });
  });

  describe('corrections', () => {
    it('re-prices a procedure by reversal, never by editing the charge', async () => {
      const patientId = await newPatient();
      const procedure = await recordProcedure(patientId, { price: '100.00' });

      const original = await context.db
        .select()
        .from(charges)
        .where(eq(charges.performedProcedureId, procedure.id));

      expect(original).toHaveLength(1);
      expect(original[0]?.amount).toBe('100.00');

      const update = await context.app.inject({
        method: 'PATCH',
        url: `/performed-procedures/${procedure.id}`,
        headers: auth(doctorToken),
        payload: { price: '130.00' },
      });

      expect(update.statusCode).toBe(200);

      const rows = await context.db
        .select()
        .from(charges)
        .where(eq(charges.performedProcedureId, procedure.id));

      // Three rows, not one edited row: the original untouched, its reversal,
      // and the corrected charge.
      expect(rows).toHaveLength(3);
      expect(rows.find((row) => row.id === original[0]?.id)?.amount).toBe('100.00');
      expect(rows.filter((row) => row.reversesId !== null).map((row) => row.amount)).toEqual([
        '-100.00',
      ]);
      expect((await balanceOf(patientId)).balance).toBe('130.00');
    });

    it('reverses the charge when a procedure is soft-deleted', async () => {
      const patientId = await newPatient();
      const procedure = await recordProcedure(patientId, { price: '75.00' });

      const removal = await context.app.inject({
        method: 'DELETE',
        url: `/performed-procedures/${procedure.id}`,
        headers: auth(adminToken),
      });

      expect(removal.statusCode).toBe(204);
      expect((await balanceOf(patientId)).balance).toBe('0.00');

      // Reversed, not deleted: both rows are still live and readable.
      const rows = await context.db
        .select()
        .from(charges)
        .where(and(eq(charges.performedProcedureId, procedure.id), isNull(charges.deletedAt)));

      expect(rows).toHaveLength(2);
    });

    it('leaves no orphan charge when the procedure insert fails', async () => {
      const patientId = await newPatient();
      const before = await context.db
        .select()
        .from(charges)
        .where(eq(charges.patientId, patientId));

      // A chart mark whose type does not match the specialty is rejected after
      // the row would have been written, which is exactly the window a charge
      // outside the transaction would leak through.
      const response = await context.app.inject({
        method: 'POST',
        url: '/performed-procedures',
        headers: auth(doctorToken),
        payload: {
          patientId,
          doctorId: fixtures.doctorId,
          procedureId: fixtures.catalogId,
          price: '10.00',
          chartMarks: [{ chartType: 'body_region', location: { region: 'knee', side: 'left' } }],
        },
      });

      expect(response.statusCode).toBe(400);

      const after = await context.db.select().from(charges).where(eq(charges.patientId, patientId));

      expect(after).toHaveLength(before.length);
      expect((await balanceOf(patientId)).balance).toBe('0.00');
    });
  });

  describe('payments', () => {
    it('numbers receipts without gaps under concurrent writes', async () => {
      const patientId = await newPatient();

      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          context.app.inject({
            method: 'POST',
            url: '/payments',
            headers: auth(receptionistToken),
            payload: { patientId, amount: '10.00', method: PAYMENT_METHOD.CARD },
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

    it('refuses to reverse the same payment twice', async () => {
      const patientId = await newPatient();
      const payment = await pay(patientId, '20.00');

      const first = await context.app.inject({
        method: 'POST',
        url: `/payments/${payment.id}/reverse`,
        headers: auth(adminToken),
        payload: { reason: 'Duplicate entry' },
      });
      const second = await context.app.inject({
        method: 'POST',
        url: `/payments/${payment.id}/reverse`,
        headers: auth(adminToken),
        payload: { reason: 'Duplicate entry' },
      });

      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(400);
    });

    it('gives a receptionist create and read, and nothing else', async () => {
      const patientId = await newPatient();
      const payment = await pay(patientId, '15.00');

      const list = await context.app.inject({
        method: 'GET',
        url: `/payments?patientId=${patientId}`,
        headers: auth(receptionistToken),
      });

      expect(list.statusCode).toBe(200);
      expect((list.json() as Paginated<Payment>).total).toBe(1);

      // ROLES.md: "receptionist updating or deleting a payment → 403".
      const reversal = await context.app.inject({
        method: 'POST',
        url: `/payments/${payment.id}/reverse`,
        headers: auth(receptionistToken),
        payload: { reason: 'Should not be allowed' },
      });
      const removal = await context.app.inject({
        method: 'DELETE',
        url: `/payments/${payment.id}`,
        headers: auth(receptionistToken),
        payload: { reason: 'Should not be allowed' },
      });

      expect(reversal.statusCode).toBe(403);
      expect(removal.statusCode).toBe(403);
    });

    it('keeps a technician away from the money entirely', async () => {
      const patientId = await newPatient();

      const attempts = await Promise.all([
        context.app.inject({ method: 'GET', url: '/payments', headers: auth(technicianToken) }),
        context.app.inject({
          method: 'GET',
          url: `/patients/${patientId}/balance`,
          headers: auth(technicianToken),
        }),
        context.app.inject({
          method: 'GET',
          url: '/billing/overdue',
          headers: auth(technicianToken),
        }),
      ]);

      expect(attempts.map((response) => response.statusCode)).toEqual([403, 403, 403]);
    });
  });

  describe('statement', () => {
    it('runs a balance down the entries and names the procedure only', async () => {
      const patientId = await newPatient();
      await recordProcedure(patientId, { price: '100.00' });
      await pay(patientId, '40.00');

      const response = await context.app.inject({
        method: 'GET',
        url: `/patients/${patientId}/statement`,
        headers: auth(receptionistToken),
      });

      expect(response.statusCode).toBe(200);

      const statement = response.json() as Statement;

      expect(statement.entries.map((entry) => entry.runningBalance)).toEqual(['100.00', '60.00']);
      expect(statement.closingBalance).toBe('60.00');
      // The catalog name, and nothing clinical alongside it.
      expect(statement.entries[0]?.description).toBe('حشوة تجميلية');
    });

    it('renders a PDF with the Arabic text embedded', async () => {
      const patientId = await newPatient();
      await recordProcedure(patientId, { price: '100.00' });

      const response = await context.app.inject({
        method: 'GET',
        url: `/patients/${patientId}/statement.pdf`,
        headers: auth(receptionistToken),
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/pdf');

      const pdf = response.rawPayload;

      expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(pdf.subarray(-6).toString('latin1')).toContain('%%EOF');

      const document = await PDFDocument.load(pdf);
      const names = document.context
        .enumerateIndirectObjects()
        .map(([, value]) => String(value))
        .join(' ');

      // The Arabic face is embedded rather than referenced, which is what makes
      // the sheet render the same on any machine — and the CID font is what
      // carries the shaped presentation forms.
      expect(names).toContain('Amiri');
      expect(names).toContain('CIDFontType2');
      expect(pdf.byteLength).toBeGreaterThan(50_000);
    });

    it('prints a receipt for every payment', async () => {
      const patientId = await newPatient();
      const payment = await pay(patientId, '35.00');

      const response = await context.app.inject({
        method: 'GET',
        url: `/payments/${payment.id}/receipt`,
        headers: auth(receptionistToken),
      });

      expect(response.statusCode).toBe(200);
      expect(response.rawPayload.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    });
  });

  describe('overdue', () => {
    it('lists debtors who have not paid inside the window', async () => {
      const owing = await newPatient();
      const paid = await newPatient();

      await recordProcedure(owing, { price: '300.00' });
      await recordProcedure(paid, { price: '80.00' });
      await pay(paid, '80.00');

      // `afterDays` of one day means everything charged today counts, since the
      // owing patient has never paid at all.
      const response = await context.app.inject({
        method: 'GET',
        url: '/billing/overdue?afterDays=1&limit=100',
        headers: auth(receptionistToken),
      });

      expect(response.statusCode).toBe(200);

      const page = response.json() as Paginated<{ patientId: string; balance: string }>;
      const ids = page.items.map((item) => item.patientId);

      expect(ids).toContain(owing);
      expect(ids).not.toContain(paid);
      expect(page.items.find((item) => item.patientId === owing)?.balance).toBe('300.00');
    });
  });
});
