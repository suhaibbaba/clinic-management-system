import {
  astVisitor,
  parse,
  toSql,
  type SelectFromStatement,
  type SelectStatement,
  type Statement,
} from "pgsql-ast-parser";
import { CLINICAL_VIEWS, READ_SCHEMA, READ_VIEWS } from "@api/modules/ai/query/catalogue";

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
  readonly sql: string;
  readonly clinical: boolean;
  readonly views: readonly string[];
}

const VIEWS = new Set(READ_VIEWS.map((view) => view.name));

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

  let ctes = new Set<string>();
  const views = new Set<string>();
  let clinical = false;
  let refusal: QueryRefused | undefined;

  const scoped = (names: readonly string[], walkBody: () => void): void => {
    const outer = ctes;
    ctes = new Set(outer);
    for (const name of names) {
      ctes.add(name);
    }
    walkBody();
    ctes = outer;
  };

  const visitor = astVisitor((walk) => ({
    statement: (node) => {
      if (node.type === "with") {
        scoped([], () => {
          for (const bound of node.bind) {
            visitor.statement(bound.statement);
            ctes.add(bound.alias.name);
          }
          visitor.statement(node.in);
        });
        return;
      }
      if (node.type === "with recursive") {
        scoped([node.alias.name], () => walk.super().statement(node));
        return;
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
      views.add(table.name);
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

  return { sql: toSql.statement(clampLimit(statement)), clinical, views: [...views] };
}

function isRead(statement: Statement): statement is SelectStatement {
  return SELECTS.has(statement.type);
}

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
