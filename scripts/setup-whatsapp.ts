#!/usr/bin/env node
import { whatsappConfig } from '../src/lib/whatsapp/config';
import { logger } from '../src/lib/logger';
import { initializeQueues } from '../src/lib/whatsapp/queue';
import { dbConnect } from '../src/lib/db';

async function setupWhatsApp() {
  try {
    logger.info('Starting WhatsApp setup...');
    
    // 1. Verify required environment variables
    const requiredVars = [
      'WHATSAPP_BUSINESS_PHONE_ID',
      'WHATSAPP_TOKEN',
      'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
      'MONGODB_URI',
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // 2. Connect to database
    logger.info('Connecting to database...');
    await dbConnect();
    logger.info('Database connected successfully');

    // 3. Initialize queues
    logger.info('Initializing notification queues...');
    await initializeQueues();
    logger.info('Notification queues initialized');

    // 4. Verify WhatsApp Business API connection
    logger.info('Verifying WhatsApp Business API connection...');
    const url = `${whatsappConfig.WHATSAPP_API_BASE}/${whatsappConfig.WHATSAPP_BUSINESS_PHONE_ID}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${whatsappConfig.WHATSAPP_TOKEN}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Failed to connect to WhatsApp API: ${JSON.stringify(error)}`);
    }

    const phoneData = await response.json();
    logger.info('Successfully connected to WhatsApp Business API', {
      phoneNumber: phoneData.display_phone_number,
      phoneId: phoneData.id,
    });

    // 5. Display webhook setup instructions
    logger.info('\n✅ WhatsApp setup completed successfully!\n');
    
    console.log('='.repeat(80));
    console.log('WHATSAPP WEBHOOK SETUP INSTRUCTIONS');
    console.log('='.repeat(80));
    console.log('1. Go to your Meta Developer Dashboard:');
    console.log('   https://developers.facebook.com/apps/\n');
    
    console.log('2. Select your app and go to "WhatsApp" > "API Setup"\n');
    
    console.log('3. In the "Webhook" section, click "Edit" and enter:');
    console.log(`   - Callback URL: ${process.env.NEXT_PUBLIC_APP_URL || 'YOUR_APP_URL'}/api/waba/webhook`);
    console.log(`   - Verify Token: ${whatsappConfig.WHATSAPP_WEBHOOK_VERIFY_TOKEN}\n`);
    
    console.log('4. Subscribe to the following webhook fields:');
    console.log('   - messages');
    console.log('   - messaging_phone_number');
    console.log('   - message_template_status_update');
    console.log('   - message_template_status_update');
    
    console.log('\n5. Save your changes\n');
    
    console.log('6. Test your webhook by sending a message to your WhatsApp Business number');
    console.log('   You should see the message in your application logs.\n');
    
    console.log('='.repeat(80));
    console.log('NEXT STEPS');
    console.log('='.repeat(80));
    console.log('1. Create the following message templates in WhatsApp Manager:');
    console.log('   - reserva_pendiente_v1 (Utility)');
    console.log('   - reserva_confirmada_v1 (Utility)');
    console.log('   - reserva_recordatorio_24h_v1 (Utility)');
    console.log('   - reserva_recordatorio_2h_v1 (Utility)');
    console.log('   - reserva_cancelada_v1 (Utility)');
    console.log('   - unsubscribe_confirmation (Utility)');
    console.log('   - welcome_back (Utility)\n');
    
    console.log('2. Test the notification flow by creating a test reservation');
    console.log('\nSetup complete! 🎉');
    
    process.exit(0);
  } catch (error) {
    logger.error('Failed to setup WhatsApp', {
      error: error.message,
      stack: error.stack,
    });
    console.error('\n❌ Setup failed. See logs for details.');
    process.exit(1);
  }
}

// Run the setup
setupWhatsApp();
