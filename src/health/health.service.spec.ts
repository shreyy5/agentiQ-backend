import { describe, expect, it, vi } from 'vitest';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('reports degraded when dependencies are unavailable', async () => {
    const database = { query: vi.fn().mockRejectedValue(new Error('offline')) };
    const config = { getOrThrow: vi.fn((key: string) => key === 'REDIS_URL' ? 'redis://127.0.0.1:1' : 'http://127.0.0.1:1') };
    const service = new HealthService(database as never, config as never);
    const result = await service.check();
    expect(result.status).toBe('degraded');
    expect(result.dependencies).toEqual({ postgres: 'down', redis: 'down', minio: 'down' });
    await service.onModuleDestroy();
  });
});
