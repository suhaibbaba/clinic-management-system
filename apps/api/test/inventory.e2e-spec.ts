import {
  ITEM_CATEGORY,
  ITEM_UNIT,
  USER_ROLE,
  type InventoryAlerts,
  type InventoryItemRow,
  type ItemBatches,
  type Paginated,
  type ShoppingList,
  type StockMovement,
  type StockMovementRow,
  type SupplierStatement,
  type TimelineEntry,
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

/** Days from now, as a plain ISO date — what an expiry is. */
const inDays = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

describe('Inventory (e2e)', () => {
  let context: TestContext;
  let clinic: TestClinic;
  let fixtures: PatientFixtures;
  const tokens = {} as Record<UserRole, string>;

  let supplierId: string;
  let patientId: string;

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
      fullName: 'مريض المستودع',
      phone: uniquePhone(),
    });

    // The technician keeps the directory — ROLES.md gives them CRU on
    // "Items & suppliers".
    const supplier = await context.app.inject({
      method: 'POST',
      url: '/suppliers',
      headers: auth(tokens[USER_ROLE.TECHNICIAN]),
      payload: { name: 'مستودع الاختبار', phone: '+963110000000' },
    });

    expect(supplier.statusCode).toBe(201);
    supplierId = (supplier.json() as { id: string }).id;
  });

  afterAll(async () => {
    await context.close();
  });

  /* ---------------------------------------------------------------------- */
  /* Helpers                                                                 */
  /* ---------------------------------------------------------------------- */

  const createItem = async (payload: Record<string, unknown>): Promise<string> => {
    const response = await context.app.inject({
      method: 'POST',
      url: '/inventory/items',
      headers: auth(tokens[USER_ROLE.TECHNICIAN]),
      payload: {
        category: ITEM_CATEGORY.CONSUMABLE,
        unit: ITEM_UNIT.PIECE,
        ...payload,
      },
    });

    expect(response.statusCode).toBe(201);
    return (response.json() as { id: string }).id;
  };

  const move = async (
    kind: 'purchase' | 'consume' | 'adjust',
    payload: Record<string, unknown>,
    token: string = tokens[USER_ROLE.TECHNICIAN],
  ) =>
    context.app.inject({
      method: 'POST',
      url: `/inventory/movements/${kind}`,
      headers: auth(token),
      payload,
    });

  const readItem = async (id: string): Promise<InventoryItemRow> => {
    const response = await context.app.inject({
      method: 'GET',
      url: `/inventory/items/${id}`,
      headers: auth(tokens[USER_ROLE.TECHNICIAN]),
    });

    expect(response.statusCode).toBe(200);
    return response.json() as InventoryItemRow;
  };

  /* ---------------------------------------------------------------------- */
  /* The quantity is the sum of the movements                                */
  /* ---------------------------------------------------------------------- */

  describe('quantity', () => {
    it('is the sum of every movement, and there is no field to set it with', async () => {
      const itemId = await createItem({ nameAr: `قفازات ${uniquePhone()}`, minQuantity: '5' });

      expect((await readItem(itemId)).quantity).toBe('0');

      expect(
        (await move('purchase', { itemId, quantity: '20', unitPrice: '4.50' })).statusCode,
      ).toBe(201);
      expect((await move('consume', { itemId, quantity: '3' })).statusCode).toBe(201);
      expect(
        (await move('adjust', { itemId, quantity: '-2', reason: 'جرد شهري' })).statusCode,
      ).toBe(201);

      expect((await readItem(itemId)).quantity).toBe('15');

      // The update endpoint has no quantity to take, so a client that tries is
      // rejected by the schema rather than quietly ignored.
      const attempt = await context.app.inject({
        method: 'PATCH',
        url: `/inventory/items/${itemId}`,
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
        payload: { quantity: '999' },
      });

      expect(attempt.statusCode).toBe(400);
      expect((await readItem(itemId)).quantity).toBe('15');
    });

    it('counts a reversal as an ordinary negative row', async () => {
      const itemId = await createItem({ nameAr: `كمامات ${uniquePhone()}` });

      const purchase = await move('purchase', { itemId, quantity: '10', unitPrice: '2.00' });
      const purchaseId = (purchase.json() as StockMovement).id;

      await move('consume', { itemId, quantity: '4' });
      expect((await readItem(itemId)).quantity).toBe('6');

      const reversal = await context.app.inject({
        method: 'PATCH',
        url: `/inventory/movements/${purchaseId}/reverse`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { reason: 'الفاتورة أُلغيت' },
      });

      expect(reversal.statusCode).toBe(200);
      expect((reversal.json() as StockMovement).quantity).toBe('-10');
      expect((reversal.json() as StockMovement).reversesId).toBe(purchaseId);

      // The purchase is undone, the consumption is not: 10 − 4 − 10.
      expect((await readItem(itemId)).quantity).toBe('-4');
    });

    it('refuses to reverse the same movement twice, or to reverse a reversal', async () => {
      const itemId = await createItem({ nameAr: `مرايا ${uniquePhone()}` });
      const purchase = await move('purchase', { itemId, quantity: '5' });
      const purchaseId = (purchase.json() as StockMovement).id;

      const first = await context.app.inject({
        method: 'PATCH',
        url: `/inventory/movements/${purchaseId}/reverse`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { reason: 'خطأ في الإدخال' },
      });
      expect(first.statusCode).toBe(200);

      const again = await context.app.inject({
        method: 'PATCH',
        url: `/inventory/movements/${purchaseId}/reverse`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { reason: 'مرة أخرى' },
      });
      expect(again.statusCode).toBe(400);

      const reversalId = (first.json() as StockMovement).id;
      const reversalOfReversal = await context.app.inject({
        method: 'PATCH',
        url: `/inventory/movements/${reversalId}/reverse`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { reason: 'وهذه أيضاً' },
      });
      expect(reversalOfReversal.statusCode).toBe(400);
    });

    it('keeps fractional units exact over many movements', async () => {
      const itemId = await createItem({
        nameAr: `محلول ${uniquePhone()}`,
        unit: ITEM_UNIT.ML,
      });

      await move('purchase', { itemId, quantity: '100' });
      for (let index = 0; index < 10; index += 1) {
        await move('consume', { itemId, quantity: '0.1' });
      }

      // 0.1 added ten times is exactly 1 here, which it would not be in floats.
      expect((await readItem(itemId)).quantity).toBe('99');
    });
  });

  /* ---------------------------------------------------------------------- */
  /* The sign belongs to the type                                            */
  /* ---------------------------------------------------------------------- */

  describe('movement rules', () => {
    it('requires a reason on an adjustment', async () => {
      const itemId = await createItem({ nameAr: `أدوات ${uniquePhone()}` });

      const without = await move('adjust', { itemId, quantity: '-1' });
      expect(without.statusCode).toBe(400);

      const tooShort = await move('adjust', { itemId, quantity: '-1', reason: 'x' });
      expect(tooShort.statusCode).toBe(400);

      const withReason = await move('adjust', {
        itemId,
        quantity: '-1',
        reason: 'كسر أثناء التعقيم',
      });
      expect(withReason.statusCode).toBe(201);
      expect((withReason.json() as StockMovement).reason).toBe('كسر أثناء التعقيم');
    });

    it('refuses a zero movement and a negative purchase', async () => {
      const itemId = await createItem({ nameAr: `شاش ${uniquePhone()}` });

      expect((await move('adjust', { itemId, quantity: '0', reason: 'لا شيء' })).statusCode).toBe(
        400,
      );
      expect((await move('purchase', { itemId, quantity: '-5' })).statusCode).toBe(400);
    });

    it('stores a consumption negative however it was asked for', async () => {
      const itemId = await createItem({ nameAr: `إبر ${uniquePhone()}` });
      await move('purchase', { itemId, quantity: '10' });

      const consumed = await move('consume', { itemId, quantity: '3' });

      expect(consumed.statusCode).toBe(201);
      expect((consumed.json() as StockMovement).quantity).toBe('-3');
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Batches, flags and the alerts                                           */
  /* ---------------------------------------------------------------------- */

  describe('batches and flags', () => {
    it('drains the batch that goes off first and reports what is left', async () => {
      const itemId = await createItem({
        nameAr: `مخدر ${uniquePhone()}`,
        category: ITEM_CATEGORY.MEDICATION,
        unit: ITEM_UNIT.AMPOULE,
        minQuantity: '5',
      });

      // Bought first, expires last.
      await move('purchase', {
        itemId,
        quantity: '10',
        batchNo: 'B-LATE',
        expiryDate: inDays(400),
      });
      await move('purchase', {
        itemId,
        quantity: '10',
        batchNo: 'B-SOON',
        expiryDate: inDays(20),
      });
      await move('consume', { itemId, quantity: '12' });

      const response = await context.app.inject({
        method: 'GET',
        url: `/inventory/items/${itemId}/batches`,
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
      });

      expect(response.statusCode).toBe(200);
      const batches = response.json() as ItemBatches;

      expect(batches.quantity).toBe('8');
      expect(batches.batches.map((batch) => [batch.batchNo, batch.remaining])).toEqual([
        ['B-SOON', '0'],
        ['B-LATE', '8'],
      ]);

      // The soon-to-expire batch is empty, so nothing is expiring any more.
      const item = await readItem(itemId);
      expect(item.isExpiring).toBe(false);
      expect(item.nearestExpiry).toBe(inDays(400));
    });

    it('flags low, expiring and expired, and lists them in the alerts', async () => {
      const lowId = await createItem({ nameAr: `شاش منخفض ${uniquePhone()}`, minQuantity: '10' });
      await move('purchase', { itemId: lowId, quantity: '12' });
      await move('consume', { itemId: lowId, quantity: '4' });

      const expiringId = await createItem({
        nameAr: `دواء قارب ${uniquePhone()}`,
        category: ITEM_CATEGORY.MEDICATION,
        minQuantity: '1',
      });
      await move('purchase', {
        itemId: expiringId,
        quantity: '10',
        batchNo: 'SOON',
        expiryDate: inDays(15),
      });

      const expiredId = await createItem({
        nameAr: `دواء منتهٍ ${uniquePhone()}`,
        category: ITEM_CATEGORY.MEDICATION,
        minQuantity: '1',
      });
      await move('purchase', {
        itemId: expiredId,
        quantity: '10',
        batchNo: 'GONE',
        expiryDate: inDays(-3),
      });

      const low = await readItem(lowId);
      expect(low.quantity).toBe('8');
      expect(low.isLow).toBe(true);

      expect((await readItem(expiringId)).isExpiring).toBe(true);
      expect((await readItem(expiredId)).isExpired).toBe(true);

      const response = await context.app.inject({
        method: 'GET',
        url: '/inventory/alerts',
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
      });

      expect(response.statusCode).toBe(200);
      const alerts = response.json() as InventoryAlerts;

      expect(alerts.expiryWarningDays).toBe(60);
      expect(alerts.low.map((item) => item.id)).toContain(lowId);
      expect(alerts.expiring.map((item) => item.id)).toContain(expiringId);
      expect(alerts.expired.map((item) => item.id)).toContain(expiredId);
    });

    it('does not call an item low when it has no minimum set', async () => {
      const itemId = await createItem({ nameAr: `بلا حد ${uniquePhone()}` });

      // Nothing bought, nothing used: zero of something nobody set a level for
      // is not a problem, it is an item that has never been stocked.
      expect((await readItem(itemId)).isLow).toBe(false);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* The item card                                                           */
  /* ---------------------------------------------------------------------- */

  it('shows the item card with a running quantity, newest first', async () => {
    const itemId = await createItem({ nameAr: `بند ${uniquePhone()}` });

    await move('purchase', { itemId, quantity: '10', unitPrice: '1.00', supplierId });
    await move('consume', { itemId, quantity: '4' });
    await move('adjust', { itemId, quantity: '2', reason: 'وجدت علبة إضافية' });

    const response = await context.app.inject({
      method: 'GET',
      url: `/inventory/items/${itemId}/movements`,
      headers: auth(tokens[USER_ROLE.TECHNICIAN]),
    });

    expect(response.statusCode).toBe(200);
    const page = response.json() as Paginated<StockMovementRow>;

    expect(page.items.map((row) => [row.quantity, row.runningQuantity])).toEqual([
      ['2', '8'],
      ['-4', '6'],
      ['10', '10'],
    ]);
    expect(page.items[2]?.supplierName).toBe('مستودع الاختبار');
  });

  /* ---------------------------------------------------------------------- */
  /* Consumption on a patient                                                */
  /* ---------------------------------------------------------------------- */

  it('puts a consumption linked to a procedure on the patient timeline', async () => {
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

    const itemId = await createItem({
      nameAr: `ليدوكائين ${uniquePhone()}`,
      category: ITEM_CATEGORY.MEDICATION,
      unit: ITEM_UNIT.AMPOULE,
    });
    await move('purchase', { itemId, quantity: '20' });

    // The doctor records what they used, at the chair. No patient id is sent:
    // it is read off the procedure, so the two can never disagree.
    const consumed = await move(
      'consume',
      { itemId, quantity: '2', performedProcedureId },
      tokens[USER_ROLE.DOCTOR],
    );

    expect(consumed.statusCode).toBe(201);
    expect((consumed.json() as StockMovement).patientId).toBe(patientId);

    const timeline = await context.app.inject({
      method: 'GET',
      url: `/patients/${patientId}/timeline?type=supply`,
      headers: auth(tokens[USER_ROLE.DOCTOR]),
    });

    expect(timeline.statusCode).toBe(200);
    const entries = (timeline.json() as Paginated<TimelineEntry>).items;

    expect(entries).toHaveLength(1);
    expect(entries[0]?.detail['quantity']).toBe('2');
    expect(entries[0]?.detail['performedProcedureId']).toBe(performedProcedureId);
  });

  /* ---------------------------------------------------------------------- */
  /* Shopping list and supplier statement                                    */
  /* ---------------------------------------------------------------------- */

  it('suggests twice the minimum less what is on the shelf', async () => {
    const itemId = await createItem({
      nameAr: `قفازات نافدة ${uniquePhone()}`,
      minQuantity: '10',
    });
    await move('purchase', { itemId, quantity: '12' });
    await move('consume', { itemId, quantity: '9' });

    const response = await context.app.inject({
      method: 'GET',
      url: '/inventory/shopping-list',
      headers: auth(tokens[USER_ROLE.TECHNICIAN]),
    });

    expect(response.statusCode).toBe(200);
    const line = (response.json() as ShoppingList).lines.find((entry) => entry.itemId === itemId);

    // 10 × 2 − 3.
    expect(line?.quantity).toBe('3');
    expect(line?.suggested).toBe('17');
  });

  it('totals what was bought from one supplier', async () => {
    const itemId = await createItem({ nameAr: `بند مورّد ${uniquePhone()}` });

    await move('purchase', { itemId, quantity: '10', unitPrice: '2.50', supplierId });
    await move('purchase', { itemId, quantity: '4', unitPrice: '3.00', supplierId });
    // A purchase with no price still appears; it just adds nothing to the total.
    await move('purchase', { itemId, quantity: '1', supplierId });

    const response = await context.app.inject({
      method: 'GET',
      url: `/suppliers/${supplierId}/statement`,
      headers: auth(tokens[USER_ROLE.TECHNICIAN]),
    });

    expect(response.statusCode).toBe(200);
    const statement = response.json() as SupplierStatement;
    const lines = statement.lines.filter((line) => line.itemId === itemId);

    expect(lines.map((line) => line.total)).toEqual(['25.00', '12.00', null]);
  });

  it('prints the shopping list as a PDF', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: '/inventory/shopping-list.pdf',
      headers: auth(tokens[USER_ROLE.TECHNICIAN]),
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
  });

  /* ---------------------------------------------------------------------- */
  /* Permissions (ROLES.md inventory matrix)                                 */
  /* ---------------------------------------------------------------------- */

  describe('permissions', () => {
    let itemId: string;

    beforeAll(async () => {
      itemId = await createItem({ nameAr: `بند الصلاحيات ${uniquePhone()}` });
      await move('purchase', { itemId, quantity: '10' });
    });

    it('gives a receptionist nothing at all', async () => {
      const token = tokens[USER_ROLE.RECEPTIONIST];

      const reads = await Promise.all(
        [
          '/inventory/items',
          `/inventory/items/${itemId}`,
          `/inventory/items/${itemId}/batches`,
          `/inventory/items/${itemId}/movements`,
          '/inventory/movements',
          '/inventory/alerts',
          '/inventory/shopping-list',
          '/inventory/shopping-list.pdf',
          '/suppliers',
          `/suppliers/${supplierId}`,
          `/suppliers/${supplierId}/statement`,
        ].map((url) => context.app.inject({ method: 'GET', url, headers: auth(token) })),
      );

      expect(reads.map((response) => response.statusCode)).toEqual(reads.map(() => 403));

      expect((await move('purchase', { itemId, quantity: '1' }, token)).statusCode).toBe(403);
      expect((await move('consume', { itemId, quantity: '1' }, token)).statusCode).toBe(403);
      expect(
        (await move('adjust', { itemId, quantity: '1', reason: 'محاولة' }, token)).statusCode,
      ).toBe(403);
    });

    it('lets a doctor read and consume, and nothing else', async () => {
      const token = tokens[USER_ROLE.DOCTOR];

      const read = await context.app.inject({
        method: 'GET',
        url: '/inventory/items',
        headers: auth(token),
      });
      expect(read.statusCode).toBe(200);

      expect((await move('consume', { itemId, quantity: '1' }, token)).statusCode).toBe(201);
      expect((await move('purchase', { itemId, quantity: '1' }, token)).statusCode).toBe(403);
      expect(
        (await move('adjust', { itemId, quantity: '1', reason: 'جرد' }, token)).statusCode,
      ).toBe(403);

      const create = await context.app.inject({
        method: 'POST',
        url: '/inventory/items',
        headers: auth(token),
        payload: { nameAr: 'بند من طبيب', category: ITEM_CATEGORY.TOOL, unit: ITEM_UNIT.PIECE },
      });
      expect(create.statusCode).toBe(403);
    });

    it('keeps reversal to an admin', async () => {
      const purchase = await move('purchase', { itemId, quantity: '5' });
      const purchaseId = (purchase.json() as StockMovement).id;

      const byTechnician = await context.app.inject({
        method: 'PATCH',
        url: `/inventory/movements/${purchaseId}/reverse`,
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
        payload: { reason: 'محاولة' },
      });

      expect(byTechnician.statusCode).toBe(403);
    });

    it('reports another clinic’s item as 404 rather than 403', async () => {
      const other = await context.createClinic();
      const otherToken = await context.login(other.phones[USER_ROLE.TECHNICIAN]);

      const response = await context.app.inject({
        method: 'GET',
        url: `/inventory/items/${itemId}`,
        headers: auth(otherToken),
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
