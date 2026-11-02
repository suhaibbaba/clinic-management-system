import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { type FastifyRequest } from "fastify";
import { type RequestSite } from "@api/common/types/request-site";

export const CurrentSite = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestSite => {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    return {
      host: request.hostname.toLowerCase(),
      origin: `${request.protocol}://${request.host.toLowerCase()}`,
    };
  },
);
