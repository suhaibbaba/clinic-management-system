import { createParamDecorator, UnauthorizedException, type ExecutionContext } from '@nestjs/common';

import type { AuthenticatedUser, RequestWithUser } from '@api/common/types/authenticated-user';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (!request.user) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    return request.user;
  },
);
