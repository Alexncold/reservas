import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

// Cookie configuration
const COOKIE_OPTIONS = {
  // Secure: Only sent over HTTPS in production
  secure: process.env.NODE_ENV === 'production',
  // HTTP-only: Not accessible via JavaScript
  httpOnly: true,
  // SameSite: Strict CSRF protection
  sameSite: 'lax' as const, // 'lax' allows top-level navigation, 'strict' is more restrictive
  // Path: Root path
  path: '/',
  // Domain: Set to your domain in production
  domain: process.env.NODE_ENV === 'production' ? '.gamehub.com' : undefined,
};

// Token names
export const TOKENS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  CSRF_TOKEN: 'XSRF-TOKEN',
} as const;

/**
 * Sets a secure cookie
 */
export function setCookie(
  name: string,
  value: string,
  options: {
    maxAge?: number; // in seconds
    expires?: Date;
  } = {}
): void {
  try {
    const cookieStore = cookies();
    
    cookieStore.set(name, value, {
      ...COOKIE_OPTIONS,
      ...options,
      // Convert maxAge from seconds to milliseconds (if provided)
      ...(options.maxAge ? { maxAge: options.maxAge } : {}),
      // Convert expires to Date object (if provided)
      ...(options.expires ? { expires: options.expires } : {}),
    });
    
    logger.debug('Cookie set', { name, maxAge: options.maxAge });
  } catch (error) {
    logger.error('Failed to set cookie', { name, error: error.message });
    throw error;
  }
}

/**
 * Gets a cookie value by name
 */
export function getCookie(name: string): string | undefined {
  try {
    const cookieStore = cookies();
    return cookieStore.get(name)?.value;
  } catch (error) {
    logger.error('Failed to get cookie', { name, error: error.message });
    return undefined;
  }
}

/**
 * Removes a cookie
 */
export function removeCookie(name: string): void {
  try {
    const cookieStore = cookies();
    cookieStore.delete(name);
    logger.debug('Cookie removed', { name });
  } catch (error) {
    logger.error('Failed to remove cookie', { name, error: error.message });
    throw error;
  }
}

/**
 * Sets authentication tokens in cookies
 */
export function setAuthCookies({
  accessToken,
  refreshToken,
  accessTokenMaxAge = 60 * 60, // 1 hour
  refreshTokenMaxAge = 60 * 60 * 24 * 7, // 7 days
}: {
  accessToken: string;
  refreshToken: string;
  accessTokenMaxAge?: number;
  refreshTokenMaxAge?: number;
}): void {
  // Set access token cookie
  setCookie(TOKENS.ACCESS_TOKEN, accessToken, {
    maxAge: accessTokenMaxAge,
  });
  
  // Set refresh token cookie with longer expiry
  setCookie(TOKENS.REFRESH_TOKEN, refreshToken, {
    maxAge: refreshTokenMaxAge,
  });
  
  logger.info('Auth cookies set');
}

/**
 * Clears authentication cookies
 */
export function clearAuthCookies(): void {
  removeCookie(TOKENS.ACCESS_TOKEN);
  removeCookie(TOKENS.REFRESH_TOKEN);
  logger.info('Auth cookies cleared');
}

/**
 * Gets the CSRF token from cookies
 */
export function getCsrfToken(): string | undefined {
  return getCookie(TOKENS.CSRF_TOKEN);
}

/**
 * Sets the CSRF token in cookies
 */
export function setCsrfToken(token: string, maxAge = 60 * 60): void {
  setCookie(TOKENS.CSRF_TOKEN, token, { maxAge });
}

/**
 * Middleware to ensure secure cookie settings
 */
export function secureCookiesMiddleware() {
  return (req: Request) => {
    const response = new NextResponse();
    
    // Add security headers for cookies
    response.headers.set(
      'Set-Cookie',
      Object.entries(COOKIE_OPTIONS)
        .filter(([key]) => key !== 'httpOnly') // httpOnly is not a valid Set-Cookie attribute
        .map(([key, value]) => {
          if (value === true) return key;
          if (value === false) return '';
          return `${key}=${value}`;
        })
        .filter(Boolean)
        .join('; ')
    );
    
    return response;
  };
}

/**
 * Validates cookie attributes for security
 */
