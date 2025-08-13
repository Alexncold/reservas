import * as Sentry from '@sentry/node';
import { RewriteFrames } from '@sentry/integrations';
import { logger } from './logger';

// Skip Sentry initialization in test environment
if (process.env.NODE_ENV !== 'test') {
  // Initialize Sentry
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: `gamehub@${process.env.npm_package_version}`,
    // Enable performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev
    // Enable session tracking
    autoSessionTracking: true,
    // Filter out health checks and other noise
    beforeSend(event) {
      // Filter out health checks
      if (event.request?.url?.includes('/health')) {
        return null;
      }
      return event;
    },
    // Add source maps support
    integrations: [
      new RewriteFrames({
        root: process.cwd(),
      }),
      // Add other integrations as needed
    ],
    // Configure release
    // release: process.env.VERCEL_GIT_COMMIT_SHA,
  });

  // Set up global error handler
  process.on('unhandledRejection', (error) => {
    logger.error('Unhandled promise rejection', { error });
    Sentry.captureException(error);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error });
    Sentry.captureException(error);
    // In case of uncaught exceptions, we might want to restart the process
    // after ensuring all pending operations are complete
    process.exit(1);
  });
}

/**
 * Wraps a request handler with Sentry error and performance monitoring
 */
export function withSentry(handler: any) {
  return async function (...args: any[]) {
    const [req, res] = args;
    
    // Add request to Sentry scope
    Sentry.configureScope((scope) => {
      scope.addEventProcessor((event) => {
        return Sentry.Handlers.parseRequest(event, req);
      });
      
      // Add user context if available
      if (req.user) {
        scope.setUser({
          id: req.user.id,
          email: req.user.email,
          ip_address: req.ip,
        });
      }
      
      // Add tags
      scope.setTag('path', req.path);
      scope.setTag('method', req.method);
    });
    
    try {
      // Start a transaction for this request
      const transaction = Sentry.startTransaction({
        op: 'http.server',
        name: `${req.method} ${req.url}`,
      });
      
      // Set the transaction on the scope so it's available in error handlers
      Sentry.configureScope((scope) => {
        scope.setSpan(transaction);
      });
      
      // Add request data to the transaction
      transaction.setData('url', req.url);
      transaction.setData('method', req.method);
      transaction.setData('query', req.query);
      transaction.setData('body', req.body);
      
      // Call the original handler
      const result = await handler(...args);
      
      // Set the transaction status and finish it
      transaction.setHttpStatus(res.statusCode);
      transaction.finish();
      
      return result;
    } catch (error) {
      // Capture the error with Sentry
      Sentry.captureException(error);
      
      // Re-throw the error to be handled by the Next.js error boundary
      throw error;
    } finally {
      // Clear the scope
      Sentry.getCurrentHub().getScope()?.clear();
    }
  };
}

/**
 * Wraps an API route with Sentry error and performance monitoring
 */
export function withSentryApi(handler: any) {
  return withSentry(async (req: any, res: any) => {
    try {
      return await handler(req, res);
    } catch (error) {
      logger.error('API error', { error });
      
      // Send error response
      res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' 
          ? 'Internal server error' 
          : error.message,
      });
    }
  });
}

/**
 * Wraps a Next.js page component with Sentry error boundary
 */
export function withSentryPage(PageComponent: any) {
  // In development, don't use Sentry to avoid slowing down development
  if (process.env.NODE_ENV !== 'production') {
    return PageComponent;
  }
  
  // Return the original component with Sentry error boundary
  return class SentryWrappedPage extends PageComponent {
    static async getInitialProps(context: any) {
      try {
        return await PageComponent.getInitialProps?.(context);
      } catch (error) {
        // Capture the error with Sentry
        Sentry.captureException(error);
        
        // Re-throw the error to be handled by the Next.js error boundary
        throw error;
      }
    }
    
    componentDidCatch(error: Error, errorInfo: any) {
      // Capture the error with Sentry
      Sentry.withScope((scope) => {
        scope.setExtras(errorInfo);
        Sentry.captureException(error);
      });
      
      // Call the original error handler if it exists
      if (super.componentDidCatch) {
        super.componentDidCatch(error, errorInfo);
      }
    }
  };
}

export { Sentry };
