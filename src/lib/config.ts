import { z } from 'zod';

// Define the schema for environment variables
const envSchema = z.object({
  // Google Sheets Configuration
  SPREADSHEET_ID: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  SHEETS_SYNC_ENABLED: z.string().default('false'),
  
  // Application Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  TZ: z.string().default('America/Argentina/Buenos_Aires'),
  
  // Authentication
  NEXTAUTH_SECRET: z.string().min(32, 'Must be at least 32 characters'),
  NEXTAUTH_URL: z.string().url().optional(),
  
  // Admin Credentials (for basic auth)
  ADMIN_USERNAME: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  
  // MongoDB
  MONGODB_URI: z.string().url(),
  
  // MercadoPago
  MP_ACCESS_TOKEN: z.string().optional(),
  NEXT_PUBLIC_MP_PUBLIC_KEY: z.string().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),
});

// Parse environment variables
const env = envSchema.safeParse(process.env);

// Throw error if validation fails
if (!env.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(env.error.format(), null, 2));
  throw new Error('Invalid environment variables');
}

// Export validated environment variables
export const config = env.data;

// Helper to check if sheets sync is enabled
export const isSheetsSyncEnabled = () => {
  return config.SHEETS_SYNC_ENABLED === 'true' && 
         !!config.SPREADSHEET_ID && 
         !!config.GOOGLE_SERVICE_JSON;
};

// Helper to get Google Sheets credentials
export const getGoogleCredentials = () => {
  if (!config.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set');
  }
  
  try {
    return JSON.parse(config.GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch (error) {
    throw new Error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON');
  }
};

// Types
export type Config = typeof config;
