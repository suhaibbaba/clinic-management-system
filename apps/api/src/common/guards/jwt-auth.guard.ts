import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import { IS_PUBLIC_KEY } from '@api/common/decorators/public.decorator';
import type { AccessTokenPayload, RequestWithUser } from '@api/common/types/authenticated-user';
import type { Env } from '@api/config/env.schema';

/**
 * Global authentication guard (ROLES.md enforcement step 1). Verifies the
 * bearer access token and attaches the caller to the request. Endpoints marked
 * `@Public()` are skipped.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get('JWT_SECRET', { infer: true }),
      });
    } catch {
      // Expired and malformed tokens are indistinguishable to the caller on
      // purpose — the client refreshes on any 401 from a protected route.
      throw new UnauthorizedException('Invalid or expired access token');
    }

    request.user = {
      id: payload.sub,
      clinicId: payload.clinicId,
      role: payload.role,
    };

    return true;
  }
}

function extractBearerToken(request: RequestWithUser): string | null {
  const header = request.headers['authorization'];
  const value = Array.isArray(header) ? header[0] : header;

  if (!value) {
    return null;
  }

  const [scheme, token] = value.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}
