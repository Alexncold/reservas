import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { withAuth } from 'next-auth/middleware';
import { getCurrentUser, refreshAccessToken } from './lib/auth/jwt';
import { csrfProtection, addCsrfToken } from './lib/security/csrf';

// Paths that don't require authentication
const publicPaths = [
  '/',
  '/auth/*',
  '/api/auth/*',
  '/api/public/*',
];

// Admin paths that require admin role
const adminPaths = [
  '/admin/*',
  '/api/admin/*',
];

// API paths that require authentication but not necessarily admin role
const protectedApiPaths = [
  '/api/reservas/*',
  '/api/mis-reservas/*',
];

// Check if the path matches any of the patterns
function pathMatches(path: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    const regex = new RegExp(
      `^${pattern.replace(/\*/g, '.*')}$`.replace(/\//g, '\\/')
    );
    return regex.test(path);
  });
}

export default withAuth(
  async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    
    // Skip middleware for public paths
    if (pathMatches(pathname, publicPaths)) {
      // Still add CSRF token to public paths that aren't API endpoints
      if (!pathname.startsWith('/api/')) {
        const response = NextResponse.next();
        const csrfResponse = addCsrfToken();
        csrfResponse.headers.forEach((value, key) => {
          response.headers.set(key, value);
        });
        return response;
      }
      return NextResponse.next();
    }
    
    // Check if the path is protected
    const isProtectedPath = pathMatches(pathname, [...adminPaths, ...protectedApiPaths]);
    const isAdminPath = pathMatches(pathname, adminPaths);
    
    // Get the JWT token
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    
    // Handle API routes
    if (pathname.startsWith('/api/')) {
      // Check for API key in the Authorization header
      const apiKey = req.headers.get('authorization')?.split(' ')[1];
      
      // If API key is provided and matches, allow access
      if (apiKey && apiKey === process.env.API_KEY) {
        return NextResponse.next();
      }
      
      // For protected API routes, require authentication and CSRF protection
      if (isProtectedPath) {
        // First check authentication
        if (!token) {
          return new NextResponse(
            JSON.stringify({ error: 'Authentication required' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        // Then check CSRF for non-GET requests
        if (req.method !== 'GET') {
          const csrfResult = await csrfProtection()(req);
          if (csrfResult) {
            return csrfResult;
          }
        }
      }
      
      // For admin API routes, require admin role
      if (isAdminPath && token?.role !== 'admin') {
        return new NextResponse(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      return NextResponse.next();
    }
    
    // Handle page routes
    const user = await getCurrentUser();
    
    // If not authenticated and trying to access protected page, redirect to login
    if (!user && isProtectedPath) {
      const loginUrl = new URL('/auth/login', req.url);
      loginUrl.searchParams.set('callbackUrl', encodeURI(req.url));
      return NextResponse.redirect(loginUrl);
    }
    
    // If authenticated but not admin and trying to access admin page, redirect to home
    if (user && isAdminPath && user.role !== 'admin') {
      return NextResponse.redirect(new URL('/', req.url));
    }
    
    // Try to refresh the access token if it's about to expire
    if (user) {
      const response = NextResponse.next();
      
      // Add CSRF token to the response
      const csrfResponse = addCsrfToken();
      csrfResponse.headers.forEach((value, key) => {
        response.headers.set(key, value);
      });
      
      // Check if the access token is about to expire (in the next 5 minutes)
      const tokenExp = token?.exp || 0;
      const nowInSeconds = Math.floor(Date.now() / 1000);
      
      if (tokenExp - nowInSeconds < 300) { // 5 minutes
        const newToken = await refreshAccessToken();
        
        if (newToken) {
          // Set the new token in the response cookies
          response.cookies.set('access_token', newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60, // 1 hour
          });
        }
      }
      
      return response;
    }
    
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        // This is a required callback for withAuth, but we handle auth in the main function
        return true;
      },
    },
  }
);

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|assets).*)',
    '/',
    '/(api|trpc)(.*)',
  ],
};
