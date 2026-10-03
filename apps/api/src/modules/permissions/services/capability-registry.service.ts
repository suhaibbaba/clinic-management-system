import { Injectable, Logger, type OnApplicationBootstrap, RequestMethod } from "@nestjs/common";
import { DiscoveryService, MetadataScanner, Reflector } from "@nestjs/core";
import { PATH_METADATA, METHOD_METADATA } from "@nestjs/common/constants";
import { type UserRole } from "@clinic/shared";
import { CAPABILITY_KEY } from "@api/common/decorators/capability.decorator";
import { ROLES_KEY } from "@api/common/decorators/roles.decorator";
import { IS_PUBLIC_KEY } from "@api/common/decorators/public.decorator";
import {
  Capability,
  MODULE_OF_RESOURCE,
  scopeOf,
} from "@api/modules/permissions/lib/capability-registry";
import { joinPath, METHOD_NAMES } from "@api/common/lib/routes";
import { RULE_CAPABILITIES } from "@api/modules/permissions/lib/rules";

@Injectable()
export class CapabilityRegistry implements OnApplicationBootstrap {
  private readonly logger = new Logger("Capabilities");
  private readonly byKey = new Map<string, Capability>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {
    for (const capability of RULE_CAPABILITIES) {
      this.byKey.set(capability.key, capability);
    }
  }

  onApplicationBootstrap(): void {
    for (const wrapper of this.discovery.getControllers()) {
      const { instance, metatype } = wrapper;

      if (!instance || !metatype) {
        continue;
      }

      const controllerPath = String(this.reflector.get<string>(PATH_METADATA, metatype) ?? "");
      const prototype = Object.getPrototypeOf(instance) as object;

      for (const name of this.scanner.getAllMethodNames(prototype)) {
        const handler = (instance as Record<string, unknown>)[name];

        if (typeof handler !== "function") {
          continue;
        }

        if (this.reflector.get<boolean>(IS_PUBLIC_KEY, handler)) {
          continue;
        }

        const declared =
          this.reflector.get<UserRole[]>(ROLES_KEY, handler) ??
          this.reflector.get<UserRole[]>(ROLES_KEY, metatype);

        if (!declared || declared.length === 0) {
          continue;
        }

        const key =
          this.reflector.get<string>(CAPABILITY_KEY, handler) ??
          `${scopeOf(metatype)}.${String(name)}`;
        const methodCode =
          this.reflector.get<number>(METHOD_METADATA, handler) ?? RequestMethod.GET;
        const path = joinPath(
          controllerPath,
          String(this.reflector.get<string>(PATH_METADATA, handler) ?? ""),
        );

        const resource = path.split("/")[1] ?? "root";

        this.byKey.set(key, {
          key,
          resource,
          method: METHOD_NAMES[methodCode] ?? "GET",
          path,
          defaultRoles: [...declared],
          module: MODULE_OF_RESOURCE[resource],
        });
      }
    }

    this.logger.log(`${this.byKey.size} capabilities discovered from the route table.`);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  keyFor(handler: Function, controller: Function): string {
    const explicit = this.reflector.get<string | undefined>(CAPABILITY_KEY, handler);

    if (explicit) {
      return explicit;
    }

    return `${scopeOf(controller)}.${handler.name}`;
  }

  declare(capability: Capability): void {
    this.byKey.set(capability.key, capability);
  }

  all(): Capability[] {
    return [...this.byKey.values()].sort(
      (a, b) => a.resource.localeCompare(b.resource) || a.key.localeCompare(b.key),
    );
  }

  get(key: string): Capability | undefined {
    return this.byKey.get(key);
  }
}
