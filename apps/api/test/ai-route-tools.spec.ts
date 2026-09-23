import { Controller, Get } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { AppModule } from "@api/app.module";
import { AiTool } from "@api/ai/tools/route-tool.decorator";
import { RouteToolRegistry } from "@api/ai/tools/route-tools";
import { AuditSnapshotRegistry } from "@api/audit/audit-snapshot.registry";
import { AuditService } from "@api/audit/audit.service";
import { CapabilityRegistry } from "@api/permissions/capability-registry.service";

// Compiling the graph queries nothing; the pool connects on its first query, which never comes.
process.env["DATABASE_URL"] ??= "postgres://nobody:nothing@127.0.0.1:1/none";

async function registry(): Promise<RouteToolRegistry> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  moduleRef.get(CapabilityRegistry).onApplicationBootstrap();

  return moduleRef.get(RouteToolRegistry);
}

describe("tools generated from routes", () => {
  let routes: RouteToolRegistry;

  beforeAll(async () => {
    routes = await registry();
  });

  // A newly decorated route is a visible diff here, with the tier it would ship on.
  it("is exactly the decorated routes, with their tiers", () => {
    expect(
      routes.list().map((tool) => `${tool.name} ${tool.verb} ${tool.risk ?? "read"} ${tool.group}`),
    ).toMatchSnapshot();
  });

  it("borrows each route's own capability, so the same guard answers", () => {
    expect(routes.get("visits_create")?.capability).toBe("visits.create");
    expect(routes.get("labs_create")?.capability).toBe("labs.create");
  });

  it("never shows the model a force-style override", () => {
    const shape = routes.get("clinic_closures_update")?.schema.shape ?? {};

    expect(Object.keys(shape)).toEqual(expect.arrayContaining(["id", "startsOn"]));
    expect(Object.keys(shape)).not.toContain("force");
    expect(Object.keys(shape)).not.toContain("cancelAppointments");
  });

  it("validates each part with the route's own schema, refinements included", () => {
    const closure = routes.get("clinic_closures_update");

    expect(() =>
      closure?.parse({
        id: "not-a-uuid",
        startsOn: "2026-10-05",
        endsOn: "2026-10-01",
      }),
    ).toThrow();
  });

  it("types a write by its verb, never auto", () => {
    const writes = routes.list().filter((tool) => tool.verb !== "GET");

    expect(writes.every((tool) => tool.risk === "confirm" || tool.risk === "typed")).toBe(true);
    expect(
      writes.filter((tool) => tool.verb === "DELETE").every((tool) => tool.risk === "typed"),
    ).toBe(true);
  });
});

@Controller("users")
class ForbiddenController {
  @AiTool({ group: "patients", description: "never" })
  @Get()
  list(): string[] {
    return [];
  }
}

describe("a route the assistant must never reach", () => {
  it("fails boot when decorated", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DiscoveryModule],
      controllers: [ForbiddenController],
      providers: [
        RouteToolRegistry,
        {
          provide: CapabilityRegistry,
          useValue: { keyFor: () => "users.list", get: () => undefined },
        },
        { provide: AuditSnapshotRegistry, useValue: {} },
        { provide: AuditService, useValue: {} },
      ],
    }).compile();

    expect(() => moduleRef.get(RouteToolRegistry).list()).toThrow(/may never reach/);
  });
});
