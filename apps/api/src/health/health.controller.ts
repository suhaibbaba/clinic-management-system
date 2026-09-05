import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@clinic/shared';

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
