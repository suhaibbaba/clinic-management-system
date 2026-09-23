import { guardQuery, QUERY_REFUSAL, QueryRefused } from "@api/ai/query/query-guard";

const refusal = (sql: string): string => {
  try {
    guardQuery(sql);
  } catch (error) {
    if (error instanceof QueryRefused) {
      return error.code;
    }
    throw error;
  }

  return "accepted";
};

describe("what query_data will run", () => {
  it("refuses a table, only the ai_read views are readable", () => {
    expect(refusal("SELECT * FROM patients")).toBe(QUERY_REFUSAL.RELATION_NOT_ALLOWED);
    expect(refusal("SELECT * FROM public.patients")).toBe(QUERY_REFUSAL.RELATION_NOT_ALLOWED);
    expect(refusal("SELECT * FROM pg_catalog.pg_roles")).toBe(QUERY_REFUSAL.RELATION_NOT_ALLOWED);
    expect(refusal("SELECT * FROM ai_read.nope")).toBe(QUERY_REFUSAL.RELATION_NOT_ALLOWED);
  });

  it("refuses a table reached through a join, a subquery or a CTE", () => {
    expect(
      refusal("SELECT p.id FROM ai_read.patients p JOIN public.visits v ON v.patient_id = p.id"),
    ).toBe(QUERY_REFUSAL.RELATION_NOT_ALLOWED);
    expect(
      refusal("SELECT * FROM ai_read.patients WHERE id IN (SELECT patient_id FROM visits)"),
    ).toBe(QUERY_REFUSAL.RELATION_NOT_ALLOWED);
    expect(refusal("WITH x AS (SELECT * FROM users) SELECT * FROM x")).toBe(
      QUERY_REFUSAL.RELATION_NOT_ALLOWED,
    );
  });

  it("refuses a second statement and anything that is not a read", () => {
    expect(refusal("SELECT 1 FROM ai_read.patients; SELECT 2 FROM ai_read.patients")).toBe(
      QUERY_REFUSAL.MULTIPLE_STATEMENTS,
    );
    expect(refusal("DELETE FROM ai_read.patients")).toBe(QUERY_REFUSAL.NOT_SELECT);
    expect(refusal("UPDATE ai_read.patients SET full_name = 'x'")).toBe(QUERY_REFUSAL.NOT_SELECT);
    expect(refusal("WITH d AS (DELETE FROM ai_read.patients RETURNING id) SELECT * FROM d")).toBe(
      QUERY_REFUSAL.NOT_SELECT,
    );
  });

  it("refuses a function off the list — set_config could move the clinic scope", () => {
    expect(refusal("SELECT set_config('app.clinic_id', 'x', true) FROM ai_read.patients")).toBe(
      QUERY_REFUSAL.FUNCTION_NOT_ALLOWED,
    );
    expect(refusal("SELECT pg_read_file('/etc/passwd')")).toBe(QUERY_REFUSAL.FUNCTION_NOT_ALLOWED);
    expect(refusal("SELECT pg_sleep(10) FROM ai_read.patients")).toBe(
      QUERY_REFUSAL.FUNCTION_NOT_ALLOWED,
    );
  });

  it("accepts an aggregate over views, through a CTE, and marks a clinical read", () => {
    const plain = guardQuery(
      "WITH last AS (SELECT patient_id, max(starts_at) AS at FROM ai_read.appointments GROUP BY patient_id) " +
        "SELECT p.full_name, last.at FROM ai_read.patients p JOIN last ON last.patient_id = p.id " +
        "WHERE last.at < now() - interval '6 months' ORDER BY last.at",
    );

    expect(plain.clinical).toBe(false);
    expect(guardQuery("SELECT count(*) FROM ai_read.visit_clinical").clinical).toBe(true);
  });

  it("clamps the limit, and adds one when there is none", () => {
    expect(guardQuery("SELECT id FROM ai_read.patients").sql).toMatch(/LIMIT \(?200\)?/i);
    expect(guardQuery("SELECT id FROM ai_read.patients LIMIT 5000").sql).toMatch(
      /LIMIT \(?200\)?/i,
    );
    expect(guardQuery("SELECT id FROM ai_read.patients LIMIT 10").sql).toMatch(
      /LIMIT \(?10\)?(?!0)/i,
    );
    expect(
      guardQuery("SELECT id FROM ai_read.patients UNION SELECT id FROM ai_read.doctors").sql,
    ).toMatch(/LIMIT \(?200\)?/i);
  });

  it("refuses what it cannot parse", () => {
    expect(refusal("SELEC nonsense")).toBe(QUERY_REFUSAL.UNPARSEABLE);
  });
});
