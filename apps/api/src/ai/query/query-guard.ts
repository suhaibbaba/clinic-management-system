import {
  astVisitor,
  parse,
  toSql,
  type SelectFromStatement,
  type SelectStatement,
  type Statement,
} from "pgsql-ast-parser";
import { CLINICAL_VIEWS, READ_SCHEMA, READ_VIEWS } from "@api/ai/query/catalogue";

export const QUERY_ROW_LIMIT = 200;

export const QUERY_REFUSAL = {
  UNPARSEABLE: "query_unparseable",
  MULTIPLE_STATEMENTS: "query_multiple_statements",
  NOT_SELECT: "query_not_select",
  RELATION_NOT_ALLOWED: "query_relation_not_allowed",
  FUNCTION_NOT_ALLOWED: "query_function_not_allowed",
} as const;
export type QueryRefusal = (typeof QUERY_REFUSAL)[keyof typeof QUERY_REFUSAL];

export class QueryRefused extends Error {
  constructor(
    readonly code: QueryRefusal,
    readonly detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = "QueryRefused";
  }
}

export interface GuardedQuery {
  /** The statement to run: re-printed from the parsed tree, with its limit clamped. */
  readonly sql: string;
  readonly clinical: boolean;
}

const VIEWS = new Set(READ_VIEWS.map((view) => view.name));

// An allow-list, not a deny-list: `set_config` alone could move `app.clinic_id` under the views'
// feet mid-query, and every role may call it.
const FUNCTIONS = new Set([
  "count",
  "sum",
  "avg",
  "min",
  "max",
  "coalesce",
  "nullif",
  "greatest",
  "least",
  "round",
  "floor",
  "ceil",
  "abs",
  "lower",
  "upper",
  "length",
  "trim",
  "concat",
  "left",
  "right",
  "substring",
  "string_agg",
  "array_agg",
  "date_trunc",
  "date_part",
  "extract",
  "to_char",
  "age",
  "now",
  "timezone",
  "row_number",
  "rank",
  "dense_rank",
  "percentile_cont",
  "bool_and",
  "bool_or",
  "jsonb_array_length",
]);

const SELECTS = new Set(["select", "union", "union all", "values", "with", "with recursive"]);

/** Parses, checks and re-prints the model's SQL; refuses anything that is not a plain read. */
export function guardQuery(sql: string): GuardedQuery {
  let statements: Statement[];

  try {
    statements = parse(sql);
  } catch (error) {
    throw new QueryRefused(
      QUERY_REFUSAL.UNPARSEABLE,
      error instanceof Error ? (error.message.split("\n")[0] ?? "") : "",
    );
  }

  if (statements.length !== 1) {
    throw new QueryRefused(QUERY_REFUSAL.MULTIPLE_STATEMENTS, `${statements.length} statements`);
  }

  const [statement] = statements as [Statement];

  if (!isRead(statement)) {
    throw new QueryRefused(QUERY_REFUSAL.NOT_SELECT, statement.type);
  }

  const ctes = new Set<string>();
  let clinical = false;
  let refusal: QueryRefused | undefined;

  const visitor = astVisitor((walk) => ({
    statement: (node) => {
      if (node.type === "with") {
        for (const bound of node.bind) {
          ctes.add(bound.alias.name);
        }
      }
      if (node.type === "with recursive") {
        ctes.add(node.alias.name);
      }
      if (!isRead(node)) {
        refusal ??= new QueryRefused(QUERY_REFUSAL.NOT_SELECT, node.type);
      }

      walk.super().statement(node);
    },
    tableRef: (table) => {
      const schema = table.schema;

      if (schema === undefined && ctes.has(table.name)) {
        return;
      }

      if (schema !== READ_SCHEMA || !VIEWS.has(table.name)) {
        refusal ??= new QueryRefused(
          QUERY_REFUSAL.RELATION_NOT_ALLOWED,
          `${schema ? `${schema}.` : ""}${table.name}`,
        );
        return;
      }

      clinical ||= CLINICAL_VIEWS.has(table.name);
    },
    call: (call) => {
      const name = call.function.name.toLowerCase();

      if (call.function.schema !== undefined || !FUNCTIONS.has(name)) {
        refusal ??= new QueryRefused(QUERY_REFUSAL.FUNCTION_NOT_ALLOWED, name);
      }

      walk.super().call(call);
    },
  }));

  visitor.statement(statement);

  if (refusal) {
    throw refusal;
  }

  return { sql: toSql.statement(clampLimit(statement)), clinical };
}

function isRead(statement: Statement): statement is SelectStatement {
  return SELECTS.has(statement.type);
}

// The outermost select is the result; a union or a VALUES list is wrapped so the clamp applies.
function clampLimit(statement: SelectStatement): SelectStatement {
  if (statement.type === "with" || statement.type === "with recursive") {
    return { ...statement, in: clampLimit(statement.in as SelectStatement) } as SelectStatement;
  }

  if (statement.type !== "select") {
    return {
      type: "select",
      columns: [{ expr: { type: "ref", name: "*" } }],
      from: [{ type: "statement", statement, alias: "q" }],
      limit: { limit: integer(QUERY_ROW_LIMIT) },
    } satisfies SelectFromStatement;
  }

  const current = statement.limit?.limit;
  const asked = current?.type === "integer" ? current.value : Number.POSITIVE_INFINITY;

  return {
    ...statement,
    limit: { ...statement.limit, limit: integer(Math.min(asked, QUERY_ROW_LIMIT)) },
  };
}

const integer = (value: number) => ({ type: "integer" as const, value });
