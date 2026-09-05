import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from '@api/app.module';
import { registerFastifyPlugins } from '@api/bootstrap';
import type { Env } from '@api/config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
  );

  await registerFastifyPlugins(app);

  const config = app.get(ConfigService<Env, true>);
  const port = config.get('PORT', { infer: true });
  const host = config.get('HOST', { infer: true });

  app.enableCors({
    origin: config.get('CORS_ORIGIN', { infer: true }),
    // The refresh cookie must ride along on cross-origin calls.
    credentials: true,
  });

  // Lets DatabaseModule close the pool on SIGTERM from Docker.
  app.enableShutdownHooks();

  await app.listen({ port, host });
  Logger.log(`API listening on http://${host}:${port}`, 'Bootstrap');
}

void bootstrap();
