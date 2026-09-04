import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, fetchHealth } from './api';

const healthPayload = {
  status: 'ok',
  database: 'up',
  version: '0.1.0',
  timestamp: '2026-01-01T00:00:00.000Z',
  uptimeSeconds: 12,
};

describe('fetchHealth', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses a health payload with the shared schema', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => healthPayload }),
    );

    await expect(fetchHealth()).resolves.toEqual(healthPayload);
  });

  it('throws an ApiError carrying the status code when the API fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }),
    );

    await expect(fetchHealth()).rejects.toBeInstanceOf(ApiError);
  });
});
