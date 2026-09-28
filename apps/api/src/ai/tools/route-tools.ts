import { Injectable, Logger, RequestMethod, type ExecutionContext } from "@nestjs/common";
import {
  CUSTOM_ROUTE_ARGS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
  ROUTE_ARGS_METADATA,
} from "@nestjs/common/constants";
import { RouteParamtypes } from "@nestjs/common/enums/route-paramtypes.enum";
import { DiscoveryService, MetadataScanner, Reflector } from "@nestjs/core";
import { AI_RISK_TIER, type AiRiskTier } from "@clinic/shared";
import { from, lastValueFrom } from "rxjs";
import { z } from "zod";
import { AI_ROUTE_TOOL, type AiToolOptions } from "@api/ai/tools/route-tool.decorator";
import type { ToolGroup } from "@api/ai/tools/tool-groups";
import { AuditInterceptor } from "@api/audit/audit.interceptor";
import { AuditSnapshotRegistry } from "@api/audit/audit-snapshot.registry";
import { AuditService } from "@api/audit/audit.service";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { CapabilityRegistry } from "@api/permissions/capability-registry.service";

const FORBIDDEN_AREAS = [
  "auth",
  "users",
  "permissions",
  "clinic",
  "clinics",
  "ai",
  "secrets",
  "translations",
  "lookups",
  "booking",
  "storage",
] as const;

const FORBIDDEN_PATHS = /(presign|attachments|\.pdf|\/print|\/export|\/receipt|\/logo|\/photo)/;

export interface RouteTool {
  readonly name: string;
  readonly group: ToolGroup;
  readonly description: string;
  readonly capability: string | null;
  readonly verb: string;
  readonly path: string;
  readonly risk: AiRiskTier | null;
  readonly schema: z.ZodObject;
  parse(
    args: Record<string, unknown>,
  ): Record<"params" | "query" | "body", Record<string, unknown>>;
  invoke(actor: AuthenticatedUser, args: Record<string, unknown>): Promise<unknown>;
}

interface Part {
  readonly source: "params" | "query" | "body";
  readonly schema: z.ZodType;
  readonly keys: readonly string[];
}

const METHOD_NAMES: Record<number, string> = {
  [RequestMethod.GET]: "GET",
  [RequestMethod.POST]: "POST",
  [RequestMethod.PUT]: "PUT",
  [RequestMethod.DELETE]: "DELETE",
  [RequestMethod.PATCH]: "PATCH",
};

type Handler = (...args: unknown[]) => unknown;

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- Nest's own type for a class
type ControllerClass = Function;

