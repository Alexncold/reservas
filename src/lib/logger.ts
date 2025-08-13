import pino from 'pino';
import * as Sentry from '@sentry/node';
import { tableLocksManager } from './tableLocks';

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
  requestId?: string;
  userId?: string;
}

// Environment configuration
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Configure Pino logger
const pinoLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isProduction
    ? undefined // Use default JSON in production
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
  serializers: {
    error: pino.stdSerializers.err,
  },
  base: {
    env: process.env.NODE_ENV,
    service: 'gamehub-reservations',
  },
});

class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Maximum number of logs to keep in memory
  private requestId: string | null = null;
  private userId: string | null = null;

  private constructor() {
    // Set up error handlers
    process.on('uncaughtException', (error) => {
      this.error('Uncaught exception', { error });
      process.exit(1); // Exit with failure
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.error('Unhandled rejection', { reason, promise });
    });
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Set request context for distributed tracing
   */
  public setContext(requestId: string, userId?: string) {
    this.requestId = requestId;
    if (userId) this.userId = userId;
  }

  /**
   * Clear the current context
   */
  public clearContext() {
    this.requestId = null;
    this.userId = null;
  }

  private getLogContext(context?: Record<string, unknown>) {
    return {
      ...context,
      ...(this.requestId && { requestId: this.requestId }),
      ...(this.userId && { userId: this.userId }),
    };
  }

  private addLog(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error) {
    const timestamp = new Date();
    const logContext = this.getLogContext(context);
    const entry: LogEntry = {
      timestamp,
      level,
      message,
      context: logContext,
      error,
      ...(this.requestId && { requestId: this.requestId }),
      ...(this.userId && { userId: this.userId }),
    };

    // Add to in-memory logs (only in development or if explicitly enabled)
    if (!isProduction || process.env.ENABLE_MEMORY_LOGS === 'true') {
      this.logs.push(entry);
      if (this.logs.length > this.maxLogs) {
        this.logs.shift();
      }
    }

    // Log to Pino
    const pinoContext = {
      ...logContext,
      ...(error && { error: error.message, stack: error.stack }),
    };

    switch (level) {
      case 'error':
        pinoLogger.error(pinoContext, message);
        // Send errors to Sentry
        if (isProduction && !isTest) {
          Sentry.withScope((scope) => {
            if (error) {
              scope.setExtras(pinoContext);
              Sentry.captureException(error);
            } else {
              scope.setExtras({ context: pinoContext });
              Sentry.captureMessage(message, 'error');
            }
          });
        }
        break;
      case 'warn':
        pinoLogger.warn(pinoContext, message);
        break;
      case 'info':
        pinoLogger.info(pinoContext, message);
        break;
      case 'debug':
        pinoLogger.debug(pinoContext, message);
        break;
    }

    // Log table lock status if relevant
    if (context?.tableLock) {
      const activeLocks = tableLocksManager.getActiveLocks();
      this.debug('Active table locks', { activeLocks });
    }

    return entry;
  }

  // Public logging methods
  public error(message: string, context?: Record<string, unknown>, error?: Error) {
    return this.addLog('error', message, context, error);
  }

  public warn(message: string, context?: Record<string, unknown>) {
    return this.addLog('warn', message, context);
  }

  public info(message: string, context?: Record<string, unknown>) {
    return this.addLog('info', message, context);
  }

  public debug(message: string, context?: Record<string, unknown>) {
    return this.addLog('debug', message, context);
  }

  // Get logs (for admin/dashboard purposes)
  public getLogs(level?: LogLevel): LogEntry[] {
    if (level) {
      return this.logs.filter((entry) => entry.level === level);
    }
    return [...this.logs];
  }

  // Create a child logger with additional context
  public child(context: Record<string, unknown>) {
    const childLogger = new Logger();
    childLogger.logs = this.logs; // Share logs with parent
    childLogger.requestId = this.requestId;
    childLogger.userId = this.userId;
    
    // Create a proxy to add context to all log calls
    return new Proxy(childLogger, {
      get(target, prop) {
        if (['error', 'warn', 'info', 'debug'].includes(prop as string)) {
          return (message: string, logContext: Record<string, unknown> = {}) => {
            return (target as any)[prop](message, { ...context, ...logContext });
          };
        }
        return (target as any)[prop];
      },
    });
  }
}

export const logger = Logger.getInstance();

// Export a request logger middleware
export function requestLogger() {
  return (req: any, res: any, next: () => void) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    
    // Set request context
    logger.setContext(requestId, req.user?.id);
    
    // Log request start
    logger.info('Request started', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    // Log response when finished
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      
      logger.info('Request completed', {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
      });
      
      // Clear the context
      logger.clearContext();
    });
    
    next();
  };
}
