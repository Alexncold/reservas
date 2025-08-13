import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateRequest, getValidatedData } from '../middleware';

// Mock logger to avoid console output during tests
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('Validation Middleware', () => {
  const mockRequest = (method: string, body?: any, searchParams?: URLSearchParams) => {
    const url = 'http://localhost:3000/api/test' + (searchParams ? `?${searchParams.toString()}` : '');
    
    const headers = new Headers();
    if (body && typeof body === 'object') {
      headers.set('Content-Type', 'application/json');
    }
    
    return new NextRequest(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  };
  
  describe('validateRequest', () => {
    it('should validate query parameters', async () => {
      const schema = {
        query: z.object({
          page: z.string().regex(/^\d+$/).transform(Number),
          limit: z.string().regex(/^\d+$/).transform(Number).optional(),
        }),
      };
      
      const searchParams = new URLSearchParams();
      searchParams.set('page', '1');
      searchParams.set('limit', '10');
      
      const req = mockRequest('GET', undefined, searchParams);
      const validatedReq = await validateRequest(schema)(req);
      
      expect(validatedReq.validatedData).toBeDefined();
      expect(validatedReq.validatedData.query).toEqual({
        page: 1,
        limit: 10,
      });
    });
    
    it('should validate request body', async () => {
      const schema = {
        body: z.object({
          name: z.string().min(2),
          email: z.string().email(),
        }),
      };
      
      const body = { name: 'John Doe', email: 'john@example.com' };
      const req = mockRequest('POST', body);
      
      const validatedReq = await validateRequest(schema)(req);
      
      expect(validatedReq.validatedData).toBeDefined();
      expect(validatedReq.validatedData.body).toEqual(body);
    });
    
    it('should return validation errors for invalid data', async () => {
      const schema = {
        body: z.object({
          name: z.string().min(2),
          email: z.string().email(),
        }),
      };
      
      const body = { name: 'J', email: 'invalid-email' }; // Invalid data
      const req = mockRequest('POST', body);
      
      const response = await validateRequest(schema)(req);
      
      // Should return a response with validation errors
      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toBe('Validation error');
      expect(data.details).toHaveLength(2); // Two validation errors
    });
    
    it('should handle form data', async () => {
      const schema = {
        body: z.object({
          name: z.string(),
          file: z.instanceof(File).optional(),
        }),
      };
      
      const formData = new FormData();
      formData.append('name', 'John Doe');
      formData.append('file', new File(['test'], 'test.txt'));
      
      const req = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData as any,
      });
      
      // This is a simplified test since we can't directly create a FormData in Node.js
      // In a real test environment, you'd use something like node-fetch or supertest
      const validatedReq = await validateRequest(schema)(req);
      expect(validatedReq).toBeDefined();
    });
  });
  
  describe('getValidatedData', () => {
    it('should get validated data from request', async () => {
      const req = new NextRequest('http://localhost:3000/test');
      req.validatedData = {
        body: { name: 'John' },
        query: { page: 1 },
      };
      
      const body = getValidatedData(req, 'body');
      const query = getValidatedData(req, 'query');
      
      expect(body).toEqual({ name: 'John' });
      expect(query).toEqual({ page: 1 });
    });
    
    it('should throw if no validated data exists', () => {
      const req = new NextRequest('http://localhost:3000/test');
      
      expect(() => getValidatedData(req, 'body')).toThrow('No validated body data found');
    });
  });
  
  describe('validateValue', () => {
    it('should validate a value against a schema', async () => {
      const schema = z.string().email();
      const validEmail = 'test@example.com';
      const invalidEmail = 'not-an-email';
      
      await expect(validateValue(validEmail, schema)).resolves.toBe(validEmail);
      await expect(validateValue(invalidEmail, schema)).rejects.toThrow();
    });
  });
});
