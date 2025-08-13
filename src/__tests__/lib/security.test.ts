import {
  verifyMercadoPagoSignature,
  sanitizeInput,
  isValidMercadoPagoId,
  validatePaymentData,
  escapeSql,
  generateCsrfToken,
  verifyCsrfToken
} from '@/lib/security';

describe('Security Utilities', () => {
  describe('verifyMercadoPagoSignature', () => {
    const testSecret = 'test_secret_key';
    const testPayload = 'test_payload';
    const testSignature = 'ts=1234567890,v1=6f0f4f0c4a5f5c5e5d5a5f5c5e5d5a5f5c5e5d5a5f5c5e5d5a5f5c5e5d5a5f5c5e5d5a';
    
    beforeEach(() => {
      // Reset environment variables
      process.env.MERCADOPAGO_WEBHOOK_SECRET = testSecret;
    });

    it('should return true for valid signature', () => {
      const result = verifyMercadoPagoSignature(testSignature, testPayload, testSecret);
      expect(result).toBe(true);
    });

    it('should return false for missing signature', () => {
      const result = verifyMercadoPagoSignature(null, testPayload, testSecret);
      expect(result).toBe(false);
    });

    it('should return false for invalid signature format', () => {
      const result = verifyMercadoPagoSignature('invalid_signature_format', testPayload, testSecret);
      expect(result).toBe(false);
    });

    it('should return false for missing secret', () => {
      delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
      const result = verifyMercadoPagoSignature(testSignature, testPayload);
      expect(result).toBe(false);
    });
  });

  describe('sanitizeInput', () => {
    it('should detect script tags', () => {
      expect(sanitizeInput('<script>alert(1)</script>')).toBe(false);
      expect(sanitizeInput('normal input')).toBe(true);
    });

    it('should detect javascript protocol', () => {
      expect(sanitizeInput('javascript:alert(1)')).toBe(false);
      expect(sanitizeInput('https://example.com')).toBe(true);
    });

    it('should detect event handlers', () => {
      expect(sanitizeInput('<div onclick="alert(1)">')).toBe(false);
      expect(sanitizeInput('<div>test</div>')).toBe(true);
    });

    it('should detect dangerous functions', () => {
      expect(sanitizeInput('eval("alert(1)")')).toBe(false);
      expect(sanitizeInput('document.cookie')).toBe(false);
      expect(sanitizeInput('window.location')).toBe(false);
    });
  });

  describe('isValidMercadoPagoId', () => {
    it('should validate MercadoPago IDs correctly', () => {
      expect(isValidMercadoPagoId('1234567890')).toBe(true);
      expect(isValidMercadoPagoId(1234567890)).toBe(true);
      expect(isValidMercadoPagoId('abc')).toBe(false);
      expect(isValidMercadoPagoId('-123')).toBe(false);
      expect(isValidMercadoPagoId('')).toBe(false);
      expect(isValidMercadoPagoId(null as any)).toBe(false);
    });
  });

  describe('validatePaymentData', () => {
    it('should validate payment data structure', () => {
      const validPayment = {
        id: '1234567890',
        external_reference: 'res_123',
        transaction_amount: 1000,
        status: 'approved'
      };

      const invalidPayment = {
        id: 'invalid',
        // missing external_reference
        transaction_amount: -100,
        status: 'invalid_status'
      };

      const validResult = validatePaymentData(validPayment);
      const invalidResult = validatePaymentData(invalidPayment);

      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);
      
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toContain('ID de pago no válido');
      expect(invalidResult.errors).toContain('No se proporcionó referencia externa (ID de reserva)');
      expect(invalidResult.errors).toContain('Monto de transacción no válido');
      expect(invalidResult.errors).toContain('Estado de pago no válido');
    });
  });

  describe('escapeSql', () => {
    it('should escape SQL special characters', () => {
      expect(escapeSql("O'Reilly")).toBe("O\\'Reilly");
      expect(escapeSql('"quoted"')).toBe('\\"quoted\\"');
      expect(escapeSql('line\nbreak')).toBe('line\\nbreak');
      expect(escapeSql('normal text')).toBe('normal text');
    });
  });

  describe('CSRF Token', () => {
    it('should generate and verify CSRF tokens', () => {
      const token = generateCsrfToken();
      expect(token).toHaveLength(64); // 32 bytes in hex
      
      const isValid = verifyCsrfToken(token, token);
      expect(isValid).toBe(true);
      
      const isValid2 = verifyCsrfToken(token, 'invalid_token');
      expect(isValid2).toBe(false);
    });
  });
});
