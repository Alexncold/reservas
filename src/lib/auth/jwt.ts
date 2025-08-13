import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { logger } from '../logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_ALG = 'HS256';
const ACCESS_TOKEN_EXPIRES_IN = '1h';
const REFRESH_TOKEN_EXPIRES_IN = '7d';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

type UserPayload = {
  id: string;
  email: string;
  role: 'admin' | 'staff';
};

/**
 * Signs a JWT token with the given payload
 */
async function signToken(
  payload: UserPayload,
  expiresIn: string = ACCESS_TOKEN_EXPIRES_IN
): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  
  return new SignJWT(payload)
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

/**
 * Verifies a JWT token and returns the payload if valid
 */
async function verifyToken(token: string): Promise<UserPayload | null> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [JWT_ALG],
    });
    
    // Type assertion to ensure the payload has the expected shape
    if (payload && typeof payload === 'object' && 'id' in payload) {
      return payload as UserPayload;
    }
    
    return null;
  } catch (error) {
    logger.error('JWT verification failed', { error: error.message });
    return null;
  }
}

/**
 * Creates an access token and a refresh token for the user
 */
export async function createAuthTokens(user: UserPayload) {
  const accessToken = await signToken(user);
  const refreshToken = await signToken({ ...user, isRefreshToken: true }, REFRESH_TOKEN_EXPIRES_IN);
  
  return { accessToken, refreshToken };
}

/**
 * Sets the auth cookies in the response
 */
export function setAuthCookies(accessToken: string, refreshToken: string) {
  cookies().set('access_token', accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 60 * 60, // 1 hour
  });
  
  cookies().set('refresh_token', refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

/**
 * Clears the auth cookies
 */
export function clearAuthCookies() {
  cookies().delete('access_token');
  cookies().delete('refresh_token');
}

/**
 * Gets the current user from the request cookies
 */
export async function getCurrentUser(): Promise<UserPayload | null> {
  const accessToken = cookies().get('access_token')?.value;
  
  if (!accessToken) {
    return null;
  }
  
  return verifyToken(accessToken);
}

/**
 * Middleware to protect routes that require authentication
 */
export async function requireAuth(roles?: Array<'admin' | 'staff'>) {
  const user = await getCurrentUser();
  
  if (!user) {
    return { user: null, isAuthorized: false };
  }
  
  if (roles && !roles.includes(user.role)) {
    return { user, isAuthorized: false };
  }
  
  return { user, isAuthorized: true };
}

/**
 * Middleware to refresh the access token using the refresh token
 */
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = cookies().get('refresh_token')?.value;
  
  if (!refreshToken) {
    return null;
  }
  
  try {
    const user = await verifyToken(refreshToken);
    
    if (!user || (user as any).isRefreshToken !== true) {
      return null;
    }
    
    // Remove the refresh token flag
    delete (user as any).isRefreshToken;
    
    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = await createAuthTokens(user);
    
    // Set the new cookies
    setAuthCookies(accessToken, newRefreshToken);
    
    return accessToken;
  } catch (error) {
    logger.error('Failed to refresh token', { error: error.message });
    return null;
  }
}
