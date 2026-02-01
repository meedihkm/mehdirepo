// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - CACHE REDIS
// Cache, sessions, et file d'attente
// ═══════════════════════════════════════════════════════════════════════════════

import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// CONNEXION REDIS
// ═══════════════════════════════════════════════════════════════════════════════

let redis: Redis;

export const initializeRedis = async (): Promise<void> => {
  try {
    redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.error('Redis connection failed after 3 retries');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redis.on('connect', () => {
      logger.info('Redis connected');
    });

    redis.on('error', (error) => {
      logger.error('Redis error:', error);
    });

    redis.on('close', () => {
      logger.warn('Redis connection closed');
    });

    await redis.connect();
    
    // Test de connexion
    await redis.ping();
    
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
};

export const closeRedis = async (): Promise<void> => {
  if (redis) {
    await redis.quit();
    logger.info('Redis connection closed');
  }
};

export { redis };

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS CACHE
// ═══════════════════════════════════════════════════════════════════════════════

const CACHE_PREFIX = 'cache:';

/**
 * Récupérer une valeur du cache
 */
export const cacheGet = async <T>(key: string): Promise<T | null> => {
  const value = await redis.get(`${CACHE_PREFIX}${key}`);
  if (!value) return null;
  
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as unknown as T;
  }
};

/**
 * Stocker une valeur dans le cache
 */
export const cacheSet = async (
  key: string,
  value: any,
  ttlSeconds: number = 300
): Promise<void> => {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  await redis.set(`${CACHE_PREFIX}${key}`, serialized, 'EX', ttlSeconds);
};

/**
 * Supprimer une valeur du cache
 */
export const cacheDel = async (key: string): Promise<void> => {
  await redis.del(`${CACHE_PREFIX}${key}`);
};

/**
 * Supprimer plusieurs clés par pattern
 */
export const cacheDelPattern = async (pattern: string): Promise<void> => {
  const keys = await redis.keys(`${CACHE_PREFIX}${pattern}`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
};

/**
 * Cache-aside pattern: récupérer ou calculer
 */
export const cacheGetOrSet = async <T>(
  key: string,
  factory: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> => {
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  const value = await factory();
  await cacheSet(key, value, ttlSeconds);
  return value;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CLÉS DE CACHE PRÉDÉFINIES
// ═══════════════════════════════════════════════════════════════════════════════

export const cacheKeys = {
  // Organisation
  organization: (id: string) => `org:${id}`,
  organizationSettings: (id: string) => `org:${id}:settings`,
  
  // Produits
  products: (orgId: string) => `org:${orgId}:products`,
  productsByCategory: (orgId: string, categoryId: string) => 
    `org:${orgId}:products:cat:${categoryId}`,
  
  // Catégories
  categories: (orgId: string) => `org:${orgId}:categories`,
  
  // Dashboard stats
  dashboardStats: (orgId: string) => `org:${orgId}:dashboard`,
  dailyStats: (orgId: string, date: string) => `org:${orgId}:stats:${date}`,
  
  // Utilisateur
  userSession: (userId: string) => `user:${userId}:session`,
  
  // Livreur
  delivererRoute: (delivererId: string, date: string) => 
    `deliverer:${delivererId}:route:${date}`,
  delivererPosition: (delivererId: string) => `deliverer:${delivererId}:position`,
  
  // Client
  customerDebt: (customerId: string) => `customer:${customerId}:debt`,
};

// ═══════════════════════════════════════════════════════════════════════════════
// INVALIDATION DE CACHE
// ═══════════════════════════════════════════════════════════════════════════════

export const invalidateCache = {
  // Invalider le cache produits après modification
  products: async (orgId: string) => {
    await cacheDelPattern(`org:${orgId}:products*`);
  },
  
  // Invalider le cache catégories
  categories: async (orgId: string) => {
    await cacheDel(cacheKeys.categories(orgId));
  },
  
  // Invalider le dashboard
  dashboard: async (orgId: string) => {
    await cacheDel(cacheKeys.dashboardStats(orgId));
  },
  
  // Invalider tout le cache d'une organisation
  organization: async (orgId: string) => {
    await cacheDelPattern(`org:${orgId}:*`);
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════════════════════════

const RATE_LIMIT_PREFIX = 'ratelimit:';

/**
 * Vérifier et incrémenter le compteur de rate limit
 */
export const checkRateLimit = async (
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> => {
  const fullKey = `${RATE_LIMIT_PREFIX}${key}`;
  
  const multi = redis.multi();
  multi.incr(fullKey);
  multi.ttl(fullKey);
  
  const results = await multi.exec();
  const count = results?.[0]?.[1] as number;
  let ttl = results?.[1]?.[1] as number;
  
  // Si c'est la première requête, définir l'expiration
  if (count === 1 || ttl === -1) {
    await redis.expire(fullKey, windowSeconds);
    ttl = windowSeconds;
  }
  
  return {
    allowed: count <= maxRequests,
    remaining: Math.max(0, maxRequests - count),
    resetIn: ttl,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// DISTRIBUTED LOCK
// ═══════════════════════════════════════════════════════════════════════════════

const LOCK_PREFIX = 'lock:';

/**
 * Acquérir un verrou distribué
 */
export const acquireLock = async (
  resource: string,
  ttlMs: number = 30000
): Promise<string | null> => {
  const lockKey = `${LOCK_PREFIX}${resource}`;
  const lockValue = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const acquired = await redis.set(lockKey, lockValue, 'PX', ttlMs, 'NX');
  return acquired ? lockValue : null;
};

/**
 * Libérer un verrou distribué
 */
export const releaseLock = async (resource: string, lockValue: string): Promise<boolean> => {
  const lockKey = `${LOCK_PREFIX}${resource}`;
  
  // Script Lua pour libérer le verrou de manière atomique
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  
  const result = await redis.eval(script, 1, lockKey, lockValue);
  return result === 1;
};

/**
 * Exécuter une fonction avec verrou
 */
export const withLock = async <T>(
  resource: string,
  fn: () => Promise<T>,
  ttlMs: number = 30000
): Promise<T> => {
  const lockValue = await acquireLock(resource, ttlMs);
  
  if (!lockValue) {
    throw new Error(`Could not acquire lock for resource: ${resource}`);
  }
  
  try {
    return await fn();
  } finally {
    await releaseLock(resource, lockValue);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// PUBSUB
// ═══════════════════════════════════════════════════════════════════════════════

let subscriber: Redis | null = null;

export const getSubscriber = (): Redis => {
  if (!subscriber) {
    subscriber = redis.duplicate();
  }
  return subscriber;
};

export const publish = async (channel: string, message: any): Promise<void> => {
  const serialized = typeof message === 'string' ? message : JSON.stringify(message);
  await redis.publish(channel, serialized);
};

export const subscribe = async (
  channel: string,
  callback: (message: any) => void
): Promise<void> => {
  const sub = getSubscriber();
  await sub.subscribe(channel);
  
  sub.on('message', (ch, message) => {
    if (ch === channel) {
      try {
        callback(JSON.parse(message));
      } catch {
        callback(message);
      }
    }
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  initializeRedis,
  closeRedis,
  redis,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern,
  cacheGetOrSet,
  cacheKeys,
  invalidateCache,
  checkRateLimit,
  acquireLock,
  releaseLock,
  withLock,
  publish,
  subscribe,
};
