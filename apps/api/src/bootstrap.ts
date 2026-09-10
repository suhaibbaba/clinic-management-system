import fastifyCookie from '@fastify/cookie';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

/**
 * The HTTP adapter, built the same way for the server and for the tests.
 *
 * `trustProxy` is what makes `request.protocol`, `request.hostname` and
 * `request.ip` describe the *browser* rather than the last hop: the API is
 * never reached directly — nginx sits in front of it in production and the Vite
 * proxy does in development — so without it every request looks like plain http
 * from inside the Docker network. The refresh cookie's `Secure` attribute is
 * decided from that scheme (`refreshCookieSecurity`), and so is the throttler's
 * idea of who a caller is.
 */
export function createFastifyAdapter(): FastifyAdapter {
  return new FastifyAdapter({ trustProxy: true });
}

/**
 * Fastify plugins the application needs, in one place so the production
 * bootstrap and the test harness cannot drift apart — a plugin registered in
 * only one of them turns into a failure that no test can see.
 */
export async function registerFastifyPlugins(app: NestFastifyApplication): Promise<void> {
  // Refresh tokens travel in an httpOnly cookie; this adds the parse/serialise
  // support Fastify needs for that. The cast bridges @fastify/cookie's
  // instance-augmenting plugin type and the plain instance Nest's adapter
  // declares — a long-standing mismatch between the two typings.
  await app.register(fastifyCookie as unknown as Parameters<typeof app.register>[0]);
}
