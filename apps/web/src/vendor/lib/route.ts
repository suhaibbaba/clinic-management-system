import { VENDOR_BASE } from "@web/vendor/constants";

export type VendorRoute =
  | { readonly kind: "login" }
  | { readonly kind: "clinics" }
  | { readonly kind: "clinic"; readonly id: string }
  | { readonly kind: "plans" }
  | { readonly kind: "not-found" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseVendorRoute(pathname: string): VendorRoute {
  const rest = pathname.replace(/\/+$/, "").slice(VENDOR_BASE.length);
  const [first, second, ...more] = rest.split("/").filter(Boolean);

  if (more.length > 0) {
    return { kind: "not-found" };
  }

  if (first === undefined) {
    return { kind: "clinics" };
  }

  if (first === "login" && second === undefined) {
    return { kind: "login" };
  }

  if (first === "plans" && second === undefined) {
    return { kind: "plans" };
  }

  if (first === "clinics" && second !== undefined && UUID.test(second)) {
    return { kind: "clinic", id: second };
  }

  return { kind: "not-found" };
}

export const vendorPath = (route: Exclude<VendorRoute, { kind: "not-found" }>): string => {
  switch (route.kind) {
    case "login":
      return `${VENDOR_BASE}/login`;
    case "clinics":
      return VENDOR_BASE;
    case "plans":
      return `${VENDOR_BASE}/plans`;
    case "clinic":
      return `${VENDOR_BASE}/clinics/${route.id}`;
  }
};
