import { checkAvailability, createReservaWithLock, generateIdempotencyKey } from '../reservaService'
import { CreateReserva } from '../schemas'

// Mock de MongoDB
jest.mock('../db/mongodb', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('../models/Reserva', () => ({
  Reserva: {
    findOne: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}))

describe('ReservaService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('checkAvailability', () => {
    it('should return true when no reservation exists', async () => {
      const { Reserva } = require('../models/Reserva')
      Reserva.findOne.mockResolvedValue(null)

      const result = await checkAvailability('2024-01-15', '17-19', 1)
      
      expect(result).toBe(true)
      expect(Reserva.findOne).toHaveBeenCalledWith({
        fecha: '2024-01-15',
        turno: '17-19',
        mesa: 1,
        estado: { $in: ['pendiente_pago', 'confirmada'] },
      })
    })

    it('should return false when reservation exists', async () => {
      const { Reserva } = require('../models/Reserva')
      Reserva.findOne.mockResolvedValue({ _id: '123', fecha: '2024-01-15' })

      const result = await checkAvailability('2024-01-15', '17-19', 1)
      
      expect(result).toBe(false)
    })
  })

  describe('generateIdempotencyKey', () => {
    it('should generate consistent key for same data', () => {
      const reservaData: CreateReserva = {
        fecha: '2024-01-15',
        turno: '17-19',
        mesa: 1,
        personas: 4,
        cliente: {
          nombre: 'Juan Pérez',
          email: 'juan@example.com',
          telefono: '+5491112345678',
        },
      }

      const key1 = generateIdempotencyKey(reservaData)
      const key2 = generateIdempotencyKey(reservaData)

      expect(key1).toBe(key2)
      expect(key1).toHaveLength(64) // SHA-256 hash length
    })

    it('should generate different keys for different data', () => {
      const reservaData1: CreateReserva = {
        fecha: '2024-01-15',
        turno: '17-19',
        mesa: 1,
        personas: 4,
        cliente: {
          nombre: 'Juan Pérez',
          email: 'juan@example.com',
          telefono: '+5491112345678',
        },
      }

      const reservaData2: CreateReserva = {
        ...reservaData1,
        mesa: 2,
      }

      const key1 = generateIdempotencyKey(reservaData1)
      const key2 = generateIdempotencyKey(reservaData2)

      expect(key1).not.toBe(key2)
    })
  })
}) 