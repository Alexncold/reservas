// Export all alerting functionality
export * from './config';
export * from './manager';
export * from './notifiers';

// Import logger to set up the alerting integration
import { logger } from '../logger';
import { alertManager } from './manager';

// Set up logger integration to automatically process log entries for alerts
const originalLogMethod = logger.error.bind(logger);

// Override the error method to also process alerts
logger.error = (message: string, context?: Record<string, unknown>, error?: Error) => {
  const entry = originalLogMethod(message, context, error);
  
  // Process the log entry for alerts in the background
  // Don't await to avoid blocking the main execution
  alertManager.processLogEntry({
    timestamp: new Date(),
    level: 'error',
    message,
    context,
    error,
  }).catch(err => {
    console.error('Failed to process log entry for alerts', err);
  });
  
  return entry;
};

// Set up other log levels if needed
const originalWarnMethod = logger.warn.bind(logger);
logger.warn = (message: string, context?: Record<string, unknown>) => {
  const entry = originalWarnMethod(message, context);
  
  alertManager.processLogEntry({
    timestamp: new Date(),
    level: 'warn',
    message,
    context,
  }).catch(console.error);
  
  return entry;
};

// Export default alert manager as the main interface
export default alertManager;
