import { logger } from '../logger';
import { AlertRule, getActiveAlertRules } from './config';
import { sendEmailAlert, sendSlackAlert, triggerPagerDutyIncident } from './notifiers';
import { LogEntry } from '../logger';

interface ActiveAlert {
  rule: AlertRule;
  count: number;
  firstOccurred: Date;
  lastNotified: Date | null;
  matchingEntries: LogEntry[];
}

class AlertManager {
  private static instance: AlertManager;
  private activeAlerts: Map<string, ActiveAlert> = new Map();
  private alertHistory: Array<{ ruleId: string; timestamp: Date; count: number }> = [];
  private readonly MAX_HISTORY_ENTRIES = 1000;

  private constructor() {
    // Clean up old history entries periodically
    setInterval(() => this.cleanupOldHistory(), 60 * 60 * 1000); // Every hour
  }

  public static getInstance(): AlertManager {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager();
    }
    return AlertManager.instance;
  }

  /**
   * Process a log entry and check if it triggers any alerts
   */
  public async processLogEntry(entry: LogEntry): Promise<void> {
    const activeRules = getActiveAlertRules();
    
    for (const rule of activeRules) {
      // Skip if log level is below the rule's level
      if (this.getLogLevelPriority(entry.level) < this.getLogLevelPriority(rule.level)) {
        continue;
      }

      // Check if the message matches the pattern if specified
      if (rule.conditions.messagePattern) {
        const pattern = rule.conditions.messagePattern;
        const message = entry.message || '';
        const matches = 
          (typeof pattern === 'string' && message.includes(pattern)) ||
          (pattern instanceof RegExp && pattern.test(message));
        
        if (!matches) {
          continue;
        }
      }

      // Check context matcher if specified
      if (rule.conditions.contextMatcher && !rule.conditions.contextMatcher(entry.context || {})) {
        continue;
      }

      // If we get here, the log entry matches the rule criteria
      await this.handleMatchingLogEntry(rule, entry);
    }
  }

  /**
   * Handle a log entry that matches an alert rule
   */
  private async handleMatchingLogEntry(rule: AlertRule, entry: LogEntry): Promise<void> {
    const now = new Date();
    const alertKey = this.getAlertKey(rule, entry);
    
    // Get or create the active alert
    let activeAlert = this.activeAlerts.get(alertKey);
    if (!activeAlert) {
      activeAlert = {
        rule,
        count: 0,
        firstOccurred: now,
        lastNotified: null,
        matchingEntries: [],
      };
      this.activeAlerts.set(alertKey, activeAlert);
    }

    // Update the alert
    activeAlert.count++;
    activeAlert.matchingEntries.push(entry);
    
    // Keep only the most recent entries (for context in notifications)
    if (activeAlert.matchingEntries.length > 10) {
      activeAlert.matchingEntries.shift();
    }

    // Check if we should trigger a notification
    const shouldNotify = this.shouldNotify(activeAlert, now);
    if (shouldNotify) {
      await this.triggerAlert(activeAlert);
      activeAlert.lastNotified = now;
    }

    // Add to history
    this.alertHistory.push({
      ruleId: rule.id,
      timestamp: now,
      count: activeAlert.count,
    });

    // Clean up old history
    if (this.alertHistory.length > this.MAX_HISTORY_ENTRIES) {
      this.alertHistory = this.alertHistory.slice(-this.MAX_HISTORY_ENTRIES);
    }
  }

  /**
   * Check if we should send a notification for an alert
   */
  private shouldNotify(alert: ActiveAlert, now: Date): boolean {
    const { rule } = alert;
    
    // Check if we've reached the threshold
    if (alert.count < rule.conditions.count) {
      return false;
    }
    
    // Check if we're within the time window
    const timeSinceFirstOccurred = now.getTime() - alert.firstOccurred.getTime();
    if (timeSinceFirstOccurred > rule.conditions.timeWindow) {
      return false;
    }
    
    // Check if we've notified recently (throttling)
    if (alert.lastNotified) {
      const timeSinceLastNotified = now.getTime() - alert.lastNotified.getTime();
      if (timeSinceLastNotified < rule.notificationThrottle) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Trigger an alert notification
   */
  private async triggerAlert(alert: ActiveAlert): Promise<void> {
    const { rule, count, firstOccurred, matchingEntries } = alert;
    const now = new Date();
    
    // Prepare alert details
    const details = {
      ruleId: rule.id,
      ruleName: rule.name,
      count,
      firstOccurred,
      lastOccurred: new Date(matchingEntries[matchingEntries.length - 1].timestamp),
      timeWindow: rule.conditions.timeWindow,
      sampleEntries: matchingEntries.map(entry => ({
        timestamp: entry.timestamp,
        message: entry.message,
        context: entry.context,
      })),
    };

    logger.warn(`Alert triggered: ${rule.name}`, details);

    // Send notifications based on the rule configuration
    const notifications: Promise<any>[] = [];
    
    // Email notifications
    if (rule.notify.emails && rule.notify.emails.length > 0) {
      notifications.push(
        sendEmailAlert({
          to: rule.notify.emails,
          subject: `[ALERT] ${rule.name} triggered`,
          text: JSON.stringify(details, null, 2),
        }).catch(error => {
          logger.error('Failed to send email alert', { error, ruleId: rule.id });
        })
      );
    }
    
    // Slack notifications
    if (rule.notify.slackWebhookUrl) {
      notifications.push(
        sendSlackAlert({
          webhookUrl: rule.notify.slackWebhookUrl,
          message: {
            text: `:warning: *${rule.name}*\n${rule.description}\n\n*Count:* ${count}\n*First occurred:* ${firstOccurred.toISOString()}`,
            attachments: [
              {
                title: 'Sample Entries',
                text: matchingEntries
                  .slice(0, 3) // Limit to 3 sample entries
                  .map((e, i) => 
                    `${i + 1}. ${new Date(e.timestamp).toISOString()}: ${e.message}`
                  )
                  .join('\n'),
                color: '#ff0000',
              },
            ],
          },
        }).catch(error => {
          logger.error('Failed to send Slack alert', { error, ruleId: rule.id });
        })
      );
    }
    
    // PagerDuty incidents
    if (rule.notify.pagerDutyKey) {
      notifications.push(
        triggerPagerDutyIncident({
          serviceKey: rule.notify.pagerDutyKey,
          incident: {
            type: 'incident',
            title: `${rule.name} - ${count} occurrences`,
            service: {
              id: 'gamehub-reservations',
              type: 'service_reference',
              summary: 'GameHub Reservations Service',
            },
            body: {
              type: 'incident_body',
              details: {
                description: rule.description,
                count,
                firstOccurred: firstOccurred.toISOString(),
                sampleEntries: matchingEntries.map(e => e.message).join('\n'),
              },
            },
          },
        }).catch(error => {
          logger.error('Failed to trigger PagerDuty incident', { error, ruleId: rule.id });
        })
      );
    }
    
    // Create Sentry issue if configured
    if (rule.notify.createSentryIssue) {
      // This would be implemented using Sentry's API to create an issue
      logger.debug('Would create Sentry issue for alert', { ruleId: rule.id });
    }
    
    // Wait for all notifications to complete
    await Promise.all(notifications);
  }

  /**
   * Clean up old history entries
   */
  private cleanupOldHistory(): void {
    const now = new Date();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    // Clean up alert history
    this.alertHistory = this.alertHistory.filter(
      entry => now.getTime() - entry.timestamp.getTime() <= maxAge
    );
    
    // Clean up active alerts that are no longer relevant
    for (const [key, alert] of this.activeAlerts.entries()) {
      const timeSinceLastOccurred = now.getTime() - alert.firstOccurred.getTime();
      const timeSinceLastNotified = alert.lastNotified 
        ? now.getTime() - alert.lastNotified.getTime()
        : 0;
      
      // Remove if it's been a while since the last occurrence and we've notified
      if (timeSinceLastOccurred > maxAge && timeSinceLastNotified > alert.rule.notificationThrottle) {
        this.activeAlerts.delete(key);
      }
    }
  }

  /**
   * Get a unique key for an alert
   */
  private getAlertKey(rule: AlertRule, entry: LogEntry): string {
    // For most alerts, we can use the rule ID as the key
    // For more specific alerts, we might want to include context
    if (rule.id === 'failed-payments' && entry.context?.paymentId) {
      return `${rule.id}-${entry.context.paymentId}`;
    }
    
    return rule.id;
  }

  /**
   * Get the priority of a log level
   */
  private getLogLevelPriority(level: string): number {
    const levels = {
      error: 4,
      warn: 3,
      info: 2,
      debug: 1,
    };
    
    return levels[level as keyof typeof levels] || 0;
  }

  /**
   * Get the current alert status
   */
  public getStatus() {
    return {
      activeAlerts: Array.from(this.activeAlerts.entries()).map(([key, alert]) => ({
        key,
        ruleId: alert.rule.id,
        count: alert.count,
        firstOccurred: alert.firstOccurred,
        lastNotified: alert.lastNotified,
      })),
      history: this.alertHistory,
    };
  }
}

export const alertManager = AlertManager.getInstance();
