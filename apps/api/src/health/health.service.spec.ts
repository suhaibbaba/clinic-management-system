import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { healthResponseSchema } from '@clinic/shared';

import { DATABASE, type Database } from '@api/database/database.module';
import { HealthService } from '@api/health/health.service';

describe('HealthService', () => {
  // The degraded path logs the probe failure on purpose; keep test output clean.
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  const buildService = async (execute: jest.Mock): Promise<HealthService> => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: DATABASE, useValue: { execute } as unknown as Database },
        { provide: ConfigService, useValue: { get: (): string => '0.1.0' } },
      ],
    }).compile();

    return moduleRef.get(HealthService);
  };

  it('reports ok and a schema-valid payload when the database answers', async () => {
    const service = await buildService(jest.fn().mockResolvedValue([{ '?column?': 1 }]));

    const result = await service.check();

    expect(result.status).toBe('ok');
    expect(result.database).toBe('up');
    expect(healthResponseSchema.safeParse(result).success).toBe(true);
  });

  it('reports degraded instead of throwing when the database is unreachable', async () => {
    const service = await buildService(jest.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const result = await service.check();

    expect(result.status).toBe('degraded');
    expect(result.database).toBe('down');
  });
});
