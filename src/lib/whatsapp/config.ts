import { z } from 'zod';

// Schema for environment variables
const envSchema = z.object({
  // WhatsApp Business API
  WHATSAPP_BUSINESS_PHONE_ID: z.string().min(1, 'Required'),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  WHATSAPP_TOKEN: z.string().min(1, 'Required'),
  WHATSAPP_API_BASE: z.string().url().default('https://graph.facebook.com/v20.0'),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().min(1, 'Required'),
  
  // Notification settings
  NOTIFY_ENABLED: z.string().default('true').transform(v => v === 'true'),
  
  // Redis/Queue (for BullMQ)
  UPSTASH_REDIS_URL: z.string().url().optional(),
  
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  TZ: z.string().default('America/Argentina/Buenos_Aires'),
});

// Parse environment variables
const env = envSchema.safeParse(process.env);

// Throw error if validation fails
if (!env.success) {
  console.error('❌ Invalid WhatsApp environment variables:', JSON.stringify(env.error.format(), null, 2));
  throw new Error('Invalid WhatsApp environment variables');
}

// Export validated config
export const whatsappConfig = env.data;

// Types
export type WhatsAppConfig = typeof whatsappConfig;
