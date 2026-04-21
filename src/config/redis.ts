import Redis from 'ioredis';
import { singleton } from 'tsyringe';
import { env } from './env';

@singleton()
export class RedisClient {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      host: env.redis.host,
      port: env.redis.port,
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}
