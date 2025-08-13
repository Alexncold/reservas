import crypto from 'crypto';
import { logger } from './logger';

/**
 * Verifica la firma de una notificación de webhook de MercadoPago
 * @param signature Firma recibida en el header 'x-signature'
 * @param payload Cuerpo de la solicitud (como string)
 * @param secret Clave secreta del webhook de MercadoPago
 * @returns boolean - true si la firma es válida, false en caso contrario
 */
export function verifyMercadoPagoSignature(
  signature: string | null,
  payload: string,
  secret: string = process.env.MERCADOPAGO_WEBHOOK_SECRET || ''
): boolean {
  if (!signature) {
    logger.warn('No se proporcionó firma en la solicitud del webhook');
    return false;
  }

  if (!secret) {
    logger.error('No se configuró MERCADOPAGO_WEBHOOK_SECRET');
    return false;
  }

  try {
    // La firma viene en formato: "ts=1234567890,v1=abcdef123456..."
    // Necesitamos extraer la parte v1
    const signatureParts = signature.split(',').reduce((acc, part) => {
      const [key, value] = part.split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    const signatureValue = signatureParts['v1'];
    if (!signatureValue) {
      logger.warn('Formato de firma inválido', { signature });
      return false;
    }

    // Crear el hash HMAC-SHA256
    const hash = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // Comparar los hashes
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signatureValue, 'hex'),
      Buffer.from(hash, 'hex')
    );

    if (!isValid) {
      logger.warn('Firma HMAC no válida', { 
        received: signatureValue,
        expected: hash 
      });
    }

    return isValid;
  } catch (error) {
    logger.error('Error al verificar la firma del webhook', { error });
    return false;
  }
}

/**
 * Valida los datos de entrada para evitar inyección de código
 * @param input Cadena de texto a validar
 * @returns boolean - true si es seguro, false si contiene caracteres potencialmente peligrosos
 */
export function sanitizeInput(input: string): boolean {
  // Lista de patrones potencialmente peligrosos
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Etiquetas script
    /javascript:/gi, // Protocolo javascript:
    /on\w+\s*=/gi, // Atributos de evento (onclick, onload, etc.)
    /\b(eval\(|document\.|window\.|alert\(|confirm\(|prompt\(|document\.cookie)/gi, // Funciones peligrosas
    /[<>"']/ // Caracteres especiales HTML
  ];

  return !dangerousPatterns.some(pattern => pattern.test(input));
}

/**
 * Valida un ID de MercadoPago
 * @param id ID a validar
 * @returns boolean - true si es un ID válido, false en caso contrario
 */
export function isValidMercadoPagoId(id: string | number): boolean {
  if (!id) return false;
  
  // Convertir a número si es posible
  const numId = typeof id === 'string' ? parseInt(id, 10) : id;
  
  // Verificar que sea un número positivo
  if (isNaN(numId) || numId <= 0) {
    return false;
  }
  
  // Verificar que no sea demasiado grande (ajustar según sea necesario)
  if (numId > Number.MAX_SAFE_INTEGER) {
    return false;
  }
  
  return true;
}

/**
 * Valida los datos de un pago antes de procesarlos
 * @param paymentData Datos del pago a validar
 * @returns { valid: boolean, errors: string[] } - Resultado de la validación
 */
export function validatePaymentData(paymentData: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!paymentData) {
    return { valid: false, errors: ['Datos de pago no proporcionados'] };
  }
  
  // Validar ID de pago
  if (!isValidMercadoPagoId(paymentData.id)) {
    errors.push('ID de pago no válido');
  }
  
  // Validar referencia externa (ID de reserva)
  if (!paymentData.external_reference) {
    errors.push('No se proporcionó referencia externa (ID de reserva)');
  } else if (typeof paymentData.external_reference !== 'string') {
    errors.push('Formato de referencia externa no válido');
  }
  
  // Validar monto
  if (typeof paymentData.transaction_amount !== 'number' || paymentData.transaction_amount <= 0) {
    errors.push('Monto de transacción no válido');
  }
  
  // Validar estado
  const validStatuses = ['pending', 'approved', 'authorized', 'in_process', 'in_mediation', 'rejected', 'cancelled', 'refunded', 'charged_back'];
  if (!validStatuses.includes(paymentData.status)) {
    errors.push('Estado de pago no válido');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Escapa caracteres especiales para prevenir inyección SQL
 * Nota: Se recomienda usar consultas parametrizadas en lugar de esto
 */
export function escapeSql(value: string): string {
  if (typeof value !== 'string') return value;
  
  return value
    .replace(/[\0\n\r\b\t\x1a"\']/g, char => ({
      '\0': '\\0',
      '\n': '\\n',
      '\r': '\\r',
      '\b': '\\b',
      '\t': '\\t',
      '\x1a': '\\Z',
      '"': '\\"',
      "'": "\\'",
    }[char] || ''));
}

/**
 * Genera un token CSRF
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verifica un token CSRF
 */
export function verifyCsrfToken(token: string, storedToken: string): boolean {
  if (!token || !storedToken) return false;
  return crypto.timingSafeEqual(
    Buffer.from(token, 'hex'),
    Buffer.from(storedToken, 'hex')
  );
}