export function validateCookieAttributes(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  
  const attributes = cookieHeader.split(';').map(attr => attr.trim().toLowerCase());
  
  // Check for required secure attributes
  const hasSecure = attributes.includes('secure');
  const hasHttpOnly = attributes.includes('httponly');
  const hasSameSite = attributes.some(attr => attr.startsWith('samesite='));
  
  // In production, cookies must be secure
  if (process.env.NODE_ENV === 'production' && !hasSecure) {
    logger.warn('Insecure cookie detected', { cookieHeader });
    return false;
  }
  
  // Authentication cookies must be HTTP-only
  if (cookieHeader.includes(TOKENS.ACCESS_TOKEN) || cookieHeader.includes(TOKENS.REFRESH_TOKEN)) {
    if (!hasHttpOnly) {
      logger.warn('Non-HTTP-only auth cookie detected', { cookieHeader });
      return false;
    }
  }
  
  // Should have SameSite attribute
  if (!hasSameSite) {
    logger.warn('Cookie missing SameSite attribute', { cookieHeader });
    return false;
  }
  
  return true;
}

/**
 * Gets all cookies as an object
 */
export function getAllCookies(): Record<string, string> {
  try {
    const cookieStore = cookies();
    const allCookies = cookieStore.getAll();
    
    return allCookies.reduce((acc, cookie) => {
      acc[cookie.name] = cookie.value;
      return acc;
    }, {} as Record<string, string>);
  } catch (error) {
    logger.error('Failed to get all cookies', { error: error.message });
    return {};
  }
}

/**
 * Middleware to refresh cookies before they expire
 */
export function withCookieRefresh<T>(
  handler: (req: Request) => Promise<T>,
  options: {
    refreshThreshold?: number; // seconds before expiry to refresh
    cookieNames?: string[]; // cookies to refresh
  } = {}
) {
  const { refreshThreshold = 300, cookieNames = [] } = options;
  
  return async (req: Request) => {
    const response = await handler(req);
    
    // Check if any cookies need refreshing
    const cookieHeader = response.headers.get('Set-Cookie');
    if (!cookieHeader) return response;
    
    const cookiesToRefresh = cookieNames.length > 0 
      ? cookieNames 
      : [TOKENS.ACCESS_TOKEN, TOKENS.REFRESH_TOKEN];
    
    // Parse cookies from the response
    const cookies = cookieHeader.split(/,\s*(?=[^;]+=[^;]+;)/);
    
    const updatedCookies = cookies.map(cookie => {
      const [nameValue, ...attributes] = cookie.split(';').map(part => part.trim());
      const [name] = nameValue.split('=');
      
      // Only process cookies that need refreshing
      if (!cookiesToRefresh.includes(name)) return cookie;
      
      // Find max-age or expires
      let maxAge: number | undefined;
      let expires: Date | undefined;
      
      for (const attr of attributes) {
        if (attr.toLowerCase().startsWith('max-age=')) {
          maxAge = parseInt(attr.split('=')[1], 10);
        } else if (attr.toLowerCase().startsWith('expires=')) {
          expires = new Date(attr.split('=')[1]);
        }
      }
      
      // If max-age is below threshold, refresh it
      if (maxAge && maxAge < refreshThreshold) {
        const newMaxAge = 60 * 60; // 1 hour
        
        // Update max-age
        const updatedAttributes = attributes.map(attr => 
          attr.toLowerCase().startsWith('max-age=') 
            ? `Max-Age=${newMaxAge}` 
            : attr
        );
        
        // If expires was set, update it
        if (expires) {
          const newExpires = new Date();
          newExpires.setSeconds(newExpires.getSeconds() + newMaxAge);
          
          // Remove old expires and add new one
          const filtered = updatedAttributes.filter(
            attr => !attr.toLowerCase().startsWith('expires=')
          );
          
          return [
            nameValue,
            ...filtered,
            `Expires=${newExpires.toUTCString()}`,
          ].join('; ');
        }
        
        return [nameValue, ...updatedAttributes].join('; ');
      }
      
      return cookie;
    });
    
    // Update response headers if any cookies were refreshed
    if (updatedCookies.join(', ') !== cookieHeader) {
      const newResponse = new Response(response.body, response);
      newResponse.headers.set('Set-Cookie', updatedCookies.join(', '));
      return newResponse;
    }
    
    return response;
  };
}
