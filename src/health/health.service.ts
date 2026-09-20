import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';

type DependencyStatus = 'up' | 'down';
export interface HealthStatus {
  status: 'ok' | 'degraded';
  service: 'agentiq-backend';
  timestamp: string;
  dependencies: { postgres: DependencyStatus; redis: DependencyStatus; minio: DependencyStatus };
}

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(
    @InjectDataSource() private readonly database: DataSource,
    private readonly config: ConfigService,
  ) {
    this.redis = new Redis(this.config.getOrThrow<string>('REDIS_URL'), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    this.redis.on('error', () => undefined);
  }

  async check(): Promise<HealthStatus> {
    const [postgres, redis, minio] = await Promise.all([
      this.checkPostgres(), this.checkRedis(), this.checkMinio(),
    ]);
    const dependencies = { postgres, redis, minio };
    return {
      status: Object.values(dependencies).every((value) => value === 'up') ? 'ok' : 'degraded',
      service: 'agentiq-backend',
      timestamp: new Date().toISOString(),
      dependencies,
    };
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status !== 'end') await this.redis.quit();
  }

  private async checkPostgres(): Promise<DependencyStatus> {
    try { await this.database.query('SELECT 1'); return 'up'; } catch { return 'down'; }
  }
  private async checkRedis(): Promise<DependencyStatus> {
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      return (await this.redis.ping()) === 'PONG' ? 'up' : 'down';
    } catch { return 'down'; }
  }
  private async checkMinio(): Promise<DependencyStatus> {
    try {
      const endpoint = this.config.getOrThrow<string>('MINIO_ENDPOINT');
      return (await fetch(`${endpoint}/minio/health/live`)).ok ? 'up' : 'down';
    } catch { return 'down'; }
  }
}
