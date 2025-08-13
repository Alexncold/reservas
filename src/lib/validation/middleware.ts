import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError, ZodSchema } from 'zod';
import { logger } from '@/lib/logger';

type ValidationSchema = {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
};

/**
 * Middleware factory that validates request data against Zod schemas
 */
export function validateRequest(schemas: ValidationSchema) {
  return async (req: NextRequest) => {
    try {
      const result: Record<string, any> = {};
      
      // Parse and validate query parameters
      if (schemas.query) {
        const searchParams = Object.fromEntries(req.nextUrl.searchParams);
        result.query = await schemas.query.parseAsync(searchParams);
      }
      
      // Parse and validate URL parameters (for dynamic routes)
      if (schemas.params) {
        const params = req.pageParams || {}; // Assuming you have pageParams in your Next.js app
        result.params = await schemas.params.parseAsync(params);
      }
      
      // Parse and validate request body (for POST, PUT, PATCH)
      if (schemas.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
        try {
          let body;
          
          // Handle different content types
          const contentType = req.headers.get('content-type') || '';
          
          if (contentType.includes('application/json')) {
            body = await req.json();
            // We need to create a new request with the same body for the next middleware
            req = new NextRequest(req.url, {
              ...req,
              body: JSON.stringify(body),
            });
          } else if (contentType.includes('application/x-www-form-urlencoded')) {
            const formData = await req.formData();
            body = Object.fromEntries(formData.entries());
          } else if (contentType.includes('multipart/form-data')) {
            // For file uploads, we'll handle them differently
            const formData = await req.formData();
            body = formData;
          } else {
            // Try to parse as JSON by default
            try {
              body = await req.json();
            } catch {
              body = {};
            }
          }
          
          result.body = await schemas.body.parseAsync(body);
        } catch (error) {
          if (error instanceof SyntaxError) {
            throw new Error('Invalid JSON in request body');
          }
          throw error;
        }
      }
      
      // Attach validated data to the request object
      req.validatedData = result;
      
      return req;
      
    } catch (error) {
      logger.error('Validation error', { 
        error: error.message,
        url: req.url,
        method: req.method,
      });
      
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
        }));
        
        return NextResponse.json(
          { 
            error: 'Validation error',
            details: errors,
          },
          { status: 400 }
        );
      }
      
      // For other types of errors
      return NextResponse.json(
        { error: error.message || 'Validation failed' },
        { status: 400 }
      );
    }
  };
}

// Extend NextRequest type to include our validated data
declare global {
  interface NextRequest {
    validatedData?: Record<string, any>;
    pageParams?: Record<string, string>;
  }
}

/**
 * Helper to get validated data with type safety
 */
export function getValidatedData<T = any>(req: NextRequest, key: 'body' | 'query' | 'params' = 'body'): T {
  if (!req.validatedData || !req.validatedData[key]) {
    throw new Error(`No validated ${key} data found`);
  }
  return req.validatedData[key];
}

/**
 * Helper to validate a single value against a schema
 */
export async function validateValue<T>(value: any, schema: ZodSchema<T>): Promise<T> {
  return schema.parseAsync(value);
}

/**
 * Middleware to validate request body against a schema
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return validateRequest({ body: schema });
}

/**
 * Middleware to validate query parameters against a schema
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return validateRequest({ query: schema });
}

/**
 * Middleware to validate URL parameters against a schema
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return validateRequest({ params: schema });
}
