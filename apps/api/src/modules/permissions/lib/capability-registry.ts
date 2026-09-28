import { type UserRole } from "@clinic/shared";

export interface Capability {
  readonly key: string;
  readonly resource: string;
  readonly method: string;
  readonly path: string;
  readonly defaultRoles: UserRole[];
}

export const scopeOf = (controller: { name: string }): string =>
  controller.name
    .replace(/Controller$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();

export const joinPath = (...segments: string[]): string =>
  `/${segments
    .flatMap((segment) => segment.split("/"))
    .filter(Boolean)
    .join("/")}`;
