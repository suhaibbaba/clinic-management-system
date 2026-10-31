import { AUDIT_ACTION, USER_ROLE, type AuditLogEntry, type UserRole } from "@clinic/shared";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

interface CatalogItem {
  readonly id: string;
  readonly isActive: boolean;
}

describe("Price list bulk actions (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  const tokens = {} as Record<UserRole, string>;
  let sequence = 0;

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    for (const role of Object.values(USER_ROLE)) {
      tokens[role] = await context.login(clinic.phones[role]);
    }
  });

  afterAll(async () => {
    await context.close();
  });

  const createItem = async (): Promise<CatalogItem> => {
    sequence += 1;
    const response = await context.app.inject({
      method: "POST",
      url: "/procedure-catalog",
      headers: auth(tokens[USER_ROLE.ADMIN]),
      payload: {
        specialtyId: clinic.specialtyId,
        code: `BULK-${sequence}`,
        name: `Bulk procedure ${sequence}`,
        defaultPrice: "100",
      },
    });

    expect(response.statusCode).toBe(201);

    return response.json() as CatalogItem;
  };

  const findItem = (id: string) =>
    context.app.inject({
      method: "GET",
      url: `/procedure-catalog/${id}`,
      headers: auth(tokens[USER_ROLE.ADMIN]),
    });

  const auditOf = async (id: string): Promise<AuditLogEntry[]> => {
    const response = await context.app.inject({
      method: "GET",
      url: `/audit-log?entityId=${id}&limit=100`,
      headers: auth(tokens[USER_ROLE.ADMIN]),
    });

    return response.json().items as AuditLogEntry[];
  };

  it("deactivates and reactivates several procedures, auditing each", async () => {
    const items = [await createItem(), await createItem()];
    const ids = items.map((item) => item.id);
    const setActive = (isActive: boolean) =>
      context.app.inject({
        method: "PATCH",
        url: "/procedure-catalog/active",
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { ids, isActive },
      });

    const off = await setActive(false);

    expect(off.statusCode).toBe(200);
    expect((off.json() as CatalogItem[]).map((item) => item.isActive)).toEqual([false, false]);

    for (const id of ids) {
      const updates = (await auditOf(id)).filter((entry) => entry.action === AUDIT_ACTION.UPDATE);

      expect(updates).toHaveLength(1);
      expect(updates[0]?.oldValue).toMatchObject({ isActive: true });
      expect(updates[0]?.newValue).toMatchObject({ isActive: false });
    }

    expect((await setActive(true)).statusCode).toBe(200);
    expect((await findItem(ids[0] as string)).json()).toMatchObject({ isActive: true });
  });

  it("soft-deletes several procedures, auditing each", async () => {
    const items = [await createItem(), await createItem()];
    const ids = items.map((item) => item.id);

    const response = await context.app.inject({
      method: "POST",
      url: "/procedure-catalog/remove",
      headers: auth(tokens[USER_ROLE.ADMIN]),
      payload: { ids },
    });

    expect(response.statusCode).toBe(204);

    for (const id of ids) {
      expect((await findItem(id)).statusCode).toBe(404);
      expect(
        (await auditOf(id)).filter((entry) => entry.action === AUDIT_ACTION.DELETE),
      ).toHaveLength(1);
    }
  });

  it("changes nothing when one id is not in the clinic", async () => {
    const mine = await createItem();
    const other = await context.createClinic();
    const otherAdmin = await context.login(other.phones[USER_ROLE.ADMIN]);
    const theirs = await context.app.inject({
      method: "POST",
      url: "/procedure-catalog",
      headers: auth(otherAdmin),
      payload: {
        specialtyId: other.specialtyId,
        code: "THEIRS-1",
        name: "Theirs",
        defaultPrice: "100",
      },
    });

    const response = await context.app.inject({
      method: "POST",
      url: "/procedure-catalog/remove",
      headers: auth(tokens[USER_ROLE.ADMIN]),
      payload: { ids: [mine.id, (theirs.json() as CatalogItem).id] },
    });

    expect(response.statusCode).toBe(404);
    expect((await findItem(mine.id)).statusCode).toBe(200);
  });

  it.each([USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN])(
    "refuses %s the bulk actions",
    async (role) => {
      const item = await createItem();

      const switched = await context.app.inject({
        method: "PATCH",
        url: "/procedure-catalog/active",
        headers: auth(tokens[role]),
        payload: { ids: [item.id], isActive: false },
      });
      const removed = await context.app.inject({
        method: "POST",
        url: "/procedure-catalog/remove",
        headers: auth(tokens[role]),
        payload: { ids: [item.id] },
      });

      expect(switched.statusCode).toBe(403);
      expect(removed.statusCode).toBe(403);
    },
  );
});
