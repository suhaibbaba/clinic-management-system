import { normalizeArabic, USER_ROLE, type PatientView } from "@clinic/shared";
import { sql } from "drizzle-orm";
import { createPatient, uniquePhone, nameParts } from "@test/helpers/patient-fixtures";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

describe("Arabic-aware search (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let token: string;

  const names = {
    ahmad: "أحمد خالد الحسن",
    fatima: "فاطمة عبد الرحمن",
    muhannad: "مهند سليم عودة",
    mahmoud: "محمود عودة",
    muhammad: "محمد سليم",
  };

  let ahmadPhone: string;
  let ahmadFileNumber: string;

  const search = async (term: string): Promise<PatientView[]> => {
    const response = await context.app.inject({
      method: "GET",
      url: `/patients?search=${encodeURIComponent(term)}&limit=20`,
      headers: auth(token),
    });

    expect(response.statusCode).toBe(200);

    return (response.json() as { items: PatientView[] }).items;
  };

  const namesFrom = (items: readonly PatientView[]): string[] => items.map((item) => item.fullName);

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();
    token = await context.login(clinic.phones[USER_ROLE.RECEPTIONIST]);

    ahmadPhone = uniquePhone();

    const ahmadId = await createPatient(context, token, {
      ...nameParts(names.ahmad),
      phone: ahmadPhone,
    });

    for (const fullName of [names.fatima, names.muhannad, names.mahmoud, names.muhammad]) {
      await createPatient(context, token, { ...nameParts(fullName), phone: uniquePhone() });
    }

    const created = await context.app.inject({
      method: "GET",
      url: `/patients/${ahmadId}`,
      headers: auth(token),
    });
    ahmadFileNumber = (created.json() as { fileNumber: string }).fileNumber;
  });

  afterAll(async () => {
    await context.close();
  });

  describe("folding", () => {
    it("finds a hamza it was not given", async () => {
      expect(namesFrom(await search("احمد"))).toContain(names.ahmad);
      expect(namesFrom(await search("أحمد"))).toContain(names.ahmad);
    });

    it("finds a taa marbuta written as a haa, and the other way round", async () => {
      expect(namesFrom(await search("فاطمه"))).toContain(names.fatima);
      expect(namesFrom(await search("فاطمة"))).toContain(names.fatima);
      expect(namesFrom(await search("محمود عوده"))).toContain(names.mahmoud);
    });

    it("finds a name through a typo", async () => {
      expect(namesFrom(await search("مهنند"))).toContain(names.muhannad);
    });
  });

  describe("ranking", () => {
    it("puts an exactly folded match above a fuzzy one", async () => {
      const items = namesFrom(await search("محمود"));

      expect(items).toContain(names.muhammad);
      expect(items.indexOf(names.mahmoud)).toBeLessThan(items.indexOf(names.muhammad));
    });

    it("ranks a prefix above a match in the middle of the name", async () => {
      const items = namesFrom(await search("سليم"));

      expect(items.indexOf(names.muhammad)).toBeLessThan(items.indexOf(names.muhannad));
    });
  });

  describe("phone and file number", () => {
    it("is unaffected: both still match exactly", async () => {
      expect(namesFrom(await search(ahmadPhone))).toEqual([names.ahmad]);
      expect(namesFrom(await search(ahmadFileNumber))).toEqual([names.ahmad]);
    });

    it("does not fuzzy-match a phone number onto the wrong patient", async () => {
      const wrong = `${ahmadPhone.slice(0, -1)}${ahmadPhone.endsWith("9") ? "8" : "9"}`;

      expect(namesFrom(await search(wrong))).not.toContain(names.ahmad);
    });
  });

  it("folds the same way in Postgres as it does in TypeScript", async () => {
    const cases = [
      "أحمد",
      "إيمان",
      "آية الله",
      "ٱلرحمن",
      "فاطمة",
      "مُهَنَّد",
      "مَحمــ__ود",
      "رئيس مسؤول",
      "  محمود   عودة  ",
      "Dr. Layla  Haddad",
      "ليلى",
    ];

    const inPostgres = await Promise.all(
      cases.map(async (value) => {
        const [row] = await context.db.execute<{ folded: string }>(
          sql`select normalize_arabic(${value}) as folded`,
        );

        return row?.folded;
      }),
    );

    expect(inPostgres).toEqual(cases.map((value) => normalizeArabic(value)));
  });
});
