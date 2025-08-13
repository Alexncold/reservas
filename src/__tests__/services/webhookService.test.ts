import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { Reserva } from '@/models/Reserva';
import { WebhookService } from '@/services/webhookService';
import { queueUpdate } from '@/lib/sheetsSync';
import { logger } from '@/lib/logger';

// Mock the dependencies
jest.mock('@/lib/sheetsSync', () => ({
  queueUpdate: jest.fn().mockResolvedValue(true)
}));

// Mock the logger to prevent console output during tests
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock the security module
jest.mock('@/lib/security', () => ({
  verifyMercadoPagoSignature: jest.fn().mockReturnValue(true),
  validatePaymentData: jest.fn().mockReturnValue({ valid: true, errors: [] })
}));

// Mock MercadoPago
jest.mock('mercadopago', () => ({
  configure: jest.fn(),
  payment: {
    get: jest.fn()
  }
}));

const mercadopago = require('mercadopago');
const security = require('@/lib/security');

describe('WebhookService', () => {
  let mongoServer: MongoMemoryServer;
  let webhookService: WebhookService;

  beforeAll(async () => {
    // Create a new in-memory database before running any tests
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    
    webhookService = WebhookService.getInstance();
  });

  afterAll(async () => {
    // Clear all test data after all tests
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
    // Clear all mocks
    jest.clearAllMocks();
  });

  beforeEach(async () => {
    // Clear database before each test
    await Reserva.deleteMany({});
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  const createTestReservation = async (status = 'pending') => {
    const reserva = new Reserva({
      fecha: new Date(),
      turno: 'noche',
      personas: 4,
      nombre: 'Test User',
      telefono: '1234567890',
      email: 'test@example.com',
      estado: 'pendiente_pago',
      pago: {
        estado: 'pending',
        fecha_creacion: new Date(),
        monto: 1000,
        moneda: 'ARS',
        metodo: 'mercadopago',
        mercadopago: {
          preference_id: 'test_pref_id'
        }
      },
    });
    await reserva.save();
    return reserva;
  };

  const createMockRequest = (body: any, signature = 'test_signature') => ({
    method: 'POST',
    headers: {
      'x-signature': signature
    },
    body
  });

  const createMockResponse = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  describe('handlePaymentNotification', () => {
    it('should process a valid payment notification', async () => {
      const reserva = await createTestReservation();
      
      const paymentNotification = {
        action: 'payment.updated',
        api_version: 'v1',
        data: { id: '1234567890' },
        date_created: new Date().toISOString(),
        id: 1234567890,
        live_mode: true,
        type: 'payment',
        user_id: '123456789'
      };

      const paymentData = {
        id: 1234567890,
        status: 'approved',
        status_detail: 'accredited',
        external_reference: reserva._id.toString(),
        transaction_amount: 1000,
        payment_method_id: 'visa',
        payment_type_id: 'credit_card',
        installments: 1,
        transaction_details: {
          total_paid_amount: 1000
        }
      };

      // Mock the MercadoPago payment.get call
      mercadopago.payment.get.mockResolvedValue({ body: paymentData });

      const req = createMockRequest(paymentNotification);
      const res = createMockResponse();

      await webhookService.handlePaymentNotification(req as any, res as any);

      // Verify the response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'success',
        paymentId: '1234567890',
        reservaId: reserva._id.toString()
      }));

      // Verify the reservation was updated
      const updatedReserva = await Reserva.findById(reserva._id);
      expect(updatedReserva?.estado).toBe('confirmada');
      expect(updatedReserva?.pago.estado).toBe('aprobado');
      
      // Verify queueUpdate was called
      expect(queueUpdate).toHaveBeenCalledWith(expect.objectContaining({
        _id: reserva._id,
        estado: 'confirmada',
        pago: expect.objectContaining({
          estado: 'aprobado'
        })
      }));
    });

    it('should return 401 for invalid signature', async () => {
      // Mock the signature verification to fail
      security.verifyMercadoPagoSignature.mockReturnValueOnce(false);

      const req = createMockRequest({ type: 'payment' }, 'invalid_signature');
      const res = createMockResponse();

      await webhookService.handlePaymentNotification(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
    });

    it('should ignore non-payment notifications', async () => {
      const req = createMockRequest({ type: 'subscription' });
      const res = createMockResponse();

      await webhookService.handlePaymentNotification(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ 
        status: 'ignored', 
        reason: 'Not a payment notification' 
      });
    });

    it('should handle payment not found', async () => {
      // Mock the MercadoPago payment.get to return null
      mercadopago.payment.get.mockResolvedValueOnce(null);

      const req = createMockRequest({
        type: 'payment',
        data: { id: '999999999' }
      });
      const res = createMockResponse();

      await webhookService.handlePaymentNotification(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Payment not found' });
    });

    it('should handle invalid payment data', async () => {
      // Mock the payment data validation to fail
      security.validatePaymentData.mockReturnValueOnce({
        valid: false,
        errors: ['Invalid payment data']
      });

      const req = createMockRequest({
        type: 'payment',
        data: { id: '1234567890' }
      });
      const res = createMockResponse();

      // Mock the MercadoPago payment.get call
      mercadopago.payment.get.mockResolvedValueOnce({
        body: { id: '1234567890' } // Missing required fields
      });

      await webhookService.handlePaymentNotification(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Error processing payment' 
      });
    });

    it('should handle database errors', async () => {
      // Force a database error
      jest.spyOn(Reserva, 'findById').mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const req = createMockRequest({
        type: 'payment',
        data: { id: '1234567890' }
      });
      const res = createMockResponse();

      // Mock the MercadoPago payment.get call
      mercadopago.payment.get.mockResolvedValueOnce({
        body: {
          id: '1234567890',
          status: 'approved',
          external_reference: '507f1f77bcf86cd799439011', // Valid ObjectId
          transaction_amount: 1000
        }
      });

      await webhookService.handlePaymentNotification(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        details: 'Database error'
      });
    });
  });
});
