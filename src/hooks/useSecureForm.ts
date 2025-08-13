import { useState, useCallback, FormEvent } from 'react';
import { sanitizeObject, sanitizeFormData, validateAndSanitizeParams } from '@/lib/security/sanitize';
import { logger } from '@/lib/logger';

type FormValues = Record<string, any>;
type ValidationSchema = any; // Zod schema type
type SubmitHandler<T> = (values: T) => Promise<void> | void;

interface UseSecureFormOptions<T> {
  initialValues: T;
  validationSchema?: ValidationSchema;
  onSubmit: SubmitHandler<T>;
  onError?: (error: Error) => void;
}

/**
 * A secure form handling hook that includes:
 * - Input sanitization
 * - Validation
 * - CSRF protection
 * - Error handling
 */
export function useSecureForm<T extends FormValues>({
  initialValues,
  validationSchema,
  onSubmit,
  onError,
}: UseSecureFormOptions<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  // Get CSRF token when the component mounts
  useEffect(() => {
    const token = document.cookie
      .split('; ')
      .find(row => row.startsWith('XSRF-TOKEN='))
      ?.split('=')[1];
    
    if (token) {
      setCsrfToken(decodeURIComponent(token));
    } else {
      // If no CSRF token is found, try to get one by making a request to the API
      fetch('/api/csrf', { credentials: 'same-origin' })
        .then(res => {
          const token = res.headers.get('X-CSRF-Token');
          if (token) {
            setCsrfToken(token);
          }
        })
        .catch(err => {
          logger.warn('Failed to get CSRF token', { error: err });
        });
    }
  }, []);

  // Handle input change with sanitization
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    // Sanitize based on input type
    let sanitizedValue: any = value;
    
    if (type === 'email' || type === 'text' || type === 'textarea' || type === 'search') {
      // Basic HTML escaping for text inputs
      sanitizedValue = value.replace(/[&<>"']/g, (match) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
      }[match] || match));
    }
    
    setValues(prev => ({
      ...prev,
      [name]: sanitizedValue,
    }));
    
    // Clear error when user types
    if (errors[name as keyof T]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined,
      }));
    }
  }, [errors]);

  // Handle form submission with validation and sanitization
  const handleSubmit = useCallback(async (e?: FormEvent) => {
    e?.preventDefault();
    
    try {
      setIsSubmitting(true);
      
      // Validate inputs if schema is provided
      if (validationSchema) {
        try {
          await validationSchema.parseAsync(values);
          setErrors({});
        } catch (err) {
          // Format validation errors
          const formattedErrors = err.issues.reduce((acc: any, issue: any) => {
            const path = issue.path[0];
            acc[path] = issue.message;
            return acc;
          }, {});
          
          setErrors(formattedErrors);
          throw new Error('Validation failed');
        }
      }
      
      // Sanitize all values before submission
      const sanitizedValues = sanitizeObject(values);
      
      // Call the submit handler with sanitized values
      await onSubmit(sanitizedValues);
      
    } catch (error) {
      logger.error('Form submission failed', { error });
      
      if (onError) {
        onError(error);
      } else {
        // Default error handling
        setErrors(prev => ({
          ...prev,
          _form: error.message || 'An error occurred while submitting the form',
        }));
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validationSchema, onSubmit, onError]);

  // Handle form data from FormData (useful for file uploads)
  const handleFormData = useCallback(async (formData: FormData) => {
    try {
      setIsSubmitting(true);
      
      // Sanitize form data
      const sanitizedData = sanitizeFormData(formData);
      
      // Validate if schema is provided
      if (validationSchema) {
        const result = validationSchema.safeParse(sanitizedData);
        if (!result.success) {
          const formattedErrors = result.error.issues.reduce((acc: any, issue: any) => {
            const path = issue.path[0];
            acc[path] = issue.message;
            return acc;
          }, {});
          
          setErrors(formattedErrors);
          throw new Error('Validation failed');
        }
      }
      
      // Add CSRF token to form data if available
      if (csrfToken) {
        formData.append('_csrf', csrfToken);
      }
      
      // Call the submit handler with form data
      await onSubmit(sanitizedData as T);
      
    } catch (error) {
      logger.error('Form submission failed', { error });
      
      if (onError) {
        onError(error);
      } else {
        setErrors(prev => ({
          ...prev,
          _form: error.message || 'An error occurred while submitting the form',
        }));
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [validationSchema, onSubmit, onError, csrfToken]);

  // Reset form to initial values
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
  }, [initialValues]);

  // Set a form field value programmatically
  const setFieldValue = useCallback((name: string, value: any) => {
    setValues(prev => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  // Set an error for a specific field
  const setFieldError = useCallback((name: string, message: string) => {
    setErrors(prev => ({
      ...prev,
      [name]: message,
    }));
  }, []);

  return {
    values,
    errors,
    isSubmitting,
    handleChange,
    handleSubmit,
    handleFormData,
    resetForm,
    setFieldValue,
    setFieldError,
    setValues,
    csrfToken,
  };
}

/**
 * A higher-order component that provides form context
 */
export function withSecureForm<T extends FormValues>(
  Component: React.ComponentType<SecureFormProps<T> & any>,
  options: Omit<UseSecureFormOptions<T>, 'onSubmit'>
) {
  return function WrappedComponent(props: any) {
    const form = useSecureForm({
      ...options,
      onSubmit: (values: T) => {
        // This will be overridden by the component's onSubmit
        return Promise.resolve();
      },
    });
    
    return <Component {...props} form={form} />;
  };
}

// Types
type SecureFormProps<T> = {
  form: ReturnType<typeof useSecureForm<T>>;
  onSubmit?: SubmitHandler<T>;
};

export type { FormValues, SubmitHandler };
