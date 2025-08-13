import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// Create a JSDOM window for DOMPurify in Node.js environment
const window = new JSDOM('').window as unknown as Window;
const domPurify = DOMPurify(window);

/**
 * Sanitizes HTML content to prevent XSS attacks
 * @param content The HTML content to sanitize
 * @returns Sanitized HTML content
 */
export function sanitizeHtml(content: string): string {
  if (typeof window === 'undefined') {
    // Server-side rendering
    return domPurify.sanitize(content);
  }
  // Client-side rendering
  return DOMPurify.sanitize(content);
}

/**
 * Sanitizes a plain text string by escaping HTML special characters
 * @param text The text to sanitize
 * @returns Sanitized text with HTML special characters escaped
 */
export function escapeHtml(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitizes an object's string properties to prevent XSS
 * @param obj The object to sanitize
 * @returns A new object with sanitized string properties
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized: any = Array.isArray(obj) ? [] : {};
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      
      if (typeof value === 'string') {
        sanitized[key] = escapeHtml(value);
      } else if (value && typeof value === 'object') {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
  }
  
  return sanitized as T;
}

/**
 * Sanitizes form data from FormData object
 * @param formData The FormData to sanitize
 * @returns A new object with sanitized form data
 */
export function sanitizeFormData(formData: FormData): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') {
      result[key] = escapeHtml(value);
    } else {
      result[key] = value; // For File objects, etc.
    }
  }
  
  return result;
}

/**
 * Validates and sanitizes URL parameters
 * @param params URL parameters to validate
 * @param schema Zod schema for validation
 * @returns Sanitized and validated parameters
 */
export function validateAndSanitizeParams<T>(
  params: Record<string, any>,
  schema: any // Zod schema
): T {
  // First sanitize all string values
  const sanitized = Object.entries(params).reduce((acc, [key, value]) => {
    acc[key] = typeof value === 'string' ? escapeHtml(value) : value;
    return acc;
  }, {} as Record<string, any>);
  
  // Then validate against the schema
  const result = schema.safeParse(sanitized);
  
  if (!result.success) {
    throw new Error('Invalid parameters');
  }
  
  return result.data as T;
}

/**
 * Sanitizes and trims a string input
 * @param input The input string to sanitize
 * @returns Sanitized and trimmed string
 */
export function cleanInput(input: string): string {
  if (typeof input !== 'string') return '';
  return escapeHtml(input.trim());
}

/**
 * Sanitizes a URL to prevent XSS and open redirects
 * @param url The URL to sanitize
 * @param allowedDomains List of allowed domains (default: current domain)
 * @returns Sanitized URL or empty string if not allowed
 */
export function sanitizeUrl(
  url: string, 
  allowedDomains: string[] = [window.location.hostname]
): string {
  if (!url) return '';
  
  try {
    const parsedUrl = new URL(url, window.location.origin);
    
    // Check if the URL's domain is in the allowed list
    if (!allowedDomains.includes(parsedUrl.hostname)) {
      return '';
    }
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return '';
    }
    
    return parsedUrl.toString();
  } catch (e) {
    return '';
  }
}
