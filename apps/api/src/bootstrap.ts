import fastifyCookie from '@fastify/cookie';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

// `trustProxy` makes `request.protocol`/`hostname`/`ip` describe the browser rather than the last
// hop — nginx and the Vite proxy sit in front, so without it every request looks like plain http.
export function createFastifyAdapter(): FastifyAdapter {
  return new FastifyAdapter({ trustProxy: true });
}

// In one place so the production bootstrap and the test harness cannot drift: a plugin registered
// in only one turns into a failure no test can see.
export async function registerFastifyPlugins(app: NestFastifyApplication): Promise<void> {
  // The cast bridges @fastify/cookie's instance-augmenting plugin type and the plain instance
  // Nest's adapter declares.
  await app.register(fastifyCookie as unknown as Parameters<typeof app.register>[0]);
}
