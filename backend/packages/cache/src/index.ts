import Redis from "ioredis";

const KEY_PREFIX = process.env.REDIS_KEY_PREFIX || "crd360:";

// ── Redis client singleton ─────────────────────────────────────────────────
export const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || "0", 10),
  keyPrefix: KEY_PREFIX,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  tls: process.env.REDIS_TLS === "true" ? {} : undefined,
  reconnectOnError(err) {
    return err.message.includes("READONLY");
  },
});

redis.on("error", (err) => {
  console.error("[Redis] Connection error:", err.message);
});

redis.on("connect", () => {
  console.log("[Redis] Connected");
});

// ── Cache helper ───────────────────────────────────────────────────────────
export class CacheService {
  private client: Redis;
  private namespace: string;

  constructor(namespace: string, client = redis) {
    this.client = client;
    this.namespace = namespace;
  }

  private key(k: string): string {
    return `${this.namespace}:${k}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(this.key(key));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.setex(this.key(key), ttlSeconds, serialized);
    } else {
      await this.client.set(this.key(key), serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(this.key(key));
  }

  async delPattern(pattern: string): Promise<void> {
    const fullPattern = KEY_PREFIX + this.namespace + ":" + pattern;
    const keys = await this.client.keys(fullPattern);
    if (keys.length > 0) {
      const strippedKeys = keys.map(k => k.replace(KEY_PREFIX, ""));
      await this.client.del(...strippedKeys);
    }
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(this.key(key))) === 1;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(this.key(key));
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(this.key(key));
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(this.key(key), ttlSeconds);
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await factory();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }
}

// ── Named caches ───────────────────────────────────────────────────────────
export const tenantCache = new CacheService("tenant");
export const sessionCache = new CacheService("session");
export const rateLimitCache = new CacheService("ratelimit");
export const permissionCache = new CacheService("permission");
export const otpCache = new CacheService("otp");

export default redis;
