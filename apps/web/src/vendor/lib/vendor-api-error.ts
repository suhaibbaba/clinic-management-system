import {
  AUTH_ERROR,
  VENDOR_DOMAIN_TAKEN,
  VENDOR_EMAIL_TAKEN,
  VENDOR_MISSING_MODULES,
  VENDOR_PHONE_TAKEN,
  VENDOR_SLUG_TAKEN,
} from "@clinic/shared";

const CODED: Readonly<Record<string, string>> = {
  [VENDOR_MISSING_MODULES]: "vendor.errors.missingModules",
  [VENDOR_DOMAIN_TAKEN]: "vendor.errors.domainTaken",
  [VENDOR_SLUG_TAKEN]: "vendor.errors.slugTaken",
  [VENDOR_PHONE_TAKEN]: "vendor.errors.phoneTaken",
  [VENDOR_EMAIL_TAKEN]: "vendor.errors.emailTaken",
  [AUTH_ERROR.LOCKED]: "vendor.signIn.locked",
};

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

  const coded = error.code === undefined ? undefined : CODED[error.code];

  if (coded !== undefined) {
    return coded;
  }

  if (error.status === 401) {
    return "vendor.signIn.failed";
  }

  if (error.status === 409) {
    return "vendor.errors.duplicateCode";
  }

  return error.status === 404 ? "vendor.errors.notFound" : "vendor.errors.unknown";
};
