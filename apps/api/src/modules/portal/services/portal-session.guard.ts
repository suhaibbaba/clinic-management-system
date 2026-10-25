import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { PORTAL_COOKIE_NAME } from "@api/modules/portal/constants";
import { type RequestWithPortal } from "@api/modules/portal/lib/portal-session";
import { PortalAuthService } from "@api/modules/portal/services/portal-auth.service";

@Injectable()
export class PortalSessionGuard implements CanActivate {
  constructor(private readonly auth: PortalAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithPortal>();
    const token = request.cookies?.[PORTAL_COOKIE_NAME];
    const session = token ? await this.auth.sessionFor(token) : undefined;

    if (!session) {
      throw new UnauthorizedException("Sign in to your patient account");
    }

    request.portal = session;

    return true;
  }
}
