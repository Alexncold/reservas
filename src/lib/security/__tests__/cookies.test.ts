import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  setCookie, 
  getCookie, 
  removeCookie, 
  setAuthCookies, 
  clearAuthCookies, 
  getCsrfToken, 
  setCsrfToken,
  validateCookieAttributes,
  getAllCookies,
  TOKENS
} from '../cookies';
import { cookies } from 'next/headers';

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn()
}));

describe('Cookie Utilities', () => {
  const mockCookies = new Map<string, any>();
  const mockCookieStore = {
    get: vi.fn((name) => ({
      name,
      value: mockCookies.get(name)
    })),
    set: vi.fn((name, value, options) => {
      mockCookies.set(name, value);
      return { name, value, options };
    }),
    delete: vi.fn((name) => {
      mockCookies.delete(name);
      return { name };
    }),
    getAll: vi.fn(() => 
      Array.from(mockCookies.entries()).map(([name, value]) => ({
        name,
        value
      }))
    )
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.clear();
    vi.mocked(cookies).mockImplementation(() => mockCookieStore as any);
  });

  describe('setCookie', () => {
    it('should set a cookie with default options', () => {
      setCookie('test', 'value');
      
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'test',
        'value',
        expect.objectContaining({
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          domain: process.env.NODE_ENV === 'production' ? '.gamehub.com' : undefined,
        })
      );
    });

    it('should set a cookie with custom options', () => {
      const options = {
        maxAge: 3600,
        secure: false,
        sameSite: 'strict' as const,
      };
      
      setCookie('test', 'value', options);
      
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'test',
        'value',
        expect.objectContaining({
          ...options,
          httpOnly: true,
          path: '/',
        })
      );
    });
  });

  describe('getCookie', () => {
    it('should get a cookie value', () => {
      mockCookies.set('test', 'test-value');
      const value = getCookie('test');
      expect(value).toBe('test-value');
      expect(mockCookieStore.get).toHaveBeenCalledWith('test');
    });

    it('should return undefined for non-existent cookie', () => {
      const value = getCookie('non-existent');
      expect(value).toBeUndefined();
    });
  });

  describe('removeCookie', () => {
    it('should remove a cookie', () => {
      mockCookies.set('test', 'value');
      removeCookie('test');
      expect(mockCookieStore.delete).toHaveBeenCalledWith('test');
      expect(mockCookies.has('test')).toBe(false);
    });
  });

  describe('setAuthCookies', () => {
    it('should set both access and refresh tokens', () => {
      setAuthCookies({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      expect(mockCookieStore.set).toHaveBeenCalledTimes(2);
      
      // Check access token
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        TOKENS.ACCESS_TOKEN,
        'access-token',
        expect.objectContaining({
          maxAge: 3600, // 1 hour
        })
      );
      
      // Check refresh token
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        TOKENS.REFRESH_TOKEN,
        'refresh-token',
        expect.objectContaining({
          maxAge: 604800, // 7 days
        })
      );
    });

    it('should use custom max ages when provided', () => {
      setAuthCookies({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessTokenMaxAge: 1800, // 30 minutes
        refreshTokenMaxAge: 86400, // 1 day
      });

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        TOKENS.ACCESS_TOKEN,
        'access-token',
        expect.objectContaining({
          maxAge: 1800,
        })
      );
      
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        TOKENS.REFRESH_TOKEN,
        'refresh-token',
        expect.objectContaining({
          maxAge: 86400,
        })
      );
    });
  });

  describe('clearAuthCookies', () => {
    it('should clear both access and refresh tokens', () => {
      mockCookies.set(TOKENS.ACCESS_TOKEN, 'access-token');
      mockCookies.set(TOKENS.REFRESH_TOKEN, 'refresh-token');
      
      clearAuthCookies();
      
      expect(mockCookieStore.delete).toHaveBeenCalledTimes(2);
      expect(mockCookieStore.delete).toHaveBeenCalledWith(TOKENS.ACCESS_TOKEN);
      expect(mockCookieStore.delete).toHaveBeenCalledWith(TOKENS.REFRESH_TOKEN);
    });
  });

  describe('CSRF Token', () => {
    it('should set and get CSRF token', () => {
      setCsrfToken('test-csrf-token');
      
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        TOKENS.CSRF_TOKEN,
        'test-csrf-token',
        expect.objectContaining({
          maxAge: 3600, // Default 1 hour
        })
      );
      
      mockCookies.set(TOKENS.CSRF_TOKEN, 'test-csrf-token');
      const token = getCsrfToken();
      
      expect(token).toBe('test-csrf-token');
      expect(mockCookieStore.get).toHaveBeenCalledWith(TOKENS.CSRF_TOKEN);
    });
  });

  describe('validateCookieAttributes', () => {
    it('should validate secure cookies in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const validCookie = 'test=value; Path=/; HttpOnly; Secure; SameSite=Lax';
      const invalidCookie = 'test=value; Path=/; HttpOnly; SameSite=Lax';
      
      expect(validateCookieAttributes(validCookie)).toBe(true);
      expect(validateCookieAttributes(invalidCookie)).toBe(false);
      
      process.env.NODE_ENV = originalEnv;
    });
    
    it('should validate HTTP-only for auth cookies', () => {
      const authCookie = `${TOKENS.ACCESS_TOKEN}=token; Path=/; Secure; SameSite=Lax`;
      expect(validateCookieAttributes(authCookie)).toBe(false);
      
      const validAuthCookie = `${TOKENS.ACCESS_TOKEN}=token; Path=/; Secure; HttpOnly; SameSite=Lax`;
      expect(validateCookieAttributes(validAuthCookie)).toBe(true);
    });
    
    it('should validate SameSite attribute', () => {
      const cookieWithoutSameSite = 'test=value; Path=/; Secure; HttpOnly';
      expect(validateCookieAttributes(cookieWithoutSameSite)).toBe(false);
      
      const cookieWithSameSite = 'test=value; Path=/; Secure; HttpOnly; SameSite=Lax';
      expect(validateCookieAttributes(cookieWithSameSite)).toBe(true);
    });
  });

  describe('getAllCookies', () => {
    it('should return all cookies as an object', () => {
      mockCookies.set('cookie1', 'value1');
      mockCookies.set('cookie2', 'value2');
      
      const allCookies = getAllCookies();
      
      expect(allCookies).toEqual({
        cookie1: 'value1',
        cookie2: 'value2',
      });
      
      expect(mockCookieStore.getAll).toHaveBeenCalled();
    });
    
    it('should return empty object on error', () => {
      vi.mocked(cookies).mockImplementationOnce(() => {
        throw new Error('Failed to get cookies');
      });
      
      const result = getAllCookies();
      expect(result).toEqual({});
    });
  });
});
