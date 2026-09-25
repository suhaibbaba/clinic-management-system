import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { READ_VIEWS, renderReadSchema } from "@api/ai/query/catalogue";

// The newest migration that creates the views; 0029 was the first, and an applied one is never
// rewritten, so a catalogue change lands as a new one that recreates them.
const MIGRATION = join(__dirname, "..", "drizzle", "0043_ai_read_views.sql");
const SNAPSHOT = join(__dirname, "..", "drizzle", "meta", "0043_snapshot.json");

interface Snapshot {
  readonly tables: Record<string, { name: string; columns: Record<string, unknown> }>;
}

// The views are what the model is told exists; the migration is what does. Rendered from one list
// and held equal here — `WRITE_AI_READ=1` rewrites the migration after a catalogue change.
describe("the ai_read catalogue", () => {
  it("is exactly the migration that creates it", () => {
    const rendered = `${renderReadSchema()}\n`;

    if (process.env["WRITE_AI_READ"] === "1") {
      writeFileSync(MIGRATION, rendered);
    }

    expect(readFileSync(MIGRATION, "utf8")).toBe(rendered);
  });

  it("names only columns the tables have", () => {
    const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as Snapshot;
    const columns = new Map(
      Object.values(snapshot.tables).map((table) => [
        table.name,
        new Set(Object.keys(table.columns)),
      ]),
    );
    const missing: string[] = [];

    for (const view of READ_VIEWS) {
      const own = columns.get(view.from);

      if (!own) {
        missing.push(`${view.name}: no table ${view.from}`);
        continue;
      }

      for (const column of view.columns) {
        const source = column.sql ?? `t.${column.name}`;

        for (const [, alias, name] of source.matchAll(/\b(t|u|p)\.([a-z_]+)/g)) {
          const table = alias === "t" ? view.from : alias === "u" ? "users" : "procedure_catalog";

          if (!columns.get(table)?.has(name ?? "")) {
            missing.push(`${view.name}.${column.name}: ${table}.${name ?? ""}`);
          }
        }
      }

      if (view.softDeleted && !own.has("deleted_at")) {
        missing.push(`${view.name}: ${view.from} has no deleted_at`);
      }

      if (!own.has("clinic_id")) {
        missing.push(`${view.name}: ${view.from} has no clinic_id`);
      }
    }

    expect(missing).toEqual([]);
  });

  it("never exposes a whole phone number", () => {
    const exposed = READ_VIEWS.flatMap((view) =>
      view.columns.filter((column) => /phone/.test(column.name) && !column.name.endsWith("_last4")),
    );

    expect(exposed).toEqual([]);
  });
});
