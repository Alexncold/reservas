import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';

type User = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'staff';
} | null;

type UseAuthReturn = {
  user: User;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

/**
 * Custom hook to handle authentication state and methods
 */
export function useAuth(requireAuth = false): UseAuthReturn {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Check if user is authenticated
  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/session');
      const data = await response.json();
      
      if (data.user) {
        setUser(data.user);
      } else if (requireAuth) {
        router.push(`/auth/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
      }
      
      return data.user;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Auth check failed', { error: errorMessage });
      setError('Error al verificar la sesión');
      return null;
    } finally {
      setLoading(false);
    }
  }, [requireAuth, router]);

  // Initial auth check
  useEffect(() => {
    checkAuth();
    
    // Set up periodic session check (every 5 minutes)
    const interval = setInterval(checkAuth, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [checkAuth]);

  // Login function
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al iniciar sesión');
      }
      
      const { user } = await response.json();
      setUser(user);
      
      // Redirect to dashboard or callback URL
      const urlParams = new URLSearchParams(window.location.search);
      const callbackUrl = urlParams.get('callbackUrl') || '/admin';
      router.push(callbackUrl);
      
      return true;
    } catch (err) {
      logger.error('Login failed', { error: err });
      setError(err.message || 'Error al iniciar sesión');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      setLoading(true);
      
      await fetch('/api/auth/logout', {
        method: 'DELETE',
      });
      
      setUser(null);
      router.push('/auth/login');
    } catch (err) {
      logger.error('Logout failed', { error: err });
      setError('Error al cerrar sesión');
    } finally {
      setLoading(false);
    }
  };

  // Refresh session
  const refreshSession = async (): Promise<void> => {
    await checkAuth();
  };

  return {
    user,
    loading,
    error,
    login,
    logout,
    refreshSession,
  };
}

/**
 * Higher-Order Component to protect routes that require authentication
 */
export function withAuth(Component: React.ComponentType<any>, roles?: Array<'admin' | 'staff'>) {
  return function WithAuth(props: any) {
    const { user, loading } = useAuth(true);
    const router = useRouter();

    useEffect(() => {
      if (!loading && user) {
        // Check if user has required role
        if (roles && !roles.includes(user.role)) {
          router.push('/unauthorized');
        }
      }
    }, [user, loading, roles, router]);

    if (loading || !user) {
      return <div>Loading...</div>; // Or a loading spinner
    }

    // Check if user has required role
    if (roles && !roles.includes(user.role)) {
      return <div>You don't have permission to access this page</div>;
    }

    return <Component {...props} user={user} />;
  };
}

/**
 * Hook to check if user has specific role
 */
export function useRole(requiredRole: 'admin' | 'staff'): boolean {
  const { user } = useAuth();
  return user?.role === requiredRole || false;
}

/**
 * Hook to check if user has any of the required roles
 */
export function useAnyRole(requiredRoles: Array<'admin' | 'staff'>): boolean {
  const { user } = useAuth();
  return user ? requiredRoles.includes(user.role) : false;
}
