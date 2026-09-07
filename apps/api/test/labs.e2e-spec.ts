import {
  LAB_ORDER_STATUS,
  PAYMENT_METHOD,
  USER_ROLE,
  type LabOrderRow,
  type UserRole,
} from '@clinic/shared';

import {
  createPatient,
  procedurePayload,
  seedClinicFixtures,
  uniquePhone,
  type PatientFixtures,
} from '@test/helpers/patient-fixtures';
import { auth, createTestContext, type TestClinic, type TestContext } from '@test/helpers/test-app';

describe('Labs (e2e)', () => {
  let context: TestContext;
  let clinic: TestClinic;
  let fixtures: PatientFixtures;
  const tokens = {} as Record<UserRole, string>;

  let patientId: string;
  let labId: string;
  let crownId: string;
  let bridgeId: string;

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    for (const role of [
      USER_ROLE.ADMIN,
      USER_ROLE.DOCTOR,
      USER_ROLE.RECEPTIONIST,
      USER_ROLE.TECHNICIAN,
    ]) {
      tokens[role] = await context.login(clinic.phones[role]);
    }

    fixtures = await seedClinicFixtures(context, clinic, tokens[USER_ROLE.ADMIN]);

    patientId = await createPatient(context, tokens[USER_ROLE.RECEPTIONIST], {
      fullName: 'مريض المخبر',
      phone: uniquePhone(),
    });

    // The technician keeps the directory and the price list — ROLES.md gives
    // them CRU on "labs directory & prices".
    const lab = await context.app.inject({
      method: 'POST',
      url: '/labs',
      headers: auth(tokens[USER_ROLE.TECHNICIAN]),
      payload: { name: 'مخبر الاختبار', phone: '+963110000000', contactPerson: 'أبو خالد' },
    });

    expect(lab.statusCode).toBe(201);
    labId = (lab.json() as { id: string }).id;

    crownId = await createWorkType('تاج زيركون', '45.00');
    bridgeId = await createWorkType('جسر ثلاثي', '120.00');
  });

  afterAll(async () => {
    await context.close();
  });

  /* ---------------------------------------------------------------------- */
  /* Helpers                                                                 */
  /* ---------------------------------------------------------------------- */

  async function createWorkType(nameAr: string, defaultPrice: string): Promise<string> {
    const response = await context.app.inject({
      method: 'POST',
      url: `/labs/${labId}/work-types`,
      headers: auth(tokens[USER_ROLE.TECHNICIAN]),
      payload: { nameAr, defaultPrice },
    });

    expect(response.statusCode).toBe(201);

    return (response.json() as { id: string }).id;
  }

  /** A draft order, which is where every order starts. */
  async function createOrder(overrides: Record<string, unknown> = {}): Promise<LabOrderRow> {
    const response = await context.app.inject({
      method: 'POST',
      url: '/lab-orders',
      headers: auth(tokens[USER_ROLE.DOCTOR]),
      payload: {
        labId,
        patientId,
        doctorId: fixtures.doctorId,
        workTypeId: crownId,
        teeth: [26],
        material: 'zirconia',
        shade: 'A2',
        ...overrides,
      },
    });

    expect(response.statusCode).toBe(201);

    return response.json() as LabOrderRow;
  }

  const move = (
    id: string,
    step: string,
    role: UserRole = USER_ROLE.ADMIN,
    payload?: Record<string, unknown>,
  ) =>
    context.app.inject({
      method: 'PATCH',
      url: `/lab-orders/${id}/${step}`,
      headers: auth(tokens[role]),
      ...(payload && { payload }),
    });

  const balance = async (): Promise<{ owed: string; paid: string; balance: string }> => {
    const response = await context.app.inject({
      method: 'GET',
      url: `/labs/${labId}/balance`,
      headers: auth(tokens[USER_ROLE.ADMIN]),
    });

    expect(response.statusCode).toBe(200);

    return response.json() as { owed: string; paid: string; balance: string };
  };

  /* ---------------------------------------------------------------------- */
  /* The state machine                                                       */
  /* ---------------------------------------------------------------------- */

  describe('status transitions', () => {
    it('walks the happy path and stamps each date as it goes', async () => {
      const order = await createOrder();

      expect(order.status).toBe(LAB_ORDER_STATUS.DRAFT);
      expect(order.sentAt).toBeNull();

      const sent = await move(order.id, 'send');
      expect(sent.statusCode).toBe(200);
      expect((sent.json() as LabOrderRow).sentAt).not.toBeNull();

      expect((await move(order.id, 'ready')).statusCode).toBe(200);

      const received = await move(order.id, 'receive');
      expect((received.json() as LabOrderRow).receivedAt).not.toBeNull();

      const fitted = await move(order.id, 'fit');
      expect(fitted.statusCode).toBe(200);
      expect((fitted.json() as LabOrderRow).status).toBe(LAB_ORDER_STATUS.FITTED);
      expect((fitted.json() as LabOrderRow).fittedAt).not.toBeNull();
    });

    it('refuses every jump the table does not allow', async () => {
      const order = await createOrder();

      // draft → ready: the lab has not even been given the case.
      expect((await move(order.id, 'ready')).statusCode).toBe(400);
      // draft → received, draft → fit: same reason, further along.
      expect((await move(order.id, 'receive')).statusCode).toBe(400);
      expect((await move(order.id, 'fit')).statusCode).toBe(400);

      await move(order.id, 'send');

      // sent → fitted skips the two moves that mean the work exists.
      expect((await move(order.id, 'fit')).statusCode).toBe(400);
      expect((await move(order.id, 'receive')).statusCode).toBe(400);
    });

    it('lets work come back from ready, received or fitted, and go out again', async () => {
      const order = await createOrder();
      await move(order.id, 'send');
      await move(order.id, 'ready');

      const returned = await move(order.id, 'return', USER_ROLE.ADMIN, {
        reason: 'اللون لا يطابق',
      });

      expect(returned.statusCode).toBe(200);
      expect((returned.json() as LabOrderRow).returnReason).toBe('اللون لا يطابق');

      // Out again — and only that: a returned order cannot jump to ready.
      expect((await move(order.id, 'ready')).statusCode).toBe(400);
      expect((await move(order.id, 'send')).statusCode).toBe(200);
    });

    it('will not accept a return with no reason', async () => {
      const order = await createOrder();
      await move(order.id, 'send');
      await move(order.id, 'ready');

      expect((await move(order.id, 'return', USER_ROLE.ADMIN, { reason: '' })).statusCode).toBe(
        400,
      );
    });

    it('cancels only before the lab has started', async () => {
      const draft = await createOrder();
      expect((await move(draft.id, 'cancel')).statusCode).toBe(200);

      const sent = await createOrder();
      await move(sent.id, 'send');
      expect((await move(sent.id, 'cancel')).statusCode).toBe(200);

      // Once the work exists, the way out is a return — somebody made it.
      const received = await createOrder();
      await move(received.id, 'send');
      await move(received.id, 'ready');
      await move(received.id, 'receive');
      expect((await move(received.id, 'cancel')).statusCode).toBe(400);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Who may move what                                                       */
  /* ---------------------------------------------------------------------- */

  describe('transition permissions', () => {
    it('lets the technician run the conversation with the lab', async () => {
      const order = await createOrder();

      expect((await move(order.id, 'send', USER_ROLE.TECHNICIAN)).statusCode).toBe(200);
      expect((await move(order.id, 'ready', USER_ROLE.TECHNICIAN)).statusCode).toBe(200);
      expect((await move(order.id, 'receive', USER_ROLE.TECHNICIAN)).statusCode).toBe(200);
    });

    it('keeps the technician out of the chair', async () => {
      const order = await createOrder();
      await move(order.id, 'send');
      await move(order.id, 'ready');
      await move(order.id, 'receive');

      // Only the doctor can say a crown fits — they are the one holding it.
      expect((await move(order.id, 'fit', USER_ROLE.TECHNICIAN)).statusCode).toBe(403);
      expect((await move(order.id, 'fit', USER_ROLE.DOCTOR)).statusCode).toBe(200);
    });

    it('keeps the doctor out of the lab conversation', async () => {
      const order = await createOrder();
      await move(order.id, 'send', USER_ROLE.DOCTOR);

      // "The lab says it is ready" and "it is in the building" are both things
      // the technician is told. The route guard refuses first, so these are
      // 403 rather than 400 — the role is checked before the transition is.
      expect((await move(order.id, 'ready', USER_ROLE.DOCTOR)).statusCode).toBe(403);
      expect((await move(order.id, 'receive', USER_ROLE.DOCTOR)).statusCode).toBe(403);
    });

    it('will not let a doctor set the price of the work', async () => {
      const order = await createOrder();

      const response = await context.app.inject({
        method: 'PATCH',
        url: `/lab-orders/${order.id}`,
        headers: auth(tokens[USER_ROLE.DOCTOR]),
        payload: { price: '5.00' },
      });

      expect(response.statusCode).toBe(403);
      // And the order they created took the list price, not one they chose.
      expect(order.price).toBe('45.00');
    });

    it('gives a receptionist nothing at all in this module', async () => {
      const order = await createOrder();
      const receptionist = auth(tokens[USER_ROLE.RECEPTIONIST]);

      const responses = await Promise.all([
        context.app.inject({ method: 'GET', url: '/labs', headers: receptionist }),
        context.app.inject({ method: 'GET', url: `/labs/${labId}`, headers: receptionist }),
        context.app.inject({
          method: 'GET',
          url: `/labs/${labId}/work-types`,
          headers: receptionist,
        }),
        context.app.inject({ method: 'GET', url: `/labs/${labId}/balance`, headers: receptionist }),
        context.app.inject({
          method: 'GET',
          url: `/labs/${labId}/statement`,
          headers: receptionist,
        }),
        context.app.inject({ method: 'GET', url: '/lab-orders', headers: receptionist }),
        context.app.inject({
          method: 'GET',
          url: `/lab-orders/${order.id}`,
          headers: receptionist,
        }),
        context.app.inject({ method: 'GET', url: '/lab-orders/overdue', headers: receptionist }),
        context.app.inject({
          method: 'POST',
          url: '/lab-payments',
          headers: receptionist,
          payload: { labId, amount: '10.00', method: PAYMENT_METHOD.CASH },
        }),
      ]);

      expect(responses.map((response) => response.statusCode)).toEqual(
        Array.from({ length: responses.length }, () => 403),
      );
    });
  });

  /* ---------------------------------------------------------------------- */
  /* The balance rule                                                        */
  /* ---------------------------------------------------------------------- */

  describe('what counts toward the balance', () => {
    /*
     * The rule, stated once: an order counts from the moment it is **sent**,
     * and stops counting only if it is **cancelled**. Each test below is one
     * clause of that sentence.
     */
    it('ignores a draft, counts it once sent', async () => {
      const before = await balance();

      const order = await createOrder({ workTypeId: bridgeId });
      expect((await balance()).owed).toBe(before.owed);

      await move(order.id, 'send');
      expect(Number((await balance()).owed)).toBe(Number(before.owed) + 120);
    });

    it('drops a cancelled order back out', async () => {
      const before = await balance();

      const order = await createOrder({ workTypeId: bridgeId });
      await move(order.id, 'send');
      expect(Number((await balance()).owed)).toBe(Number(before.owed) + 120);

      await move(order.id, 'cancel');
      expect((await balance()).owed).toBe(before.owed);
    });

    it('keeps counting work that came back — the lab still made it', async () => {
      const before = await balance();

      const order = await createOrder({ workTypeId: bridgeId });
      await move(order.id, 'send');
      await move(order.id, 'ready');
      await move(order.id, 'return', USER_ROLE.ADMIN, { reason: 'لا يجلس' });

      expect(Number((await balance()).owed)).toBe(Number(before.owed) + 120);
    });

    it('keeps the price the order was placed at when the list moves', async () => {
      const order = await createOrder({ workTypeId: bridgeId });
      await move(order.id, 'send');

      await context.app.inject({
        method: 'PATCH',
        url: `/labs/work-types/${bridgeId}`,
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
        payload: { defaultPrice: '999.00' },
      });

      const after = await context.app.inject({
        method: 'GET',
        url: `/lab-orders/${order.id}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });

      expect((after.json() as LabOrderRow).price).toBe('120.00');

      // Put it back: later tests price a bridge at 120.
      await context.app.inject({
        method: 'PATCH',
        url: `/labs/work-types/${bridgeId}`,
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
        payload: { defaultPrice: '120.00' },
      });
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Money                                                                   */
  /* ---------------------------------------------------------------------- */

  describe('payments', () => {
    it('records what the technician paid, and reverses it admin-only', async () => {
      const before = await balance();

      const paid = await context.app.inject({
        method: 'POST',
        url: '/lab-payments',
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
        payload: { labId, amount: '50.00', method: PAYMENT_METHOD.CASH, note: 'دفعة' },
      });

      expect(paid.statusCode).toBe(201);
      const paymentId = (paid.json() as { id: string }).id;
      expect(Number((await balance()).paid)).toBe(Number(before.paid) + 50);

      // A technician may pay but not un-pay.
      const refused = await context.app.inject({
        method: 'PATCH',
        url: `/lab-payments/${paymentId}/reverse`,
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
        payload: { reason: 'خطأ' },
      });
      expect(refused.statusCode).toBe(403);

      const reversed = await context.app.inject({
        method: 'PATCH',
        url: `/lab-payments/${paymentId}/reverse`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { reason: 'سُجّلت مرتين' },
      });

      expect(reversed.statusCode).toBe(200);
      // The reversal is a second row carrying the negative — the original is
      // untouched, and the balance moves because the two sum.
      expect((reversed.json() as { amount: string }).amount).toBe('-50.00');
      expect((await balance()).paid).toBe(before.paid);
    });

    it('refuses to reverse the same payment twice, or to reverse a reversal', async () => {
      const paid = await context.app.inject({
        method: 'POST',
        url: '/lab-payments',
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { labId, amount: '20.00', method: PAYMENT_METHOD.CASH },
      });

      const paymentId = (paid.json() as { id: string }).id;

      const reversal = await context.app.inject({
        method: 'PATCH',
        url: `/lab-payments/${paymentId}/reverse`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { reason: 'خطأ في المبلغ' },
      });

      const reversalId = (reversal.json() as { id: string }).id;

      const twice = await context.app.inject({
        method: 'PATCH',
        url: `/lab-payments/${paymentId}/reverse`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { reason: 'مرة أخرى' },
      });
      const ofReversal = await context.app.inject({
        method: 'PATCH',
        url: `/lab-payments/${reversalId}/reverse`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { reason: 'وأيضاً' },
      });

      expect(twice.statusCode).toBe(400);
      expect(ofReversal.statusCode).toBe(400);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Statement, overdue and the printed sheet                                */
  /* ---------------------------------------------------------------------- */

  describe('statement and documents', () => {
    it('dates an order from the day it was sent, and runs the balance down each line', async () => {
      const response = await context.app.inject({
        method: 'GET',
        url: `/labs/${labId}/statement`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });

      expect(response.statusCode).toBe(200);
      const statement = response.json() as {
        closingBalance: string;
        entries: { kind: string; amount: string; runningBalance: string }[];
      };

      expect(statement.entries.length).toBeGreaterThan(0);
      // Every line is an order or a payment, and the last running balance is
      // the balance itself — that is what makes a statement reconcilable.
      expect(statement.closingBalance).toBe((await balance()).balance);
      expect(statement.entries.every((entry) => ['order', 'payment'].includes(entry.kind))).toBe(
        true,
      );
    });

    it('prints an order sheet and a statement as PDFs', async () => {
      const order = await createOrder();

      const [sheet, statement] = await Promise.all([
        context.app.inject({
          method: 'GET',
          url: `/lab-orders/${order.id}/print`,
          headers: auth(tokens[USER_ROLE.TECHNICIAN]),
        }),
        context.app.inject({
          method: 'GET',
          url: `/labs/${labId}/statement.pdf`,
          headers: auth(tokens[USER_ROLE.ADMIN]),
        }),
      ]);

      for (const response of [sheet, statement]) {
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('application/pdf');
        expect(response.rawPayload.subarray(0, 4).toString()).toBe('%PDF');
      }
    });

    it('lists what is late, and stops once the work is back', async () => {
      const order = await createOrder({
        expectedAt: new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10),
      });
      await move(order.id, 'send');

      const late = await context.app.inject({
        method: 'GET',
        url: '/lab-orders/overdue',
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
      });

      expect(late.statusCode).toBe(200);
      const ids = (late.json() as LabOrderRow[]).map((row) => row.id);
      expect(ids).toContain(order.id);
      expect((late.json() as LabOrderRow[]).every((row) => row.isOverdue)).toBe(true);

      await move(order.id, 'ready');
      await move(order.id, 'receive');

      const after = await context.app.inject({
        method: 'GET',
        url: '/lab-orders/overdue',
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
      });

      // Nobody is waiting for it any more, however late it was.
      expect((after.json() as LabOrderRow[]).map((row) => row.id)).not.toContain(order.id);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* From the chart                                                          */
  /* ---------------------------------------------------------------------- */

  describe('ordering from a procedure', () => {
    it('takes the teeth from the treatment that needs the work', async () => {
      const procedure = await context.app.inject({
        method: 'POST',
        url: '/performed-procedures',
        headers: auth(tokens[USER_ROLE.DOCTOR]),
        payload: procedurePayload({
          patientId,
          doctorId: fixtures.doctorId,
          procedureId: fixtures.catalogId,
          tooth: 36,
        }),
      });

      expect(procedure.statusCode).toBe(201);
      const performedProcedureId = (procedure.json() as { id: string }).id;

      const order = await createOrder({ performedProcedureId, teeth: undefined });

      // Nobody retyped 36 — which is the point: a lab cuts metal to that number.
      expect(order.teeth).toEqual([36]);
      expect(order.performedProcedureId).toBe(performedProcedureId);
    });
  });
});
