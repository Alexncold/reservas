import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

// This is a basic auth configuration for admin access
// In production, you might want to use a more secure provider
// like Google, Auth0, or a database-backed solution

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // This is a simple example - in production, you should:
        // 1. Use environment variables for admin credentials
        // 2. Use a proper database for user management
        // 3. Implement proper password hashing
        const user = { id: "1", name: "Admin", email: "admin@example.com" };
        
        if (
          credentials?.username === process.env.ADMIN_USERNAME &&
          credentials?.password === process.env.ADMIN_PASSWORD
        ) {
          return user;
        }
        return null;
      }
    })
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
};

// Helper function to check if user is admin
export const isAdmin = (session: any) => {
  return session?.user?.email === 'admin@example.com';
};
