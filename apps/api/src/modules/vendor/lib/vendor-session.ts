import { createHash, randomBytes } from "node:crypto";
import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { VENDOR_SESSION_BYTES } from "@api/modules/vendor/constants";

export interface VendorSessionContext {
  readonly sessionId: string;
  readonly vendorUserId: string;
  readonly email: string;
  readonly name: string;
}

export interface RequestWithVendor {
  vendor?: VendorSessionContext;
  cookies?: Record<string, string | undefined>;
}

export const VendorSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): VendorSessionContext => {
    const vendor = context.switchToHttp().getRequest<RequestWithVendor>().vendor;

    if (!vendor) {
      throw new Error("VendorSession used on a route without VendorSessionGuard");
    }

    return vendor;
  },
);

export const generateVendorToken = (): string =>
  randomBytes(VENDOR_SESSION_BYTES).toString("base64url");

export const hashVendorToken = (token: string): string =>
  createHash("sha256").update(`vendor-session:${token}`).digest("hex");
