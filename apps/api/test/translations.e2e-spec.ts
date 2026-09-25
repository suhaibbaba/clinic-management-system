import {
  TRANSLATION_BATCH_MAX,
  USER_ROLE,
  type TranslationBundle,
  type TranslationOverride,
  type UserRole,
} from "@clinic/shared";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

describe("Translations (e2e)", () => {
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

  const get = (url: string, token: string) =>
    context.app.inject({ method: "GET", url, headers: auth(token) });

  const post = (url: string, token: string, payload: Record<string, unknown>) =>
    context.app.inject({ method: "POST", url, headers: auth(token), payload });

  const bundle = async (token: string): Promise<TranslationBundle> => {
    const response = await get("/translations", token);

    expect(response.statusCode).toBe(200);

    return response.json() as TranslationBundle;
  };

  it("starts empty: nothing is copied out of the locale files", async () => {
    expect(await bundle(tokens[USER_ROLE.ADMIN])).toEqual({ ar: {}, en: {} });
  });

  it("returns a saved override nested the way i18next takes a bundle", async () => {
    const saved = await post("/translations", tokens[USER_ROLE.ADMIN], {
      language: "ar",
      key: "labs.orders.title",
      value: "أعمال المخابر",
    });

    expect(saved.statusCode).toBe(201);
    expect(await bundle(tokens[USER_ROLE.ADMIN])).toEqual({
      ar: { labs: { orders: { title: "أعمال المخابر" } } },
      en: {},
    });
  });

  it("overwrites rather than stacking a second row on the same key", async () => {
    await post("/translations", tokens[USER_ROLE.ADMIN], {
      language: "ar",
      key: "labs.orders.title",
      value: "المخابر",
    });

    const response = await get("/translations/overrides", tokens[USER_ROLE.ADMIN]);
    const rows = response.json() as TranslationOverride[];

    expect(rows.filter((row) => row.key === "labs.orders.title")).toHaveLength(1);
  });

  // The shipped default has to keep moving with the deploy, so a reset removes the row rather than
  // writing today's string into it.
  it("resets a key by dropping it out of the bundle", async () => {
    const response = await post("/translations/reset", tokens[USER_ROLE.ADMIN], {
      language: "ar",
      key: "labs.orders.title",
    });

    expect(response.statusCode).toBe(204);
    expect(await bundle(tokens[USER_ROLE.ADMIN])).toEqual({ ar: {}, en: {} });
  });

  it("frees the key, so it can be overridden again", async () => {
    const response = await post("/translations", tokens[USER_ROLE.ADMIN], {
      language: "ar",
      key: "labs.orders.title",
      value: "مرة أخرى",
    });

    expect(response.statusCode).toBe(201);
  });

  describe("saving a screenful at once", () => {
    it("writes every row of the batch", async () => {
      const response = await post("/translations/save", tokens[USER_ROLE.ADMIN], {
        items: [
          { language: "ar", key: "nav.patients", value: "المراجعون" },
          { language: "en", key: "nav.patients", value: "Clients" },
          { language: "ar", key: "nav.labs", value: "المخابر" },
        ],
      });

      expect(response.statusCode).toBe(204);

      const saved = await bundle(tokens[USER_ROLE.ADMIN]);

      expect(saved.ar).toMatchObject({ nav: { patients: "المراجعون", labs: "المخابر" } });
      expect(saved.en).toMatchObject({ nav: { patients: "Clients" } });
    });

    // Clearing the box is how the shipped wording comes back, so a blank value deletes the row
    // rather than storing an empty label.
    it("treats a blank value as a reset", async () => {
      const response = await post("/translations/save", tokens[USER_ROLE.ADMIN], {
        items: [
          { language: "ar", key: "nav.patients", value: "   " },
          { language: "en", key: "nav.patients", value: "" },
        ],
      });

      expect(response.statusCode).toBe(204);

      const saved = await bundle(tokens[USER_ROLE.ADMIN]);

      expect(saved.ar.nav).not.toHaveProperty("patients");
      expect(saved.en).not.toHaveProperty("nav");
    });

    it("trims what it stores, so a stray space is not the wording", async () => {
      await post("/translations/save", tokens[USER_ROLE.ADMIN], {
        items: [{ language: "ar", key: "nav.appointments", value: "  الحجوزات  " }],
      });

      const saved = await bundle(tokens[USER_ROLE.ADMIN]);

      expect((saved.ar as { nav: { appointments: string } }).nav.appointments).toBe("الحجوزات");
    });

    // Refused whole by the schema, before a row is written: the transaction behind it never starts,
    // which is the same outcome the footer needs — all of it or none.
    it("writes none of the batch when one row is refused", async () => {
      const before = await bundle(tokens[USER_ROLE.ADMIN]);

      const response = await post("/translations/save", tokens[USER_ROLE.ADMIN], {
        items: [
          { language: "ar", key: "nav.inventory", value: "المخزن" },
          { language: "ar", key: "__proto__.polluted", value: "x" },
        ],
      });

      expect(response.statusCode).toBe(400);
      expect(await bundle(tokens[USER_ROLE.ADMIN])).toEqual(before);
    });

    it("refuses an empty batch and one beyond its cap", async () => {
      const empty = await post("/translations/save", tokens[USER_ROLE.ADMIN], { items: [] });
      const tooMany = await post("/translations/save", tokens[USER_ROLE.ADMIN], {
        items: Array.from({ length: TRANSLATION_BATCH_MAX + 1 }, (_, index) => ({
          language: "ar" as const,
          key: `nav.k${index}`,
          value: "x",
        })),
      });

      expect(empty.statusCode).toBe(400);
      expect(tooMany.statusCode).toBe(400);
    });

    it.each([USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN])(
      "refuses a batch from %s",
      async (role) => {
        const response = await post("/translations/save", tokens[role], {
          items: [{ language: "ar", key: "nav.patients", value: "x" }],
        });

        expect(response.statusCode).toBe(403);
      },
    );
  });

  it.each([USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN])(
    "lets %s read the bundle — it is the wording of their own screens",
    async (role) => {
      const response = await get("/translations", tokens[role]);

      expect(response.statusCode).toBe(200);
    },
  );

  it.each([USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN])(
    "refuses a write and a reset from %s",
    async (role) => {
      const written = await post("/translations", tokens[role], {
        language: "ar",
        key: "nav.patients",
        value: "x",
      });
      const wasReset = await post("/translations/reset", tokens[role], {
        language: "ar",
        key: "nav.patients",
      });

      expect(written.statusCode).toBe(403);
      expect(wasReset.statusCode).toBe(403);
    },
  );

  it.each([USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN])(
    "keeps the override list to an admin, refusing %s",
    async (role) => {
      const response = await get("/translations/overrides", tokens[role]);

      expect(response.statusCode).toBe(403);
    },
  );

  it.each(["__proto__.polluted", "constructor.prototype", "a..b", "1bad", "a b", ""])(
    "refuses %p, which is not a path into the locale files",
    async (key) => {
      const response = await post("/translations", tokens[USER_ROLE.ADMIN], {
        language: "ar",
        key,
        value: "x",
      });

      expect(response.statusCode).toBe(400);
    },
  );

  it("refuses a language the app does not ship", async () => {
    const response = await post("/translations", tokens[USER_ROLE.ADMIN], {
      language: "fr",
      key: "nav.patients",
      value: "x",
    });

    expect(response.statusCode).toBe(400);
  });

  it("keeps one clinic's wording out of another's", async () => {
    const other = await context.createClinic();
    const otherAdmin = await context.login(other.phones[USER_ROLE.ADMIN]);

    expect(await bundle(otherAdmin)).toEqual({ ar: {}, en: {} });
  });
});
