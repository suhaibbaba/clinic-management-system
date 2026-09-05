import { CHART_TYPE, USER_ROLE, type UserRole } from '@clinic/shared';

import {
  createPatient,
  procedurePayload,
  seedClinicFixtures,
  uniquePhone,
  type PatientFixtures,
} from '@test/helpers/patient-fixtures';
import { auth, createTestContext, type TestClinic, type TestContext } from '@test/helpers/test-app';

interface AuditEntry {
  action: string;
  entity: string;
  entityId: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
}

describe('Patient clinical records (e2e)', () => {
  let context: TestContext;
  let clinic: TestClinic;
  let fixtures: PatientFixtures;
  const tokens = {} as Record<UserRole, string>;

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

    patientId = await createPatient(context, tokens[USER_ROLE.DOCTOR], {
      fullName: 'عمر سامي الخطيب',
      phone: uniquePhone(),
    });
  });

  afterAll(async () => {
    await context.close();
  });

  const asDoctor = () => auth(tokens[USER_ROLE.DOCTOR]);

  const createProcedure = async (tooth: number, surfaces?: string[]) => {
    const response = await context.app.inject({
      method: 'POST',
      url: '/performed-procedures',
      headers: asDoctor(),
      payload: procedurePayload({
        patientId,
        doctorId: fixtures.doctorId,
        procedureId: fixtures.catalogId,
        tooth,
        ...(surfaces && { surfaces }),
      }),
    });

    return response;
  };

  describe('FDI validation', () => {
    it.each([9, 19, 49, 50, 86, 100, -11, 0])(
      'rejects %s as a tooth number',
      async (tooth: number) => {
        const response = await createProcedure(tooth);

        expect(response.statusCode).toBe(400);
      },
    );

    it.each([11, 18, 21, 38, 48, 51, 55, 71, 85])(
      'accepts %s as a tooth number',
      async (tooth: number) => {
        const response = await createProcedure(tooth);

        expect(response.statusCode).toBe(201);
      },
    );

    it('rejects a mark whose chart type does not match the specialty', async () => {
      const response = await context.app.inject({
        method: 'POST',
        url: '/performed-procedures',
        headers: asDoctor(),
        payload: {
          patientId,
          doctorId: fixtures.doctorId,
          procedureId: fixtures.catalogId,
          chartMarks: [
            { chartType: CHART_TYPE.BODY_REGION, location: { region: 'knee', side: 'left' } },
          ],
        },
      });

      // The clinic's specialty charts teeth, so a body region is not storable.
      expect(response.statusCode).toBe(400);
    });

    it('rejects an invalid tooth number on the tooth-history route', async () => {
      const response = await context.app.inject({
        method: 'GET',
        url: `/patients/${patientId}/teeth/49`,
        headers: asDoctor(),
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('procedures', () => {
    it('snapshots the catalog price when none is supplied', async () => {
      const response = await createProcedure(46);

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ price: '60.00', discount: '0.00' });
    });

    it('keeps the snapshot when the catalog price later changes', async () => {
      const created = await createProcedure(47);
      const { id, price } = created.json() as { id: string; price: string };

      await context.app.inject({
        method: 'PATCH',
        url: `/procedure-catalog/${fixtures.catalogId}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { defaultPrice: '95.00' },
      });

      const after = await context.app.inject({
        method: 'GET',
        url: `/performed-procedures/${id}`,
        headers: asDoctor(),
      });

      expect((after.json() as { price: string }).price).toBe(price);

      // Restore, so the price-sensitive assertions above stay order-independent.
      await context.app.inject({
        method: 'PATCH',
        url: `/procedure-catalog/${fixtures.catalogId}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { defaultPrice: '60.00' },
      });
    });

    it('refuses a receptionist any access', async () => {
      const list = await context.app.inject({
        method: 'GET',
        url: `/performed-procedures?patientId=${patientId}`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      expect(list.statusCode).toBe(403);
    });

    it('gives a technician an empty page — only lab-linked rows are theirs', async () => {
      const list = await context.app.inject({
        method: 'GET',
        url: `/performed-procedures?patientId=${patientId}`,
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
      });

      expect(list.statusCode).toBe(200);
      expect((list.json() as { items: unknown[] }).items).toHaveLength(0);
    });
  });

  describe('tooth history', () => {
    let historyPatientId: string;

    beforeAll(async () => {
      historyPatientId = await createPatient(context, tokens[USER_ROLE.DOCTOR], {
        fullName: 'مريض سجل الأسنان',
        phone: uniquePhone(),
      });

      for (const [tooth, surfaces] of [
        [36, ['O']],
        [36, ['M', 'O']],
        [26, ['O']],
      ] as [number, string[]][]) {
        const response = await context.app.inject({
          method: 'POST',
          url: '/performed-procedures',
          headers: asDoctor(),
          payload: procedurePayload({
            patientId: historyPatientId,
            doctorId: fixtures.doctorId,
            procedureId: fixtures.catalogId,
            tooth,
            surfaces,
          }),
        });

        expect(response.statusCode).toBe(201);
      }
    });

    it('aggregates every procedure and mark recorded on one tooth', async () => {
      const response = await context.app.inject({
        method: 'GET',
        url: `/patients/${historyPatientId}/teeth/36`,
        headers: asDoctor(),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json() as {
        tooth: number;
        procedures: { id: string; chartMarks?: unknown[] }[];
        marks: { location: { tooth: number } }[];
        attachments: unknown[];
      };

      expect(body.tooth).toBe(36);
      expect(body.procedures).toHaveLength(2);
      expect(body.marks).toHaveLength(2);
      expect(body.marks.every((mark) => mark.location.tooth === 36)).toBe(true);
      expect(body.attachments).toEqual([]);
    });

    it('does not leak a neighbouring tooth into the result', async () => {
      const response = await context.app.inject({
        method: 'GET',
        url: `/patients/${historyPatientId}/teeth/26`,
        headers: asDoctor(),
      });

      expect((response.json() as { procedures: unknown[] }).procedures).toHaveLength(1);
    });

    it('returns an empty history for a tooth nothing was done to', async () => {
      const response = await context.app.inject({
        method: 'GET',
        url: `/patients/${historyPatientId}/teeth/11`,
        headers: asDoctor(),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ procedures: [], marks: [], attachments: [] });
    });

    it('refuses a receptionist', async () => {
      const response = await context.app.inject({
        method: 'GET',
        url: `/patients/${historyPatientId}/teeth/36`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('treatment plans', () => {
    let planId: string;
    let itemId: string;

    beforeEach(async () => {
      const plan = await context.app.inject({
        method: 'POST',
        url: '/treatment-plans',
        headers: asDoctor(),
        payload: {
          patientId,
          doctorId: fixtures.doctorId,
          title: 'خطة معالجة',
          items: [{ procedureId: fixtures.catalogId, sortOrder: 0 }],
        },
      });

      expect(plan.statusCode).toBe(201);

      const body = plan.json() as { id: string; items: { id: string; estimatedPrice: string }[] };
      planId = body.id;
      itemId = body.items[0]?.id ?? '';
    });

    it('snapshots the catalog price onto a new item', async () => {
      const plan = await context.app.inject({
        method: 'GET',
        url: `/treatment-plans/${planId}`,
        headers: asDoctor(),
      });

      const items = (plan.json() as { items: { estimatedPrice: string }[] }).items;
      expect(items[0]?.estimatedPrice).toBe('60.00');
    });

    it('converts an item into a performed procedure linked back to it', async () => {
      const response = await context.app.inject({
        method: 'POST',
        url: `/plan-items/${itemId}/convert`,
        headers: asDoctor(),
        payload: {},
      });

      expect(response.statusCode).toBe(201);

      const procedure = response.json() as {
        id: string;
        planItemId: string;
        patientId: string;
        price: string;
        status: string;
      };

      expect(procedure.planItemId).toBe(itemId);
      expect(procedure.patientId).toBe(patientId);
      // The estimate carries over as the snapshot unless overridden.
      expect(procedure.price).toBe('60.00');
      expect(procedure.status).toBe('done');

      const plan = await context.app.inject({
        method: 'GET',
        url: `/treatment-plans/${planId}`,
        headers: asDoctor(),
      });

      const items = (plan.json() as { items: { id: string; status: string }[] }).items;
      expect(items.find((item) => item.id === itemId)?.status).toBe('converted');
    });

    it('lets the caller override the quoted price at conversion', async () => {
      const response = await context.app.inject({
        method: 'POST',
        url: `/plan-items/${itemId}/convert`,
        headers: asDoctor(),
        payload: { price: '75.50' },
      });

      expect((response.json() as { price: string }).price).toBe('75.50');
    });

    it('converts an item exactly once', async () => {
      const first = await context.app.inject({
        method: 'POST',
        url: `/plan-items/${itemId}/convert`,
        headers: asDoctor(),
        payload: {},
      });
      expect(first.statusCode).toBe(201);

      const second = await context.app.inject({
        method: 'POST',
        url: `/plan-items/${itemId}/convert`,
        headers: asDoctor(),
        payload: {},
      });

      expect(second.statusCode).toBe(409);
    });

    it('refuses to edit an item once it has been converted', async () => {
      await context.app.inject({
        method: 'POST',
        url: `/plan-items/${itemId}/convert`,
        headers: asDoctor(),
        payload: {},
      });

      const response = await context.app.inject({
        method: 'PATCH',
        url: `/plan-items/${itemId}`,
        headers: asDoctor(),
        payload: { estimatedPrice: '10.00' },
      });

      expect(response.statusCode).toBe(409);
    });

    it('refuses a receptionist and a technician', async () => {
      for (const role of [USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN]) {
        const response = await context.app.inject({
          method: 'GET',
          url: `/treatment-plans?patientId=${patientId}`,
          headers: auth(tokens[role]),
        });

        expect(response.statusCode).toBe(403);
      }
    });
  });

  describe('audit log', () => {
    const entriesFor = async (entityId: string): Promise<AuditEntry[]> => {
      const response = await context.app.inject({
        method: 'GET',
        url: `/audit-log?entityId=${entityId}&limit=100`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });

      expect(response.statusCode).toBe(200);
      return (response.json() as { items: AuditEntry[] }).items;
    };

    it('records old and new values when a procedure is edited', async () => {
      const created = await createProcedure(45);
      const { id } = created.json() as { id: string };

      const updated = await context.app.inject({
        method: 'PATCH',
        url: `/performed-procedures/${id}`,
        headers: asDoctor(),
        payload: { price: '120.00', discount: '20.00', discountReason: 'مريض دائم' },
      });

      expect(updated.statusCode).toBe(200);

      const entries = await entriesFor(id);
      const update = entries.find((entry) => entry.action === 'update');

      expect(update).toBeDefined();
      expect(update?.entity).toBe('performed_procedures');
      expect(update?.oldValue).toMatchObject({ price: '60.00', discount: '0.00' });
      expect(update?.newValue).toMatchObject({ price: '120.00', discount: '20.00' });
    });

    it('records the create and the soft delete of a procedure', async () => {
      const created = await createProcedure(44);
      const { id } = created.json() as { id: string };

      const removed = await context.app.inject({
        method: 'DELETE',
        url: `/performed-procedures/${id}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });
      expect(removed.statusCode).toBe(204);

      const entries = await entriesFor(id);
      const actions = entries.map((entry) => entry.action);

      expect(actions).toContain('create');
      expect(actions).toContain('delete');
      expect(entries.find((entry) => entry.action === 'delete')?.newValue).toBeNull();
    });

    it('keys the medical history entry by the patient it belongs to', async () => {
      await context.app.inject({
        method: 'PATCH',
        url: `/patients/${patientId}/medical-history`,
        headers: asDoctor(),
        payload: { allergies: ['اللاتكس'] },
      });

      const entries = await entriesFor(patientId);
      const history = entries.find((entry) => entry.entity === 'medical_histories');

      expect(history).toBeDefined();
      expect(history?.newValue).toMatchObject({ allergies: ['اللاتكس'] });
    });

    it('records a plan-item conversion against the procedure it creates', async () => {
      const plan = await context.app.inject({
        method: 'POST',
        url: '/treatment-plans',
        headers: asDoctor(),
        payload: {
          patientId,
          doctorId: fixtures.doctorId,
          title: 'خطة للتدقيق',
          items: [{ procedureId: fixtures.catalogId }],
        },
      });

      const item = (plan.json() as { items: { id: string }[] }).items[0];

      const converted = await context.app.inject({
        method: 'POST',
        url: `/plan-items/${item?.id}/convert`,
        headers: asDoctor(),
        payload: {},
      });

      const procedureId = (converted.json() as { id: string }).id;
      const entries = await entriesFor(procedureId);

      expect(entries.map((entry) => entry.entity)).toContain('performed_procedures');
    });
  });
});
