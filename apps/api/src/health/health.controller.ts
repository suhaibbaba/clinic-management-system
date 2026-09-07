import { Controller, Get } from '@nestjs/common';
import type { HealthResponse, VersionResponse } from '@clinic/shared';

import { Public } from '@api/common/decorators/public.decorator';
import { HealthService } from '@api/health/health.service';

/**
 * Thin controller (CLAUDE.md) — all logic lives in the service.
 * Unauthenticated by design: container healthchecks call it.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  check(): Promise<HealthResponse> {
    return this.healthService.check();
  }
}

/**
 * The deployed build's version.
 *
 * Public, and its own route rather than a field somebody has to run a database
 * probe to read: the settings screen asks for this to put a number next to the
 * one baked into its own bundle, and the two disagreeing is how a browser
 * holding a stale build announces itself.
 */
@Controller('version')
export class VersionController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  version(): VersionResponse {
    return { version: this.healthService.version() };
  }
}
