import {
  APPOINTMENT_TYPE,
  CHART_TYPE,
  ATTACHMENT_TYPE,
  ITEM_CATEGORY,
  ITEM_UNIT,
  LOOKUP_LIST,
  PAYMENT_METHOD,
  SYSTEM_LOOKUPS,
  offersLookup,
  TOOTH_STATE,
  USER_ROLE,
  type LookupBundle,
  type LookupOption,
  type UserRole,
} from "@clinic/shared";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";
import { eq } from "drizzle-orm";
import { specialties } from "@api/database/schema";
import { ensureSystemLookups } from "@api/database/system-lookups";

describe("Lookups (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  const tokens = {} as Record<UserRole, string>;

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

  const list = async (
    listKey: string,
    token = tokens[USER_ROLE.ADMIN],
  ): Promise<LookupOption[]> => {
    const response = await context.app.inject({
      method: "GET",
      url: `/lookups?listKey=${listKey}`,
      headers: auth(token),
    });

    expect(response.statusCode).toBe(200);

    return (response.json() as LookupBundle)[listKey] ?? [];
  };

  describe("the built-in rows", () => {
    it("seeds every list a new clinic needs, keyed by the old enum values", async () => {
      const response = await context.app.inject({
        method: "GET",
        url: "/lookups",
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });

      expect(response.statusCode).toBe(200);
      const bundle = response.json() as LookupBundle;

      for (const [listKey, rows] of Object.entries(SYSTEM_LOOKUPS)) {
        const codes = (bundle[listKey] ?? []).map((option) => option.code);
        const offered = rows.filter((row) =>
          offersLookup([CHART_TYPE.TOOTH_FDI], {
            listKey: listKey as keyof typeof SYSTEM_LOOKUPS,
            code: row.code,
            isSystem: true,
          }),
        );
        expect(codes).toEqual(expect.arrayContaining(offered.map((row) => row.code)));
      }
    });

    it.each([
      [LOOKUP_LIST.TOOTH_STATE, Object.values(TOOTH_STATE)],
      [LOOKUP_LIST.APPOINTMENT_TYPE, Object.values(APPOINTMENT_TYPE)],
      [LOOKUP_LIST.PAYMENT_METHOD, Object.values(PAYMENT_METHOD)],
      [LOOKUP_LIST.ATTACHMENT_TYPE, Object.values(ATTACHMENT_TYPE)],
      [LOOKUP_LIST.ITEM_CATEGORY, Object.values(ITEM_CATEGORY)],
      [LOOKUP_LIST.ITEM_UNIT, Object.values(ITEM_UNIT)],
    ])("keeps every value the %s enum held, as a code", async (listKey, values) => {
      const codes = (await list(listKey)).map((option) => option.code);

      expect(codes).toEqual(expect.arrayContaining([...values]));
      for (const option of await list(listKey)) {
        expect(option.name.ar).toBeTruthy();
        expect(option.name.en).toBeTruthy();
      }
    });

    it("carries the chart behaviour the tooth chart draws from", async () => {
      const missing = (await list(LOOKUP_LIST.TOOTH_STATE)).find(
        (option) => option.code === "missing",
      );

      expect(missing?.isSystem).toBe(true);
      expect(missing?.meta).toMatchObject({ chartBehavior: { shape: "missing" } });
    });

    it("lets the clinic switch one off, and stops offering it", async () => {
      const [card] = (await list(LOOKUP_LIST.PAYMENT_METHOD)).filter(
        (option) => option.code === "card",
      );

      const response = await context.app.inject({
        method: "PATCH",
        url: `/lookups/${card?.id}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { isActive: false },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ code: "card", isSystem: true, isActive: false });
      expect((await list(LOOKUP_LIST.PAYMENT_METHOD)).map((option) => option.code)).not.toContain(
        "card",
      );

      const back = await context.app.inject({
        method: "PATCH",
        url: `/lookups/${card?.id}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { isActive: true },
      });

      expect(back.statusCode).toBe(200);
    });

    it("lets the clinic delete one, and stops accepting the code", async () => {
      const own = await context.createClinic();
      const admin = await context.login(own.phones[USER_ROLE.ADMIN]);
      const [transfer] = (await list(LOOKUP_LIST.PAYMENT_METHOD, admin)).filter(
        (option) => option.code === "transfer",
      );

      const response = await context.app.inject({
        method: "DELETE",
        url: `/lookups/${transfer?.id}`,
        headers: auth(admin),
      });

      expect(response.statusCode).toBe(204);
      expect(
        (await list(LOOKUP_LIST.PAYMENT_METHOD, admin)).map((option) => option.code),
      ).not.toContain("transfer");

      expect((await list(LOOKUP_LIST.PAYMENT_METHOD)).map((option) => option.code)).toContain(
        "transfer",
      );
    });

    it("does not resurrect a retired built-in row on the next deploy", async () => {
      const own = await context.createClinic();
      const admin = await context.login(own.phones[USER_ROLE.ADMIN]);
      const rows = await list(LOOKUP_LIST.ITEM_UNIT, admin);
      const [removed] = rows.filter((option) => option.code === "ampoule");
      const [switchedOff] = rows.filter((option) => option.code === "ml");

      await context.app.inject({
        method: "DELETE",
        url: `/lookups/${removed?.id}`,
        headers: auth(admin),
      });
      await context.app.inject({
        method: "PATCH",
        url: `/lookups/${switchedOff?.id}`,
        headers: auth(admin),
        payload: { isActive: false },
      });

      await ensureSystemLookups(context.db, own.id);

      const after = await list(LOOKUP_LIST.ITEM_UNIT, admin);
      expect(after.map((option) => option.code)).not.toContain("ampoule");
      expect(after.map((option) => option.code)).not.toContain("ml");
    });

    it("lets the clinic rename one", async () => {
      const [cash] = (await list(LOOKUP_LIST.PAYMENT_METHOD)).filter(
        (option) => option.code === "cash",
      );

      const response = await context.app.inject({
        method: "PATCH",
        url: `/lookups/${cash?.id}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { name: { ar: "خالص", en: "Settled" } },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ code: "cash", name: { ar: "خالص", en: "Settled" } });
    });
  });

  describe("a clinic that charts no teeth", () => {
    let ortho: TestClinic;
    let token: string;

    beforeAll(async () => {
      ortho = await context.createClinic();
      await context.db
        .update(specialties)
        .set({ chartType: CHART_TYPE.BODY_REGION })
        .where(eq(specialties.id, ortho.specialtyId));
      await ensureSystemLookups(context.db, ortho.id);
      token = await context.login(ortho.phones[USER_ROLE.ADMIN]);
    });

    it("is offered the body regions and none of the dental rows it was seeded with", async () => {
      const codes = async (listKey: string) =>
        (await list(listKey, token)).map((option) => option.code);

      expect(await codes(LOOKUP_LIST.TOOTH_STATE)).toEqual([]);
      expect(await codes(LOOKUP_LIST.LAB_SHADE)).toEqual([]);
      expect(await codes(LOOKUP_LIST.BODY_REGION)).toContain("knee");
      expect(await codes(LOOKUP_LIST.LAB_WORK_TYPE)).not.toContain("zirconia_crown");
      expect(await codes(LOOKUP_LIST.ATTACHMENT_TYPE)).toEqual(
        expect.arrayContaining(["clinical_photo", "document"]),
      );
      expect(await codes(LOOKUP_LIST.ATTACHMENT_TYPE)).not.toContain("xray_panoramic");
      expect(await codes(LOOKUP_LIST.DRUG_INSTRUCTION)).not.toContain("rinse_spit");
    });

    it("cannot add to a list its charts do not draw, but can add a lab work type", async () => {
      const add = (listKey: string, name: string) =>
        context.app.inject({
          method: "POST",
          url: "/lookups",
          headers: auth(token),
          payload: { listKey, name: { ar: name, en: name } },
        });

      expect((await add(LOOKUP_LIST.TOOTH_STATE, "Cracked")).statusCode).toBe(404);
      expect((await add(LOOKUP_LIST.LAB_WORK_TYPE, "Knee brace")).statusCode).toBe(201);
      expect(await list(LOOKUP_LIST.LAB_WORK_TYPE, token)).toEqual([
        expect.objectContaining({ name: expect.objectContaining({ en: "Knee brace" }) }),
      ]);
    });
  });

  describe("a clinic list of its own", () => {
    let createdId: string;

    it("derives a code from the English name", async () => {
      const response = await context.app.inject({
        method: "POST",
        url: "/lookups",
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: {
          listKey: LOOKUP_LIST.TOOTH_STATE,
          name: { ar: "وجه تجميلي", en: "Veneer" },
          color: "#c084fc",
        },
      });

      expect(response.statusCode).toBe(201);
      const option = response.json() as LookupOption;
      expect(option).toMatchObject({ code: "veneer", isSystem: false, isActive: true });
      createdId = option.id;
    });

    it("refuses a second option with the same code", async () => {
      const response = await context.app.inject({
        method: "POST",
        url: "/lookups",
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { listKey: LOOKUP_LIST.TOOTH_STATE, name: { ar: "آخر", en: "Veneer" } },
      });

      expect(response.statusCode).toBe(409);
    });

    it("accepts the new code where the enum used to be the only answer", async () => {
      const response = await context.app.inject({
        method: "POST",
        url: "/procedure-catalog",
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: {
          specialtyId: clinic.specialtyId,
          code: "VNR-1",
          name: "Veneer",
          defaultPrice: "150.00",
          chartOutcome: "veneer",
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ chartOutcome: "veneer" });
    });

    it("refuses a code that is on no list", async () => {
      const response = await context.app.inject({
        method: "POST",
        url: "/procedure-catalog",
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: {
          specialtyId: clinic.specialtyId,
          code: "VNR-2",
          name: "Unknown",
          defaultPrice: "150.00",
          chartOutcome: "sparkles",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("reorders a whole list at once", async () => {
      const before = await list(LOOKUP_LIST.TOOTH_STATE);
      const ids = [...before].reverse().map((option) => option.id);

      const response = await context.app.inject({
        method: "PATCH",
        url: "/lookups/reorder",
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { listKey: LOOKUP_LIST.TOOTH_STATE, ids },
      });

      expect(response.statusCode).toBe(200);
      expect((await list(LOOKUP_LIST.TOOTH_STATE)).map((option) => option.id)).toEqual(ids);
    });

    it("switches several options of one list off and on at once", async () => {
      const before = await list(LOOKUP_LIST.APPOINTMENT_TYPE);
      const ids = before.slice(0, 2).map((option) => option.id);
      const setActive = (isActive: boolean) =>
        context.app.inject({
          method: "PATCH",
          url: "/lookups/active",
          headers: auth(tokens[USER_ROLE.ADMIN]),
          payload: { listKey: LOOKUP_LIST.APPOINTMENT_TYPE, ids, isActive },
        });

      const off = await setActive(false);

      expect(off.statusCode).toBe(200);
      expect(
        (off.json() as LookupOption[])
          .filter((option) => ids.includes(option.id))
          .map((option) => option.isActive),
      ).toEqual([false, false]);
      expect((await list(LOOKUP_LIST.APPOINTMENT_TYPE)).map((option) => option.id)).not.toEqual(
        expect.arrayContaining(ids),
      );

      const audit = await context.app.inject({
        method: "GET",
        url: `/audit-log?entityId=${ids[0]}&action=update&limit=100`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });

      expect(audit.json().items[0]).toMatchObject({
        oldValue: { isActive: true },
        newValue: { isActive: false },
      });

      expect((await setActive(true)).statusCode).toBe(200);
      expect((await list(LOOKUP_LIST.APPOINTMENT_TYPE)).map((option) => option.id)).toEqual(
        before.map((option) => option.id),
      );
    });

    it("refuses to switch an option that is not on the named list", async () => {
      const [other] = await list(LOOKUP_LIST.PAYMENT_METHOD);

      const response = await context.app.inject({
        method: "PATCH",
        url: "/lookups/active",
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { listKey: LOOKUP_LIST.APPOINTMENT_TYPE, ids: [other?.id], isActive: false },
      });

      expect(response.statusCode).toBe(404);
    });

    it("soft-deletes one the clinic added, and stops offering it", async () => {
      const response = await context.app.inject({
        method: "DELETE",
        url: `/lookups/${createdId}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });

      expect(response.statusCode).toBe(204);
      expect((await list(LOOKUP_LIST.TOOTH_STATE)).map((option) => option.code)).not.toContain(
        "veneer",
      );
    });
  });

  describe("permissions (ROLES.md: clinic settings are the admin's)", () => {
    it("lets every signed-in role read the lists", async () => {
      for (const role of [USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN]) {
        expect((await list(LOOKUP_LIST.APPOINTMENT_TYPE, tokens[role])).length).toBeGreaterThan(0);
      }
    });

    it.each([USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN])(
      "refuses %s a new option",
      async (role) => {
        const response = await context.app.inject({
          method: "POST",
          url: "/lookups",
          headers: auth(tokens[role]),
          payload: {
            listKey: LOOKUP_LIST.APPOINTMENT_TYPE,
            name: { ar: "استشارة", en: "Consult" },
          },
        });

        expect(response.statusCode).toBe(403);
      },
    );

    it.each([USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN])(
      "refuses %s switching options off in bulk",
      async (role) => {
        const [option] = await list(LOOKUP_LIST.APPOINTMENT_TYPE);

        const response = await context.app.inject({
          method: "PATCH",
          url: "/lookups/active",
          headers: auth(tokens[role]),
          payload: { listKey: LOOKUP_LIST.APPOINTMENT_TYPE, ids: [option?.id], isActive: false },
        });

        expect(response.statusCode).toBe(403);
      },
    );

    it("does not reach another clinic (a cross-clinic id is 404)", async () => {
      const other = await context.createClinic();
      const otherAdmin = await context.login(other.phones[USER_ROLE.ADMIN]);
      const [mine] = await list(LOOKUP_LIST.APPOINTMENT_TYPE);

      const response = await context.app.inject({
        method: "PATCH",
        url: `/lookups/${mine?.id}`,
        headers: auth(otherAdmin),
        payload: { name: { ar: "مسروق" } },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
