import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts an endpoint out of the global `JwtAuthGuard`. Reserved for login,
 * refresh, logout, health and — later — the anonymous booking endpoints.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
