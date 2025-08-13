import { NextResponse } from 'next/server';
import { z } from 'zod';
import { compare } from 'bcryptjs';
import { sign } from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { createAuthTokens, setAuthCookies } from '@/lib/auth/jwt';
import { validateBody } from '@/lib/validation/middleware';
import { adminLoginSchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger';

// Mock user database - in a real app, this would be a database query
const users = [
  {
    id: '1',
    email: process.env.ADMIN_EMAIL || 'admin@gamehub.com',
    passwordHash: process.env.ADMIN_PASSWORD_HASH || '$2a$10$XFDq3wLx.s4WwN5XvDdXUeZQYJvX6h5qJ1lW8yZ9z8dKv1Y2b3c4d5', // 'admin123'
    role: 'admin' as const,
    name: 'Administrator',
  },
];

/**
 * POST /api/auth/login
 * Authenticate a user and return JWT tokens
 */
export async function POST(req: Request) {
  try {
    // Validate request body
    const validated = await validateBody(adminLoginSchema)(req);
    if (validated instanceof NextResponse) {
      return validated; // Return validation error
    }
    
    const { email, password } = validated.validatedData.body;
    
    // Find user by email
    const user = users.find(u => u.email === email);
    
    // Verify user exists and password is correct
    if (!user || !(await compare(password, user.passwordHash))) {
      logger.warn('Failed login attempt', { email });
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }
    
    // Create JWT tokens
    const { accessToken, refreshToken } = await createAuthTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    
    // Set HTTP-only cookies
    const response = NextResponse.json(
      { 
        user: { 
          id: user.id, 
          email: user.email, 
          name: user.name, 
          role: user.role 
        } 
      },
      { status: 200 }
    );
    
    // Set cookies in the response
    response.cookies.set('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60, // 1 hour
    });
    
    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    
    logger.info('User logged in successfully', { userId: user.id, email: user.email });
    
    return response;
    
  } catch (error) {
    logger.error('Login error', { 
      error: error.message, 
      stack: error.stack 
    });
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/session
 * Get the current user session
 */
export async function GET() {
  try {
    const accessToken = cookies().get('access_token')?.value;
    
    if (!accessToken) {
      return NextResponse.json({ user: null }, { status: 200 });
    }
    
    // In a real app, you would verify the JWT token here
    // For simplicity, we'll just return the user if the token exists
    const user = users[0]; // Get the first user for demo
    
    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }
    
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
    
  } catch (error) {
    logger.error('Session error', { 
      error: error.message, 
      stack: error.stack 
    });
    
    return NextResponse.json(
      { error: 'Error al obtener la sesión' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/logout
 * Log out the current user
 */
export async function DELETE() {
  try {
    // Clear auth cookies
    const response = NextResponse.json(
      { success: true },
      { status: 200 }
    );
    
    response.cookies.delete('access_token');
    response.cookies.delete('refresh_token');
    
    logger.info('User logged out successfully');
    
    return response;
    
  } catch (error) {
    logger.error('Logout error', { 
      error: error.message, 
      stack: error.stack 
    });
    
    return NextResponse.json(
      { error: 'Error al cerrar sesión' },
      { status: 500 }
    );
  }
}
