import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

export interface PortalSessionContext {
  readonly id: string;
  readonly clinicId: string;
  readonly phone: string;
  readonly expiresAt: Date;
}

export interface RequestWithPortal {
  portal?: PortalSessionContext;
  cookies?: Record<string, string | undefined>;
}

export const PortalSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PortalSessionContext => {
    const portal = context.switchToHttp().getRequest<RequestWithPortal>().portal;

    if (!portal) {
      throw new Error("PortalSession used on a route without PortalSessionGuard");
    }

    return portal;
  },
);
