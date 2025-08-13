import { whatsappConfig } from './config';
import { logger } from '@/lib/logger';

export interface TemplateMessage {
  to: string; // E.164 format
  templateName: string;
  templateLang?: string;
  params: string[];
}

export interface SendMessageResult {
  messaging_product: string;
  contacts: {
    input: string;
    wa_id: string;
  }[];
  messages: {
    id: string;
  }[];
}

export async function sendTemplateMessage({
  to,
  templateName,
  templateLang = 'es_AR',
  params,
}: TemplateMessage): Promise<SendMessageResult> {
  if (!whatsappConfig.WHATSAPP_TOKEN || !whatsappConfig.WHATSAPP_BUSINESS_PHONE_ID) {
    throw new Error('WhatsApp not configured');
  }

  const url = `${whatsappConfig.WHATSAPP_API_BASE}/${whatsappConfig.WHATSAPP_BUSICE_PHONE_ID}/messages`;
  
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: templateLang },
      components: [
        {
          type: 'body',
          parameters: params.map(param => ({
            type: 'text',
            text: param,
          })),
        },
      ],
    },
  };

  logger.debug('Sending WhatsApp message', { to, templateName });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${whatsappConfig.WHATSAPP_TOKEN}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `WhatsApp API error: ${response.status} - ${JSON.stringify(data)}`
      );
    }

    logger.info('WhatsApp message sent successfully', {
      to,
      templateName,
      messageId: data.messages?.[0]?.id,
    });

    return data;
  } catch (error) {
    logger.error('Failed to send WhatsApp message', {
      error: error.message,
      to,
      templateName,
    });
    throw error;
  }
}

// Webhook verification
export function verifyWebhook(
  mode: string,
  token: string,
  challenge: string
): { verified: boolean; challenge?: string } {
  if (
    mode === 'subscribe' &&
    token === whatsappConfig.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  ) {
    logger.debug('Webhook verified successfully');
    return { verified: true, challenge };
  }
  logger.warn('Webhook verification failed', { mode, token });
  return { verified: false };
}

// Process incoming webhook events
export async function processWebhookEvent(event: any) {
  logger.debug('Processing WhatsApp webhook event', { event });

  try {
    // Handle different types of events
    if (event.entry?.[0]?.changes?.[0]?.value?.messages) {
      await handleIncomingMessage(event.entry[0].changes[0].value);
    } else if (event.entry?.[0]?.changes?.[0]?.value?.statuses) {
      await handleStatusUpdate(event.entry[0].changes[0].value);
    } else {
      logger.warn('Unhandled webhook event type', { event });
    }
  } catch (error) {
    logger.error('Error processing webhook event', {
      error: error.message,
      event,
    });
    throw error;
  }
}

// Handle incoming messages (e.g., opt-out commands)
async function handleIncomingMessage(value: any) {
  const message = value.messages[0];
  const from = message.from;
  const text = message.text?.body?.toLowerCase()?.trim();

  // Handle opt-out commands
  if (['stop', 'cancelar', 'baja', 'unsubscribe'].includes(text || '')) {
    await handleOptOut(from);
  } else if (['start', 'activar', 'subscribe'].includes(text || '')) {
    await handleOptIn(from);
  }

  // TODO: Handle other message types (e.g., responses to reminders)
}

// Handle message status updates (delivered, read, failed)
async function handleStatusUpdate(value: any) {
  const status = value.statuses[0];
  const messageId = status.id;
  const statusType = status.status;
  const timestamp = new Date(Number(status.timestamp) * 1000);

  // Update notification status in the database
  await Notification.findOneAndUpdate(
    { providerMessageId: messageId },
    {
      $set: {
        status: mapStatusToNotificationStatus(statusType),
        ...(statusType === 'delivered' && { deliveredAt: timestamp }),
        ...(statusType === 'read' && { readAt: timestamp }),
        ...(statusType === 'failed' && {
          lastError: status.errors?.[0]?.title || 'Unknown error',
        }),
      },
    }
  );

  logger.info('Updated notification status', {
    messageId,
    status: statusType,
    timestamp,
  });
}

// Map WhatsApp status to our notification status
function mapStatusToNotificationStatus(
  whatsappStatus: string
): NotificationStatus {
  switch (whatsappStatus) {
    case 'sent':
      return NotificationStatus.SENT;
    case 'delivered':
      return NotificationStatus.DELIVERED;
    case 'read':
      return NotificationStatus.READ;
    case 'failed':
      return NotificationStatus.FAILED;
    default:
      return NotificationStatus.QUEUED;
  }
}

// Handle opt-out command
async function handleOptOut(phone: string) {
  const customer = await Customer.findOneAndUpdate(
    { phoneE164: phone },
    {
      whatsappConsent: false,
      whatsappOptOutAt: new Date(),
      'notificationPreferences.whatsapp': false,
    },
    { new: true, upsert: true }
  );

  logger.info('Customer opted out of WhatsApp notifications', {
    phone,
    customerId: customer._id,
  });

  // Optionally send a confirmation message
  try {
    await sendTemplateMessage({
      to: phone,
      templateName: 'unsubscribe_confirmation',
      templateLang: 'es_AR',
      params: [],
    });
  } catch (error) {
    logger.error('Failed to send opt-out confirmation', { error: error.message });
  }
}

// Handle opt-in command
async function handleOptIn(phone: string) {
  const customer = await Customer.findOneAndUpdate(
    { phoneE164: phone },
    {
      whatsappConsent: true,
      whatsappOptOutAt: null,
      'notificationPreferences.whatsapp': true,
    },
    { new: true, upsert: true }
  );

  logger.info('Customer opted in to WhatsApp notifications', {
    phone,
    customerId: customer._id,
  });

  // Optionally send a welcome back message
  try {
    await sendTemplateMessage({
      to: phone,
      templateName: 'welcome_back',
      templateLang: 'es_AR',
      params: [],
    });
  } catch (error) {
    logger.error('Failed to send welcome back message', { error: error.message });
  }
}
