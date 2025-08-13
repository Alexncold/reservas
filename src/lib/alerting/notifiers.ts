import { logger } from '../logger';

// Email notification service
export interface EmailOptions {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
}

/**
 * Send an email alert
 */
export async function sendEmailAlert(options: EmailOptions): Promise<void> {
  const { to, subject, text, html, from } = {
    from: process.env.ALERT_EMAIL_FROM || 'alerts@gamehub.com',
    ...options,
  };

  // In production, use a real email service like SendGrid, Mailgun, etc.
  if (process.env.NODE_ENV === 'production') {
    // Example using SendGrid (you'll need to install @sendgrid/mail)
    try {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      
      await sgMail.send({
        to,
        from,
        subject: `[GameHub] ${subject}`,
        text,
        html: html || text.replace(/\n/g, '<br>'),
      });
      
      logger.debug('Email alert sent', { to: Array.isArray(to) ? to : [to], subject });
    } catch (error) {
      logger.error('Failed to send email alert', { error, to, subject });
      throw error;
    }
  } else {
    // In development, just log the email
    logger.info('Email alert (not sent in development)', {
      to: Array.isArray(to) ? to : [to],
      from,
      subject,
      text,
    });
  }
}

// Slack notification service
export interface SlackMessage {
  text: string;
  attachments?: Array<{
    title?: string;
    text: string;
    color?: string;
    fields?: Array<{ title: string; value: string; short: boolean }>;
  }>;
  blocks?: any[]; // Slack block kit blocks
}

export interface SlackOptions {
  webhookUrl: string;
  message: SlackMessage;
  channel?: string;
  username?: string;
  icon_emoji?: string;
}

/**
 * Send a Slack alert
 */
export async function sendSlackAlert(options: SlackOptions): Promise<void> {
  const { webhookUrl, message, channel, username, icon_emoji } = {
    username: 'GameHub Alerts',
    icon_emoji: ':warning:',
    ...options,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel,
        username,
        icon_emoji,
        ...message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Slack API error: ${response.status} - ${errorText}`);
    }

    logger.debug('Slack alert sent', { channel, text: message.text });
  } catch (error) {
    logger.error('Failed to send Slack alert', { error, webhookUrl });
    throw error;
  }
}

// PagerDuty notification service
export interface PagerDutyIncident {
  type: 'incident';
  title: string;
  service: {
    id: string;
    type: string;
    summary?: string;
  };
  urgency?: 'high' | 'low';
  body?: {
    type: string;
    details: Record<string, any>;
  };
  assignments?: Array<{
    assignee: {
      id: string;
      type: 'user_reference' | 'escalation_policy_reference';
      summary?: string;
    };
  }>;
}

export interface PagerDutyOptions {
  serviceKey: string;
  incident: PagerDutyIncident;
  client?: string;
  clientUrl?: string;
}

/**
 * Trigger a PagerDuty incident
 */
export async function triggerPagerDutyIncident(options: PagerDutyOptions): Promise<void> {
  const { serviceKey, incident, client = 'GameHub', clientUrl } = options;
  
  // In production, call the PagerDuty API
  if (process.env.NODE_ENV === 'production') {
    try {
      const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          routing_key: serviceKey,
          event_action: 'trigger',
          dedup_key: `gamehub-${Date.now()}`,
          payload: {
            summary: incident.title,
            source: clientUrl || 'gamehub-reservations',
            severity: incident.urgency === 'high' ? 'critical' : 'error',
            ...incident,
          },
          client,
          client_url: clientUrl,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`PagerDuty API error: ${response.status} - ${JSON.stringify(data)}`);
      }

      logger.debug('PagerDuty incident triggered', { 
        incidentId: data.dedup_key,
        status: data.status,
        message: data.message,
      });
    } catch (error) {
      logger.error('Failed to trigger PagerDuty incident', { error });
      throw error;
    }
  } else {
    // In development, just log the incident
    logger.info('PagerDuty incident (not triggered in development)', {
      incident: {
        ...incident,
        serviceKey: '[REDACTED]',
      },
    });
  }
}

// SMS notification service (using Twilio as an example)
export interface SmsOptions {
  to: string; // E.164 format: +1234567890
  body: string;
  from?: string;
}

/**
 * Send an SMS alert (using Twilio)
 */
export async function sendSmsAlert(options: SmsOptions): Promise<void> {
  const { to, body, from } = {
    from: process.env.TWILIO_PHONE_NUMBER,
    ...options,
  };

  // In production, use Twilio to send SMS
  if (process.env.NODE_ENV === 'production') {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      
      if (!accountSid || !authToken) {
        throw new Error('Twilio credentials not configured');
      }
      
      const client = require('twilio')(accountSid, authToken);
      
      await client.messages.create({
        body,
        to,
        from,
      });
      
      logger.debug('SMS alert sent', { to, from });
    } catch (error) {
      logger.error('Failed to send SMS alert', { error, to });
      throw error;
    }
  } else {
    // In development, just log the SMS
    logger.info('SMS alert (not sent in development)', { to, from, body });
  }
}
