import fastifyCookie from '@fastify/cookie';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

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