@Injectable()
export class RouteToolRegistry {
  private readonly logger = new Logger("Assistant");
  private tools: RouteTool[] | undefined;
  private readonly audit: AuditInterceptor;

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
    private readonly capabilities: CapabilityRegistry,
    snapshots: AuditSnapshotRegistry,
    auditService: AuditService,
  ) {
    this.audit = new AuditInterceptor(reflector, snapshots, auditService);
  }

  list(): RouteTool[] {
    this.tools ??= this.discover();

    return this.tools;
  }

  get(name: string): RouteTool | undefined {
    return this.list().find((tool) => tool.name === name);
  }

  private discover(): RouteTool[] {
    const tools: RouteTool[] = [];
    const unrated: string[] = [];

    for (const wrapper of this.discovery.getControllers()) {
      const { instance, metatype } = wrapper;

      if (!instance || !metatype) {
        continue;
      }

      const prototype = Object.getPrototypeOf(instance) as object;
      const controllerPath = String(this.reflector.get<string>(PATH_METADATA, metatype) ?? "");

      for (const method of this.scanner.getAllMethodNames(prototype)) {
        const handler = (instance as Record<string, unknown>)[method];

        if (typeof handler !== "function") {
          continue;
        }

        const options = this.reflector.get<AiToolOptions | undefined>(AI_ROUTE_TOOL, handler);

        if (!options) {
          continue;
        }

        const path = joinPath(
          controllerPath,
          String(this.reflector.get(PATH_METADATA, handler) ?? ""),
        );
        const area = path.split("/")[1] ?? "";

        if ((FORBIDDEN_AREAS as readonly string[]).includes(area) || FORBIDDEN_PATHS.test(path)) {
          throw new Error(
            `@AiTool on ${metatype.name}.${method} (${path}): the assistant may never reach this route`,
          );
        }

        const verb =
          METHOD_NAMES[this.reflector.get<number>(METHOD_METADATA, handler) ?? 0] ?? "GET";
        const tool = this.build({
          metatype,
          instance,
          method,
          handler: handler as Handler,
          options,
          verb,
          path,
        });

        if (tool.risk !== null && options.risk === undefined) {
          unrated.push(tool.name);
        }

        tools.push(tool);
      }
    }

    if (unrated.length > 0) {
      this.logger.warn(`Route tools on their verb's default tier: ${unrated.sort().join(", ")}`);
    }

    return tools.sort((a, b) => a.name.localeCompare(b.name));
  }

  private build(route: {
    metatype: ControllerClass;
    instance: object;
    method: string;
    handler: Handler;
    options: AiToolOptions;
    verb: string;
    path: string;
  }): RouteTool {
    const { metatype, instance, method, handler, options, verb, path } = route;
    const name = `${snake(metatype.name.replace(/Controller$/, ""))}_${snake(method)}`;
    const argsMeta = (Reflect.getMetadata(ROUTE_ARGS_METADATA, metatype, method) ?? {}) as Record<
      string,
      {
        index: number;
        data?: unknown;
        factory?: (data: unknown, context: ExecutionContext) => unknown;
      }
    >;
    const types = (Reflect.getMetadata(
      "design:paramtypes",
      Object.getPrototypeOf(instance),
      method,
    ) ?? []) as unknown[];
    const parts: Part[] = [];
    const slots: ((context: Invocation) => unknown)[] = [];

    for (const [key, arg] of Object.entries(argsMeta)) {
      const type = Number(key.split(":")[0]);

      if (key.includes(CUSTOM_ROUTE_ARGS_METADATA)) {
        slots[arg.index] = (context) => arg.factory?.(arg.data, context.execution);
        continue;
      }

      const source =
        type === RouteParamtypes.BODY
          ? "body"
          : type === RouteParamtypes.QUERY
            ? "query"
            : type === RouteParamtypes.PARAM
              ? "params"
              : null;

      if (!source) {
        throw new Error(`@AiTool on ${name}: a ${key} argument cannot come from the model`);
      }

      if (typeof arg.data === "string") {
        const field = arg.data;

        parts.push({ source, schema: z.object({ [field]: z.string() }), keys: [field] });
        slots[arg.index] = (context) => context.parts[source][field];
        continue;
      }

      const dto = types[arg.index] as { isZodDto?: unknown; schema?: unknown } | undefined;

      if (dto?.isZodDto !== true || !(dto.schema instanceof z.ZodObject)) {
        throw new Error(`@AiTool on ${name}: its ${source} is not a Zod object DTO`);
      }

      const schema: z.ZodObject = dto.schema;

      parts.push({ source, schema, keys: Object.keys(schema.shape) });
      slots[arg.index] = (context) => context.parts[source];
    }

    const exclude = new Set(options.exclude ?? []);
    const shape: Record<string, z.ZodType> = {};

    for (const part of parts) {
      const own = part.schema instanceof z.ZodObject ? part.schema.shape : {};

      for (const key of part.keys) {
        if (key in shape) {
          throw new Error(`@AiTool on ${name}: "${key}" is in two parts of the request`);
        }
        if (!exclude.has(key)) {
          shape[key] = own[key] as z.ZodType;
        }
      }
    }

    const key = this.capabilities.keyFor(handler, metatype);

    const parse = (args: Record<string, unknown>): Invocation["parts"] => {
      const values = { params: {}, query: {}, body: {} } as Invocation["parts"];

      for (const part of parts) {
        const picked = Object.fromEntries(
          part.keys
            .filter((field) => field in args && !exclude.has(field))
            .map((field) => [field, args[field]]),
        );

        values[part.source] = part.schema.parse(picked) as Record<string, unknown>;
      }

      return values;
    };

    return {
      name,
      group: options.group,
      description: options.description,
      capability: this.capabilities.get(key) ? key : null,
      verb,
      path,
      risk:
        verb === "GET"
          ? null
          : (options.risk ??
            (verb === "DELETE" || options.group === "billing"
              ? AI_RISK_TIER.TYPED
              : AI_RISK_TIER.CONFIRM)),
      schema: z.object(shape),
      parse,
      invoke: async (actor, args) => {
        const values = parse(args);
        const request = {
          user: actor,
          params: values.params,
          query: values.query,
          body: values.body,
          headers: {},
        };
        const execution = syntheticContext(request, handler, metatype);
        const invocation: Invocation = { parts: values, execution };
        const argsList = slots.map((slot) => slot?.(invocation));

        return lastValueFrom(
          this.audit.intercept(execution, {
            handle: () => from(Promise.resolve(handler.apply(instance, argsList))),
          }),
        );
      },
    };
  }
}

interface Invocation {
  readonly parts: Record<Part["source"], Record<string, unknown>>;
  readonly execution: ExecutionContext;
}

function syntheticContext(
  request: object,
  handler: Handler,
  metatype: ControllerClass,
): ExecutionContext {
  const http = { getRequest: () => request, getResponse: () => ({}), getNext: () => undefined };

  return {
    getHandler: () => handler,
    getClass: () => metatype,
    getType: () => "http",
    getArgs: () => [request],
    getArgByIndex: (index: number) => [request][index],
    switchToHttp: () => http,
    switchToRpc: () => {
      throw new Error("Not an RPC call");
    },
    switchToWs: () => {
      throw new Error("Not a socket");
    },
  } as unknown as ExecutionContext;
}

const snake = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/-/g, "_")
    .toLowerCase();

const joinPath = (...segments: string[]): string =>
  `/${segments
    .flatMap((segment) => segment.split("/"))
    .filter(Boolean)
    .join("/")}`;
