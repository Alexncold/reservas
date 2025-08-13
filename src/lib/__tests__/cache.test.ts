import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { getCachedResponse, cacheResponse, invalidateCache, withCache } from '../cache';

// Mock Redis
jest.mock('@/lib/redis', () => ({
  redis: {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn().mockResolvedValue([]),
  },
}));

describe('Cache Utilities', () => {
  let mockRequest: NextRequest;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRequest = {
      url: 'http://localhost:3000/api/test?param=value',
      method: 'GET',
      headers: new Headers(),
    } as unknown as NextRequest;
  });
  
  describe('getCachedResponse', () => {
    it('should return null if Redis is not configured', async () => {
      const originalRedis = process.env.UPSTASH_REDIS_URL;
      delete process.env.UPSTASH_REDIS_URL;
      
      const response = await getCachedResponse(mockRequest);
      expect(response).toBeNull();
      
      process.env.UPSTASH_REDIS_URL = originalRedis;
    });
    
    it('should return cached response if valid', async () => {
      const mockData = { data: 'test', timestamp: Date.now() - 5000 }; // 5 seconds old
      (redis.get as jest.Mock).mockResolvedValue(mockData);
      
      const response = await getCachedResponse(mockRequest);
      
      expect(response).toBeInstanceOf(NextResponse);
      expect(await response?.json()).toEqual(mockData.data);
      expect(response?.headers.get('X-Cache')).toBe('HIT');
    });
    
    it('should return null if cache is expired', async () => {
      const expiredData = { data: 'test', timestamp: Date.now() - 60000 }; // 60 seconds old
      (redis.get as jest.Mock).mockResolvedValue(expiredData);
      
      const response = await getCachedResponse(mockRequest);
      expect(response).toBeNull();
      expect(redis.del).toHaveBeenCalled();
    });
  });
  
  describe('cacheResponse', () => {
    it('should cache the response with TTL', async () => {
      const testData = { key: 'value' };
      await cacheResponse(mockRequest, testData, 60);
      
      expect(redis.setex).toHaveBeenCalledWith(
        expect.any(String),
        60,
        {
          data: testData,
          timestamp: expect.any(Number),
        }
      );
    });
  });
  
  describe('invalidateCache', () => {
    it('should delete matching cache keys', async () => {
      const mockKeys = ['cache:key1', 'cache:key2'];
      (redis.keys as jest.Mock).mockResolvedValue(mockKeys);
      
      await invalidateCache('test');
      
      expect(redis.del).toHaveBeenCalledWith(...mockKeys);
    });
  });
  
  describe('withCache', () => {
    const mockHandler = jest.fn().mockResolvedValue(
      new NextResponse(JSON.stringify({ data: 'test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    
    it('should return cached response if available', async () => {
      const cachedData = { data: 'cached', timestamp: Date.now() };
      (redis.get as jest.Mock).mockResolvedValue(cachedData);
      
      const response = await withCache(mockHandler, mockRequest);
      const data = await response.json();
      
      expect(data).toEqual(cachedData.data);
      expect(mockHandler).not.toHaveBeenCalled();
    });
    
    it('should call handler and cache result if no cache', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      
      const response = await withCache(mockHandler, mockRequest);
      const data = await response.json();
      
      expect(data).toEqual({ data: 'test' });
      expect(mockHandler).toHaveBeenCalled();
      expect(redis.setex).toHaveBeenCalled();
    });
    
    it('should not cache non-200 responses', async () => {
      const errorHandler = jest.fn().mockResolvedValue(
        new NextResponse(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      );
      
      (redis.get as jest.Mock).mockResolvedValue(null);
      
      const response = await withCache(errorHandler, mockRequest);
      expect(response.status).toBe(404);
      expect(redis.setex).not.toHaveBeenCalled();
    });
  });
});
