import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { VENDOR_COOKIE_NAME } from "@api/modules/vendor/constants";
import { type RequestWithVendor } from "@api/modules/vendor/lib/vendor-session";
import { VendorAuthService } from "@api/modules/vendor/services/vendor-auth.service";

@Injectable()
export class VendorSessionGuard implements CanActivate {
  constructor(private readonly auth: VendorAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithVendor>();
    const token = request.cookies?.[VENDOR_COOKIE_NAME];
    const session = token ? await this.auth.sessionFor(token) : undefined;

    if (!session) {
      throw new UnauthorizedException("Sign in to the vendor console");
    }

    request.vendor = session;

    return true;
  }
}
