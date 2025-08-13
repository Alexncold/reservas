import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { getClientIp } from 'request-ip';
import { logger } from '@/lib/logger';

// Rate limiting configuration
const rateLimiters = {
  public: new RateLimiterMemory({
    points: 60, // 60 requests
    duration: 60, // per 60 seconds
  }),
  admin: new RateLimiterMemory({
    points: 600, // 600 requests
    duration: 60, // per 60 seconds
  }),
};

// Security headers middleware
export async function securityHeadersMiddleware(req: NextRequest) {
  // Skip for API routes and static files
  if (req.nextUrl.pathname.startsWith('/api/') || 
      req.nextUrl.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
    return NextResponse.next();
  }

  // Security headers for all other requests
  const response = NextResponse.next();
  
  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // CSP - Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://js.stripe.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: http:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://www.google-analytics.com https://api.mercadopago.com https://graph.facebook.com",
    "frame-src 'self' https://www.mercadopago.com https://js.stripe.com",
    "form-action 'self' https://www.mercadopago.com",
  ].join('; ');
  
  response.headers.set('Content-Security-Policy', csp);
  
  // HSTS - Only in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  return response;
}

// Rate limiting middleware
export async function rateLimitMiddleware(req: NextRequest) {
  // Skip rate limiting for static files
  if (req.nextUrl.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
    return NextResponse.next();
  }

  const ip = getClientIp(req) || 'unknown';
  const path = req.nextUrl.pathname;
  
  try {
    // Determine the rate limiter to use
    let rateLimiter = rateLimiters.public;
    
    // Admin routes get higher limits
    if (path.startsWith('/api/admin/') || path.startsWith('/admin/')) {
      rateLimiter = rateLimiters.admin;
    }
    
    // Check rate limit
    await rateLimiter.consume(ip);
    
    return NextResponse.next();
  } catch (error) {
    logger.warn('Rate limit exceeded', { ip, path });
    
    return new NextResponse(
      JSON.stringify({ 
        error: 'Too many requests, please try again later.' 
      }),
      { 
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Request logging middleware
export async function requestLoggerMiddleware(req: NextRequest) {
  const start = Date.now();
  const method = req.method;
  const url = req.nextUrl.pathname;
  const query = Object.fromEntries(req.nextUrl.searchParams);
  const ip = getClientIp(req) || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  
  // Skip logging for static assets and health checks
  if (url.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/) || url === '/api/health') {
    return NextResponse.next();
  }
  
  // Log the request
  logger.info('Request', {
    method,
    url,
    query,
    ip,
    userAgent,
    timestamp: new Date().toISOString(),
  });
  
  // Continue with the request
  const response = await NextResponse.next();
  
  // Log the response
  const duration = Date.now() - start;
  logger.info('Response', {
    method,
    url,
    status: response.status,
    duration: `${duration}ms`,
    ip,
  });
  
  // Add server-timing header
  response.headers.set('Server-Timing', `total;dur=${duration}`);
  
  return response;
}

// Error handling middleware
export function errorHandlerMiddleware(handler: Function) {
  return async (req: Request, ...args: any[]) => {
    try {
      return await handler(req, ...args);
    } catch (error) {
      const errorId = Math.random().toString(36).substring(2, 15);
      const errorMessage = error.message || 'Internal Server Error';
      const statusCode = error.statusCode || 500;
      
      logger.error('API Error', {
        errorId,
        message: errorMessage,
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
        url: req.url,
        method: req.method,
      });
      
      return NextResponse.json(
        { 
          error: errorMessage,
          errorId: process.env.NODE_ENV === 'production' ? errorId : undefined,
          ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
        },
        { status: statusCode }
      );
    }
  };
}

// Apply all security middlewares
export function withSecurity(handler: Function) {
  return async (req: NextRequest, ...args: any[]) => {
    // Apply rate limiting
    const rateLimitResponse = await rateLimitMiddleware(req);
    if (rateLimitResponse) return rateLimitResponse;
    
    // Apply security headers
    const securityResponse = await securityHeadersMiddleware(req);
    if (securityResponse) return securityResponse;
    
    // Apply request logging
    const loggedResponse = await requestLoggerMiddleware(req);
    
    // Execute the route handler with error handling
    return errorHandlerMiddleware(handler)(req, ...args);
  };
}
