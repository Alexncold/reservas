import { randomBytes, createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { logger } from '../logger';

// Configuration
const CSRF_SECRET = process.env.CSRF_SECRET || 'your-csrf-secret-change-in-production';
const CSRF_TOKEN_NAME = 'XSRF-TOKEN';
const CSRF_HEADER = 'x-xsrf-token';
const CSRF_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 60 * 60, // 1 hour
};

/**
 * Generates a new CSRF token
 */
export function generateCsrfToken(): string {
  // Generate a random string
  const token = randomBytes(32).toString('hex');
  
  // Create a signature of the token
  const signature = createHmac('sha256', CSRF_SECRET)
    .update(token)
    .digest('hex');
  
  // Combine token and signature
  return `${token}:${signature}`;
}

/**
 * Validates a CSRF token
 */
export function validateCsrfToken(token: string): boolean {
  if (!token) return false;
  
  try {
    const [tokenPart, signature] = token.split(':');
    
    if (!tokenPart || !signature) {
      return false;
    }
    
    // Recreate the signature and compare
    const expectedSignature = createHmac('sha256', CSRF_SECRET)
      .update(tokenPart)
      .digest('hex');
    
    // Use timingSafeEqual to prevent timing attacks
    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    logger.error('CSRF validation error', { error: error.message });
    return false;
  }
}

/**
 * Gets the CSRF token from the request cookies
 */
export function getCsrfTokenFromCookie(): string | null {
  return cookies().get(CSRF_TOKEN_NAME)?.value || null;
}

/**
 * Sets the CSRF token in the response cookies
 */
export function setCsrfCookie(token: string): void {
  cookies().set(CSRF_TOKEN_NAME, token, CSRF_COOKIE_OPTIONS);
}

/**
 * Middleware to handle CSRF protection
 */
export function csrfProtection() {
  return async (req: Request) => {
    // Skip CSRF for GET, HEAD, OPTIONS requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return null;
    }
    
    // Get token from header or form data
    let token: string | null = null;
    
    // Check headers first
    token = req.headers.get(CSRF_HEADER) || req.headers.get('x-csrf-token');
    
    // If not in headers, check form data
    if (!token) {
      try {
        const contentType = req.headers.get('content-type') || '';
        
        if (contentType.includes('application/x-www-form-urlencoded')) {
          const formData = await req.formData();
          token = formData.get('_csrf') as string;
        } else if (contentType.includes('application/json')) {
          const body = await req.clone().json().catch(() => ({}));
          token = body._csrf;
        }
      } catch (error) {
        logger.error('Error parsing request for CSRF token', { error: error.message });
      }
    }
    
    // Get token from cookie
    const cookieToken = getCsrfTokenFromCookie();
    
    // Verify token
    if (!token || !cookieToken || token !== cookieToken || !validateCsrfToken(token)) {
      logger.warn('CSRF validation failed', { 
        tokenPresent: !!token,
        cookiePresent: !!cookieToken,
        valid: token && cookieToken && validateCsrfToken(token),
        path: new URL(req.url).pathname,
      });
      
      return new Response(
        JSON.stringify({ error: 'Invalid CSRF token' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return null;
  };
}

/**
 * React hook to get CSRF token for forms
 */
export function useCsrfToken(): string | null {
  if (typeof window === 'undefined') {
    return null; // Return null during SSR
  }
  
  // Get token from cookie
  const token = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${CSRF_TOKEN_NAME}=`))
    ?.split('=')[1];
    
  return token || null;
}

/**
 * Middleware to add CSRF token to API responses
 */
export function addCsrfToken() {
  const response = new Response();
  
  // Only set the token if it doesn't exist
  if (!cookies().get(CSRF_TOKEN_NAME)) {
    const token = generateCsrfToken();
    setCsrfCookie(token);
    
    // Also set the token in the response headers for API clients
    response.headers.set('X-CSRF-Token', token);
  }
  
  return response;
}
