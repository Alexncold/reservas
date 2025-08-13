import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { 
  securityHeadersMiddleware, 
  rateLimitMiddleware, 
  requestLoggerMiddleware,
  errorHandlerMiddleware
} from '../security';
import { logger } from '@/lib/logger';

// Mock the logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Security Middleware', () => {
  let mockRequest: Partial<NextRequest>;
  
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Create a mock request
    mockRequest = {
      nextUrl: new URL('http://localhost:3000/test'),
      method: 'GET',
      headers: new Headers({
        'user-agent': 'test-agent',
        'x-forwarded-for': '192.168.1.1',
      }),
      json: jest.fn().mockResolvedValue({}),
    };
  });

  describe('securityHeadersMiddleware', () => {
    it('should add security headers to the response', async () => {
      const response = await securityHeadersMiddleware(mockRequest as NextRequest);
      
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    });

    it('should skip adding headers for static files', async () => {
      mockRequest.nextUrl = new URL('http://localhost:3000/image.png');
      const response = await securityHeadersMiddleware(mockRequest as NextRequest);
      
      // Should be the default response without security headers
      expect(response.headers.get('X-Frame-Options')).toBeNull();
    });
  });

  describe('rateLimitMiddleware', () => {
    it('should allow requests under the rate limit', async () => {
      const response = await rateLimitMiddleware(mockRequest as NextRequest);
      expect(response).toBeUndefined(); // No response means the request is allowed
    });

    it('should block requests over the rate limit', async () => {
      // Exceed the rate limit
      for (let i = 0; i < 61; i++) {
        await rateLimitMiddleware(mockRequest as NextRequest);
      }
      
      const response = await rateLimitMiddleware(mockRequest as NextRequest);
      expect(response).toBeDefined();
      expect(response?.status).toBe(429);
    });
  });

  describe('requestLoggerMiddleware', () => {
    it('should log request and response', async () => {
      const response = await requestLoggerMiddleware(mockRequest as NextRequest);
      
      // Should log the request
      expect(logger.info).toHaveBeenCalledWith('Request', expect.objectContaining({
        method: 'GET',
        url: '/test',
        ip: '192.168.1.1',
        userAgent: 'test-agent',
      }));
      
      // Should add Server-Timing header
      expect(response.headers.get('Server-Timing')).toMatch(/^total;dur=\d+$/);
    });
  });

  describe('errorHandlerMiddleware', () => {
    it('should handle errors and return a proper response', async () => {
      const error = new Error('Test error');
      (error as any).statusCode = 400;
      
      const handler = jest.fn().mockRejectedValue(error);
      const wrappedHandler = errorHandlerMiddleware(handler);
      
      const response = await wrappedHandler(mockRequest as Request, {});
      const responseData = await response.json();
      
      expect(response.status).toBe(400);
      expect(responseData).toHaveProperty('error', 'Test error');
      expect(logger.error).toHaveBeenCalledWith(
        'API Error',
        expect.objectContaining({
          message: 'Test error',
          url: 'http://localhost/test',
          method: 'GET',
        })
      );
    });

    it('should mask sensitive information in production', async () => {
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Database connection failed');
      (error as any).statusCode = 500;
      
      const handler = jest.fn().mockRejectedValue(error);
      const wrappedHandler = errorHandlerMiddleware(handler);
      
      const response = await wrappedHandler(mockRequest as Request, {});
      const responseData = await response.json();
      
      expect(responseData).not.toHaveProperty('stack');
      expect(responseData).toHaveProperty('errorId');
      
      // Reset NODE_ENV
      process.env.NODE_ENV = 'test';
    });
  });
});
