import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { Reserva } from '@/models/Reserva';
import { paymentExpiryService } from '@/services/paymentExpiryService';
import { queueUpdate } from '@/lib/sheetsSync';

// Mock the queueUpdate function
jest.mock('@/lib/sheetsSync', () => ({
  queueUpdate: jest.fn().mockResolvedValue(true)
}));

describe('PaymentExpiryService', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    // Create a new in-memory database before running any tests
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
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

  describe('checkExpiredPayments', () => {
    it('should mark expired payments as expired', async () => {
      // Create a reservation with a payment that expired 1 hour ago
      const expiredReservation = new Reserva({
        fecha: new Date(),
        turno: 'noche',
        personas: 4,
        nombre: 'Test User',
        telefono: '1234567890',
        email: 'test@example.com',
        estado: 'pendiente_pago',
        pago: {
          estado: 'pendiente',
          fecha_creacion: new Date(Date.now() - 16 * 60 * 1000), // 16 minutes ago
          monto: 1000,
          moneda: 'ARS',
          metodo: 'mercadopago',
        },
      });
      await expiredReservation.save();

      // Run the check
      await paymentExpiryService.checkExpiredPayments();

      // Check that the reservation was updated
      const updatedReservation = await Reserva.findById(expiredReservation._id);
      expect(updatedReservation?.estado).toBe('cancelada');
      expect(updatedReservation?.pago.estado).toBe('expirado');
      
      // Check that queueUpdate was called
      expect(queueUpdate).toHaveBeenCalledWith(expect.objectContaining({
        _id: expiredReservation._id,
        estado: 'cancelada',
        pago: expect.objectContaining({
          estado: 'expirado'
        })
      }));
    });

    it('should not update non-expired payments', async () => {
      // Create a reservation with a payment that's still valid
      const validReservation = new Reserva({
        fecha: new Date(),
        turno: 'noche',
        personas: 4,
        nombre: 'Test User',
        telefono: '1234567890',
        email: 'test@example.com',
        estado: 'pendiente_pago',
        pago: {
          estado: 'pendiente',
          fecha_creacion: new Date(), // Just created
          monto: 1000,
          moneda: 'ARS',
          metodo: 'mercadopago',
        },
      });
      await validReservation.save();

      // Run the check
      await paymentExpiryService.checkExpiredPayments();

      // Check that the reservation was not updated
      const updatedReservation = await Reserva.findById(validReservation._id);
      expect(updatedReservation?.estado).toBe('pendiente_pago');
      expect(updatedReservation?.pago.estado).toBe('pendiente');
      
      // Check that queueUpdate was not called
      expect(queueUpdate).not.toHaveBeenCalled();
    });
  });

  describe('isPaymentExpired', () => {
    it('should return true for expired payments', async () => {
      const expiredReservation = new Reserva({
        fecha: new Date(),
        turno: 'noche',
        personas: 4,
        nombre: 'Test User',
        telefono: '1234567890',
        email: 'test@example.com',
        estado: 'pendiente_pago',
        pago: {
          estado: 'pendiente',
          fecha_creacion: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
          monto: 1000,
          moneda: 'ARS',
          metodo: 'mercadopago',
        },
      });
      await expiredReservation.save();

      const isExpired = await paymentExpiryService.isPaymentExpired(expiredReservation._id.toString());
      expect(isExpired).toBe(true);
    });

    it('should return false for non-expired payments', async () => {
      const validReservation = new Reserva({
        fecha: new Date(),
        turno: 'noche',
        personas: 4,
        nombre: 'Test User',
        telefono: '1234567890',
        email: 'test@example.com',
        estado: 'pendiente_pago',
        pago: {
          estado: 'pendiente',
          fecha_creacion: new Date(), // Just created
          monto: 1000,
          moneda: 'ARS',
          metodo: 'mercadopago',
        },
      });
      await validReservation.save();

      const isExpired = await paymentExpiryService.isPaymentExpired(validReservation._id.toString());
      expect(isExpired).toBe(false);
    });
  });

  describe('getRemainingTime', () => {
    it('should return correct remaining time', async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const reservation = new Reserva({
        fecha: new Date(),
        turno: 'noche',
        personas: 4,
        nombre: 'Test User',
        telefono: '1234567890',
        email: 'test@example.com',
        estado: 'pendiente_pago',
        pago: {
          estado: 'pendiente',
          fecha_creacion: fiveMinutesAgo,
          monto: 1000,
          moneda: 'ARS',
          metodo: 'mercadopago',
        },
      });
      await reservation.save();

      const remainingTime = await paymentExpiryService.getRemainingTime(reservation._id.toString());
      // Should be around 10 minutes (15 - 5) remaining, but allow for some test execution time
      expect(remainingTime).toBeLessThanOrEqual(10 * 60);
      expect(remainingTime).toBeGreaterThan(9 * 60); // At least 9 minutes remaining
    });
  });

  describe('renewPaymentExpiry', () => {
    it('should renew the payment expiry time', async () => {
      const oldDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      const reservation = new Reserva({
        fecha: new Date(),
        turno: 'noche',
        personas: 4,
        nombre: 'Test User',
        telefono: '1234567890',
        email: 'test@example.com',
        estado: 'pendiente_pago',
        pago: {
          estado: 'pendiente',
          fecha_creacion: oldDate,
          monto: 1000,
          moneda: 'ARS',
          metodo: 'mercadopago',
        },
      });
      await reservation.save();

      const result = await paymentExpiryService.renewPaymentExpiry(reservation._id.toString());
      expect(result).toBe(true);

      const updatedReservation = await Reserva.findById(reservation._id);
      expect(updatedReservation?.pago.fecha_creacion.getTime()).toBeGreaterThan(oldDate.getTime());
    });

    it('should return false for non-existent reservation', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const result = await paymentExpiryService.renewPaymentExpiry(nonExistentId.toString());
      expect(result).toBe(false);
    });
  });
});
