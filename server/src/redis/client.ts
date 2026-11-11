import { Redis } from 'ioredis';
import { config } from '../config.js';

export interface RedisClientLike {
  mode: 'redis' | 'memory';
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  setIfNotExists(key: string, value: string, ttlSeconds?: number): Promise<boolean>;
  del(key: string): Promise<void>;
  sadd(key: string, member: string): Promise<void>;
  srem(key: string, member: string): Promise<void>;
  smembers(key: string): Promise<string[]>;
  rpush(key: string, value: string): Promise<void>;
  lpop(key: string): Promise<string | null>;
  lrem(key: string, value: string): Promise<void>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  ping(): Promise<string>;
  quit(): Promise<void>;
}

class MemoryRedisClient implements RedisClientLike {
  mode: 'redis' | 'memory' = 'memory';
  private kv = new Map<string, { val: string; expiresAt: number | null }>();
  private sets = new Map<string, Set<string>>();
  private lists = new Map<string, string[]>();

  private cleanIfExpired(key: string) {
    const entry = this.kv.get(key);
    if (entry && entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.kv.delete(key);
    }
  }

  async get(key: string): Promise<string | null> {
    this.cleanIfExpired(key);
    return this.kv.get(key)?.val ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.kv.set(key, {
      val: value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null
    });
  }

  async setIfNotExists(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    this.cleanIfExpired(key);
    if (this.kv.has(key)) return false;
    await this.set(key, value, ttlSeconds);
    return true;
  }

  async del(key: string): Promise<void> {
    this.kv.delete(key);
    this.sets.delete(key);
    this.lists.delete(key);
  }

  async sadd(key: string, member: string): Promise<void> {
    let set = this.sets.get(key);
    if (!set) {
      set = new Set();
      this.sets.set(key, set);
    }
    set.add(member);
  }

  async srem(key: string, member: string): Promise<void> {
    this.sets.get(key)?.delete(member);
  }

  async smembers(key: string): Promise<string[]> {
    return Array.from(this.sets.get(key) || []);
  }

  async rpush(key: string, value: string): Promise<void> {
    const list = this.lists.get(key) || [];
    list.push(value);
    this.lists.set(key, list);
  }

  async lpop(key: string): Promise<string | null> {
    const list = this.lists.get(key);
    if (!list || list.length === 0) return null;
    return list.shift() ?? null;
  }

  async lrem(key: string, value: string): Promise<void> {
    const list = this.lists.get(key);
    if (!list) return;
    this.lists.set(
      key,
      list.filter((item) => item !== value)
    );
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.lists.get(key) || [];
    const end = stop < 0 ? list.length + stop + 1 : stop + 1;
    return list.slice(start, end);
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async quit(): Promise<void> {
    this.kv.clear();
    this.sets.clear();
    this.lists.clear();
  }
}

class IoRedisAdapter implements RedisClientLike {
  mode: 'redis' | 'memory' = 'redis';
  constructor(private readonly client: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async setIfNotExists(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    const res =
      ttlSeconds && ttlSeconds > 0
        ? await this.client.set(key, value, 'EX', ttlSeconds, 'NX')
        : await this.client.set(key, value, 'NX');
    return res === 'OK';
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async sadd(key: string, member: string): Promise<void> {
    await this.client.sadd(key, member);
  }

  async srem(key: string, member: string): Promise<void> {
    await this.client.srem(key, member);
  }

  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  async rpush(key: string, value: string): Promise<void> {
    await this.client.rpush(key, value);
  }

  async lpop(key: string): Promise<string | null> {
    return this.client.lpop(key);
  }

  async lrem(key: string, value: string): Promise<void> {
    await this.client.lrem(key, 0, value);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.lrange(key, start, stop);
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async quit(): Promise<void> {
    await this.client.quit();
  }
}

let activeRedisClient: RedisClientLike | null = null;

export async function initRedisClient(): Promise<RedisClientLike> {
  if (activeRedisClient) return activeRedisClient;

  const raw = new Redis(config.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 2500,
    retryStrategy: () => null
  });
  raw.on('error', () => {
    // Handled cleanly below
  });

  try {
    await raw.connect();
    await raw.ping();
    console.log(`[Redis] Connected to ${config.redisUrl}`);
    activeRedisClient = new IoRedisAdapter(raw);
    return activeRedisClient;
  } catch (err) {
    try {
      raw.disconnect();
    } catch {
      // ignore
    }
    if (!config.allowInMemoryRedisFallback) {
      throw new Error(`Failed to connect to Redis at ${config.redisUrl}: ${(err as Error).message}`);
    }
    console.warn(
      `[Redis] Unavailable at ${config.redisUrl}; using in-memory Redis store fallback (dev mode).`
    );
    activeRedisClient = new MemoryRedisClient();
    return activeRedisClient;
  }
}

export function getRedis(): RedisClientLike {
  if (!activeRedisClient) {
    throw new Error('Redis client accessed before initialization');
  }
  return activeRedisClient;
}

export async function closeRedis(): Promise<void> {
  if (activeRedisClient) {
    await activeRedisClient.quit();
    activeRedisClient = null;
  }
}

