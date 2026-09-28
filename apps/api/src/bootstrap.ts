import fastifyCookie from "@fastify/cookie";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";

export function createFastifyAdapter(): FastifyAdapter {
  return new FastifyAdapter({ trustProxy: trustedProxies() });
}

export function trustedProxies(): string {
  return process.env["TRUST_PROXY"]?.trim() || "loopback, linklocal, uniquelocal";
}

export async function registerFastifyPlugins(app: NestFastifyApplication): Promise<void> {
  await app.register(fastifyCookie as unknown as Parameters<typeof app.register>[0]);
}
