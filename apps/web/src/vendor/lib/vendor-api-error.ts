import { AUTH_ERROR, VENDOR_MISSING_MODULES } from "@clinic/shared";

export class VendorApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
  ) {
    super(`Vendor API answered ${status}`);
    this.name = "VendorApiError";
  }
}

export const vendorErrorKey = (error: unknown): string => {
  if (!(error instanceof VendorApiError)) {
    return "vendor.errors.unknown";
  }

  if (error.code === VENDOR_MISSING_MODULES) {
    return "vendor.errors.missingModules";
  }

  if (error.code === AUTH_ERROR.LOCKED) {
    return "vendor.signIn.locked";
  }

  if (error.status === 401) {
    return "vendor.signIn.failed";
  }

  if (error.status === 409) {
    return "vendor.errors.duplicateCode";
  }

  return error.status === 404 ? "vendor.errors.notFound" : "vendor.errors.unknown";
};
