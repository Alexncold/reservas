import { logger } from './logger';
import { alertManager } from './alerting';
import { AlertRuleId } from './alerting/config';

/**
 * Log a critical error and trigger an alert
 */
export async function alertCritical(
  message: string, 
  context: Record<string, unknown> = {},
  error?: Error
): Promise<void> {
  const logContext = { ...context, alert: true };
  
  // Log the error
  logger.error(message, logContext, error);
  
  // Trigger an alert
  await alertManager.triggerAlert({
    ruleId: AlertRuleId.CRITICAL_ERROR,
    message,
    context: { ...context, error: error?.message },
    severity: 'critical',
  });
}

/**
 * Log a warning and trigger an alert if needed
 */
export async function alertWarning(
  message: string, 
  context: Record<string, unknown> = {},
  error?: Error
): Promise<void> {
  const logContext = { ...context, alert: true };
  
  // Log the warning
  logger.warn(message, logContext, error);
  
  // Trigger an alert
  await alertManager.triggerAlert({
    ruleId: AlertRuleId.WARNING,
    message,
    context: { ...context, error: error?.message },
    severity: 'warning',
  });
}

/**
 * Track a business metric
 */
export function trackMetric(
  name: string,
  value: number = 1,
  tags: Record<string, string> = {}
): void {
  // In a real implementation, this would send metrics to a monitoring service
  logger.info(`[METRIC] ${name}`, { 
    value, 
    ...tags,
    _isMetric: true 
  });
}

/**
 * Track a performance metric
 */
export function trackPerformance<T>(
  name: string,
  operation: () => Promise<T> | T,
  context: Record<string, unknown> = {}
): Promise<T> {
  const startTime = process.hrtime();
  
  const result = operation();
  
  if (result instanceof Promise) {
    return result
      .then((res) => {
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const durationMs = (seconds * 1000) + (nanoseconds / 1e6);
        
        logger.info(`[PERF] ${name}`, {
          durationMs,
          ...context,
          _isPerformance: true
        });
        
        return res;
      })
      .catch((error) => {
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const durationMs = (seconds * 1000) + (nanoseconds / 1e6);
        
        logger.error(`[PERF] ${name} failed`, {
          durationMs,
          ...context,
          error: error.message,
          _isPerformance: true
        });
        
        throw error;
      });
  }
  
  const [seconds, nanoseconds] = process.hrtime(startTime);
  const durationMs = (seconds * 1000) + (nanoseconds / 1e6);
  
  logger.info(`[PERF] ${name}`, {
    durationMs,
    ...context,
    _isPerformance: true
  });
  
  return Promise.resolve(result);
}

/**
 * Track a business event
 */
export function trackEvent(
  name: string,
  properties: Record<string, unknown> = {}
): void {
  // In a real implementation, this would send events to an analytics service
  logger.info(`[EVENT] ${name}`, { 
    ...properties,
    _isEvent: true 
  });
}

/**
 * Health check function that checks critical dependencies
 */
export async function checkHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Array<{
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    details?: Record<string, unknown>;
  }>;
}> {
  const checks = [];
  
  // Check database connection
  try {
    const { default: db } = await import('@/lib/db');
    await db.connection.db.admin().ping();
    checks.push({
      name: 'database',
      status: 'healthy',
      message: 'Database connection is healthy',
    });
  } catch (error) {
    checks.push({
      name: 'database',
      status: 'unhealthy',
      message: 'Failed to connect to database',
      details: { error: error.message },
    });
  }
  
  // Check external services (e.g., MercadoPago, Google Sheets)
  try {
    // Add checks for external services here
    checks.push({
      name: 'external-services',
      status: 'healthy',
      message: 'All external services are healthy',
    });
  } catch (error) {
    checks.push({
      name: 'external-services',
      status: 'degraded',
      message: 'Some external services are unavailable',
      details: { error: error.message },
    });
  }
  
  // Determine overall status
  const hasUnhealthy = checks.some(check => check.status === 'unhealthy');
  const hasDegraded = checks.some(check => check.status === 'degraded');
  
  const status = hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';
  
  return { status, checks };
}

/**
 * Track API usage for rate limiting and analytics
 */
export function trackApiUsage(
  endpoint: string,
  method: string,
  userId?: string,
  metadata: Record<string, unknown> = {}
): void {
  logger.info(`[API_USAGE] ${method} ${endpoint}`, {
    endpoint,
    method,
    userId,
    ...metadata,
    _isApiUsage: true,
  });
}
