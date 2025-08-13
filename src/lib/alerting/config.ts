/**
 * Alerting configuration
 * 
 * This file contains configuration for different types of alerts
 * and their thresholds.
 */

import { LogLevel } from '../logger';

export interface AlertRule {
  // Unique identifier for the alert rule
  id: string;
  
  // Human-readable name
  name: string;
  
  // Description of when this alert should trigger
  description: string;
  
  // Log level that triggers this alert
  level: LogLevel;
  
  // Conditions that must be met for the alert to trigger
  conditions: {
    // Number of occurrences within the time window to trigger the alert
    count: number;
    
    // Time window in milliseconds
    timeWindow: number;
    
    // Optional: Specific error messages or patterns to match
    messagePattern?: string | RegExp;
    
    // Optional: Specific context fields to match
    contextMatcher?: (context: Record<string, any>) => boolean;
  };
  
  // How often to notify (in milliseconds) when the alert is active
  notificationThrottle: number;
  
  // Who to notify
  notify: {
    // Email addresses to notify
    emails?: string[];
    
    // Slack webhook URL
    slackWebhookUrl?: string;
    
    // PagerDuty integration key
    pagerDutyKey?: string;
    
    // Whether to create an incident in Sentry
    createSentryIssue?: boolean;
  };
  
  // Whether the alert is enabled
  enabled: boolean;
}

// Default alert rules
export const DEFAULT_ALERT_RULES: AlertRule[] = [
  // Critical errors (1+ occurrences)
  {
    id: 'critical-errors',
    name: 'Critical Errors',
    description: 'Critical errors that require immediate attention',
    level: 'error',
    conditions: {
      count: 1,
      timeWindow: 5 * 60 * 1000, // 5 minutes
    },
    notificationThrottle: 15 * 60 * 1000, // 15 minutes
    notify: {
      emails: ['alerts@gamehub.com'],
      createSentryIssue: true,
    },
    enabled: true,
  },
  
  // Error rate increase (10+ errors in 5 minutes)
  {
    id: 'error-rate-increase',
    name: 'Error Rate Increase',
    description: 'Significant increase in error rate',
    level: 'error',
    conditions: {
      count: 10,
      timeWindow: 5 * 60 * 1000, // 5 minutes
    },
    notificationThrottle: 30 * 60 * 1000, // 30 minutes
    notify: {
      emails: ['alerts@gamehub.com'],
      slackWebhookUrl: process.env.SLACK_ALERTS_WEBHOOK_URL,
    },
    enabled: true,
  },
  
  // High latency (p95 > 2s)
  {
    id: 'high-latency',
    name: 'High Latency',
    description: 'p95 response time exceeds threshold',
    level: 'warn',
    conditions: {
      count: 5, // 5 occurrences in the time window
      timeWindow: 10 * 60 * 1000, // 10 minutes
      messagePattern: /Request completed/,
      contextMatcher: (context) => 
        context.responseTime && 
        typeof context.responseTime === 'string' && 
        parseFloat(context.responseTime) > 2000, // 2 seconds
    },
    notificationThrottle: 30 * 60 * 1000, // 30 minutes
    notify: {
      emails: ['performance@gamehub.com'],
      slackWebhookUrl: process.env.SLACK_PERFORMANCE_WEBHOOK_URL,
    },
    enabled: true,
  },
  
  // Failed payments
  {
    id: 'failed-payments',
    name: 'Failed Payments',
    description: 'Failed payment processing',
    level: 'error',
    conditions: {
      count: 1,
      timeWindow: 5 * 60 * 1000, // 5 minutes
      messagePattern: /Payment failed/,
    },
    notificationThrottle: 15 * 60 * 1000, // 15 minutes
    notify: {
      emails: ['payments@gamehub.com'],
      slackWebhookUrl: process.env.SLACK_PAYMENTS_WEBHOOK_URL,
      pagerDutyKey: process.env.PAGERDUTY_PAYMENTS_KEY,
    },
    enabled: true,
  },
];

// Get active alert rules
export function getActiveAlertRules(): AlertRule[] {
  return DEFAULT_ALERT_RULES.filter(rule => rule.enabled);
}

// Get alert rule by ID
export function getAlertRule(id: string): AlertRule | undefined {
  return DEFAULT_ALERT_RULES.find(rule => rule.id === id);
}
