import { Inject, Injectable, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { AI_TOOL_ERROR, USER_ROLE, type AiTableView, type AiToolError } from "@clinic/shared";
import type { Sql } from "postgres";
import {
  guardQuery,
  QUERY_REFUSAL,
  QUERY_ROW_LIMIT,
  QueryRefused,
} from "@api/ai/query/query-guard";
import { ToolRefusal } from "@api/ai/tools/ai-tool";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { CapabilityRegistry } from "@api/permissions/capability-registry.service";
import { PermissionsService } from "@api/permissions/permissions.service";

export const AI_READ_CLIENT = Symbol("AI_READ_CLIENT");

/** Declared here, not by a route: it is the permission to ask the clinic's data a free question. */
export const QUERY_CAPABILITY = "reports.list";

/** The clinical views read what the visit screen reads, so they borrow its permission. */
export const CLINICAL_CAPABILITY = "visits.findOne";

const STATEMENT_TIMEOUT = "5s";

const REFUSALS: Record<QueryRefused["code"], AiToolError> = {
  [QUERY_REFUSAL.UNPARSEABLE]: AI_TOOL_ERROR.QUERY_UNPARSEABLE,
  [QUERY_REFUSAL.MULTIPLE_STATEMENTS]: AI_TOOL_ERROR.QUERY_MULTIPLE_STATEMENTS,
  [QUERY_REFUSAL.NOT_SELECT]: AI_TOOL_ERROR.QUERY_NOT_SELECT,
  [QUERY_REFUSAL.RELATION_NOT_ALLOWED]: AI_TOOL_ERROR.QUERY_RELATION_NOT_ALLOWED,
  [QUERY_REFUSAL.FUNCTION_NOT_ALLOWED]: AI_TOOL_ERROR.QUERY_FUNCTION_NOT_ALLOWED,
};

export interface QueryResult {
  readonly columns: string[];
  readonly rows: Record<string, unknown>[];
  readonly truncated: boolean;
}

// A second, small pool whose every query runs read-only as `ai_reader`, which may read the
// `ai_read` views and nothing else; the views filter on `app.clinic_id`, set here per query.
@Injectable()
export class QueryDataService implements OnModuleInit, OnApplicationShutdown {
  constructor(
    @Inject(AI_READ_CLIENT) private readonly client: Sql,
    private readonly permissions: PermissionsService,
    private readonly registry: CapabilityRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.declare({
      key: QUERY_CAPABILITY,
      resource: "reports",
      method: "GET",
      path: "/ai/query",
      defaultRoles: [USER_ROLE.ADMIN, USER_ROLE.DOCTOR],
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }

  async run(actor: AuthenticatedUser, sql: string): Promise<QueryResult> {
    let guarded: ReturnType<typeof guardQuery>;

    try {
      guarded = guardQuery(sql);
    } catch (error) {
      if (error instanceof QueryRefused) {
        throw new ToolRefusal(REFUSALS[error.code], [error.detail]);
      }
      throw error;
    }

    if (
      guarded.clinical &&
      !(await this.permissions.allows(actor.clinicId, actor.role, CLINICAL_CAPABILITY))
    ) {
      throw new ToolRefusal(AI_TOOL_ERROR.QUERY_CLINICAL_NOT_PERMITTED);
    }

    try {
      const result = await this.client.begin("read only", async (tx) => {
        await tx`SET LOCAL ROLE ai_reader`;
        await tx.unsafe(`SET LOCAL statement_timeout = '${STATEMENT_TIMEOUT}'`);
        await tx`SELECT set_config('app.clinic_id', ${actor.clinicId}, true)`;

        return tx.unsafe(guarded.sql);
      });

      const columns = result.columns.map((column) => column.name);

      return {
        columns,
        rows: result.map((row) => plain(row as Record<string, unknown>)),
        truncated: result.length >= QUERY_ROW_LIMIT,
      };
    } catch (error) {
      if (isPostgresError(error) && error.code === QUERY_CANCELED) {
        throw new ToolRefusal(AI_TOOL_ERROR.QUERY_TIMEOUT);
      }

      // Its own words are what the model needs to fix the query: they name a column, never data.
      if (isPostgresError(error)) {
        throw new ToolRefusal(AI_TOOL_ERROR.QUERY_ERROR, [error.message]);
      }

      throw error;
    }
  }
}

/** The page draws the rows as they came; every column is text, labelled by its own name. */
export function queryView(result: QueryResult): AiTableView {
  return {
    type: "table",
    columns: result.columns.map((key) => ({ key, label: key, kind: "text" as const })),
    rows: result.rows.map((row, index) => ({ id: String(index), ...row })),
    truncated: result.truncated,
  };
}

const QUERY_CANCELED = "57014";

function isPostgresError(error: unknown): error is { code: string; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "PostgresError" &&
    typeof (error as { code?: unknown }).code === "string"
  );
}

// A `Date` walked as an object is `{}`; the model reads an instant, which the runner localises.
function plain(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value instanceof Date
        ? value.toISOString()
        : typeof value === "bigint"
          ? String(value)
          : value,
    ]),
  );
}
