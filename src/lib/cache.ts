import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { logger } from './logger';

// Initialize Redis client
const redis = process.env.UPSTASH_REDIS_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_URL,
      token: process.env.UPSTASH_REDIS_TOKEN || '',
    })
  : null;

// Cache configuration
const CACHE_TTL = 30; // seconds
const CACHE_PREFIX = 'gamehub:cache:';

type CacheEntry<T = any> = {
  data: T;
  timestamp: number;
};

/**
 * Generate a cache key from a request
 */
function generateCacheKey(req: NextRequest): string {
  const url = new URL(req.url);
  const key = `${req.method}:${url.pathname}${url.search}`;
  return `${CACHE_PREFIX}${Buffer.from(key).toString('base64')}`;
}

/**
 * Get cached response if available and not expired
 */
export async function getCachedResponse(
  req: NextRequest
): Promise<NextResponse | null> {
  if (!redis) return null;
  
  try {
    const cacheKey = generateCacheKey(req);
    const cached = await redis.get<CacheEntry>(cacheKey);
    
    if (!cached) return null;
    
    const now = Date.now();
    const age = (now - cached.timestamp) / 1000; // in seconds
    
    if (age > CACHE_TTL) {
      // Cache entry expired, delete it
      await redis.del(cacheKey);
      return null;
    }
    
    // Add cache headers to the response
    const response = NextResponse.json(cached.data);
    response.headers.set('X-Cache', 'HIT');
    response.headers.set('X-Cache-Age', `${Math.floor(age)}`);
    response.headers.set('Cache-Control', `public, max-age=${CACHE_TTL - Math.ceil(age)}`);
    
    return response;
  } catch (error) {
    logger.error('Cache get error', { error: error.message });
    return null;
  }
}

/**
 * Store response in cache
 */
export async function cacheResponse(
  req: NextRequest,
  data: any,
  ttl: number = CACHE_TTL
): Promise<void> {
  if (!redis) return;
  
  try {
    const cacheKey = generateCacheKey(req);
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
    };
    
    await redis.setex(cacheKey, ttl, entry);
  } catch (error) {
    logger.error('Cache set error', { error: error.message });
  }
}

/**
 * Invalidate cache for a specific endpoint or pattern
 */
export async function invalidateCache(pattern: string): Promise<void> {
  if (!redis) return;
  
  try {
    const keys = await redis.keys(`${CACHE_PREFIX}*${pattern}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    logger.error('Cache invalidation error', { error: error.message });
  }
}

/**
 * Middleware to handle caching for GET requests
 */
export async function withCache(
  handler: (req: NextRequest) => Promise<NextResponse>,
  req: NextRequest,
  options: { ttl?: number; skipCache?: boolean } = {}
): Promise<NextResponse> {
  // Skip cache for non-GET requests or when explicitly disabled
  if (req.method !== 'GET' || options.skipCache) {
    return handler(req);
  }
  
  // Try to get cached response
  const cachedResponse = await getCachedResponse(req);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // No cache hit, process the request
  const response = await handler(req);
  
  // Only cache successful responses
  if (response.status === 200) {
    const data = await response.clone().json();
    await cacheResponse(req, data, options.ttl);
  }
  
  return response;
}
