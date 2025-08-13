import { tableLocksManager } from '../lib/tableLocks'
import { IReserva } from '../models/Reserva'

// Mock logger to avoid console output during tests
jest.mock('../lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}))

describe('TableLocksManager', () => {
  // Sample test data
  const testReserva: IReserva = {
    _id: 'test-reserva-1',
    fecha: '2025-12-31',
    turno: '19-21',
    mesa: 1,
    personas: 4,
    cliente: {
      nombre: 'Test User',
      email: 'test@example.com',
      telefono: '1234567890',
    },
    estado: 'pendiente_pago',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  // Reset locks before each test
  beforeEach(() => {
    // Clear all locks
    tableLocksManager.cleanup()
    // Reset mocks
    jest.clearAllMocks()
  })

  afterAll(() => {
    // Clean up after all tests
    tableLocksManager.cleanup()
  })

  describe('acquireLock', () => {
    it('should acquire a lock for a table', () => {
      const result = tableLocksManager.acquireLock(testReserva)
      expect(result).toBe(true)
    })

    it('should not acquire a lock if table is already locked', () => {
      // First lock should succeed
      expect(tableLocksManager.acquireLock(testReserva)).toBe(true)
      
      // Second lock for same table should fail
      const anotherReserva = { ...testReserva, _id: 'test-reserva-2' }
      expect(tableLocksManager.acquireLock(anotherReserva)).toBe(false)
    })

    it('should throw error for invalid reserva data', () => {
      const invalidReserva = { ...testReserva, mesa: undefined }
      expect(() => tableLocksManager.acquireLock(invalidReserva as any)).toThrow(
        'Reserva inválida: faltan campos requeridos'
      )
    })
  })

  describe('releaseLock', () => {
    it('should release an acquired lock', () => {
      // Acquire lock first
      tableLocksManager.acquireLock(testReserva)
      
      // Release should succeed
      const result = tableLocksManager.releaseLock(testReserva)
      expect(result).toBe(true)
      
      // Should be able to acquire lock again
      expect(tableLocksManager.acquireLock(testReserva)).toBe(true)
    })

    it('should return false when releasing non-existent lock', () => {
      const result = tableLocksManager.releaseLock(testReserva)
      expect(result).toBe(false)
    })
  })

  describe('isTableLocked', () => {
    it('should return true if table is locked', () => {
      tableLocksManager.acquireLock(testReserva)
      expect(
        tableLocksManager.isTableLocked(
          testReserva.mesa.toString(),
          testReserva.fecha,
          testReserva.turno
        )
      ).toBe(true)
    })

    it('should return false if table is not locked', () => {
      expect(
        tableLocksManager.isTableLocked(
          testReserva.mesa.toString(),
          testReserva.fecha,
          testReserva.turno
        )
      ).toBe(false)
    })
  })

  describe('cleanupExpiredLocks', () => {
    it('should remove expired locks', () => {
      // Mock Date to control time
      const realDate = Date
      const mockDate = new Date('2025-01-01T12:00:00Z')
      global.Date = class extends realDate {
        constructor() {
          super()
          return mockDate
        }
      } as any

      // Create a lock that will be expired
      const expiredReserva = { ...testReserva, _id: 'expired-reserva' }
      tableLocksManager.acquireLock(expiredReserva)

      // Move time forward to expire the lock
      mockDate.setTime(mockDate.getTime() + 16 * 60 * 1000) // 16 minutes later

      // Get active locks should clean up expired ones
      const activeLocks = tableLocksManager.getActiveLocks()
      expect(activeLocks.length).toBe(0)

      // Restore original Date
      global.Date = realDate
    })
  })

  describe('getActiveLocks', () => {
    it('should return only active (non-expired) locks', () => {
      // Add some test locks
      const reserva1 = { ...testReserva, _id: 'reserva-1' }
      const reserva2 = { ...testReserva, _id: 'reserva-2', mesa: 2 }
      
      tableLocksManager.acquireLock(reserva1)
      tableLocksManager.acquireLock(reserva2)
      
      const activeLocks = tableLocksManager.getActiveLocks()
      expect(activeLocks.length).toBe(2)
      
      // Should include both locks
      const mesaIds = activeLocks.map(lock => lock.mesaId)
      expect(mesaIds).toContain('1')
      expect(mesaIds).toContain('2')
    })
  })
})
