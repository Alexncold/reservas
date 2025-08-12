import { createReservaSchema, clienteSchema } from '../schemas'

describe('Schemas Validation', () => {
  describe('clienteSchema', () => {
    it('should validate correct cliente data', () => {
      const validCliente = {
        nombre: 'Juan Pérez',
        email: 'juan@example.com',
        telefono: '+5491112345678',
      }

      const result = clienteSchema.safeParse(validCliente)
      expect(result.success).toBe(true)
    })

    it('should reject invalid email', () => {
      const invalidCliente = {
        nombre: 'Juan Pérez',
        email: 'invalid-email',
        telefono: '+5491112345678',
      }

      const result = clienteSchema.safeParse(invalidCliente)
      expect(result.success).toBe(false)
    })

    it('should reject invalid phone number', () => {
      const invalidCliente = {
        nombre: 'Juan Pérez',
        email: 'juan@example.com',
        telefono: '123456789',
      }

      const result = clienteSchema.safeParse(invalidCliente)
      expect(result.success).toBe(false)
    })
  })

  describe('createReservaSchema', () => {
    it('should validate correct reserva data', () => {
      const validReserva = {
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

      const result = createReservaSchema.safeParse(validReserva)
      expect(result.success).toBe(true)
    })

    it('should reject invalid date format', () => {
      const invalidReserva = {
        fecha: '15/01/2024',
        turno: '17-19',
        mesa: 1,
        personas: 4,
        cliente: {
          nombre: 'Juan Pérez',
          email: 'juan@example.com',
          telefono: '+5491112345678',
        },
      }

      const result = createReservaSchema.safeParse(invalidReserva)
      expect(result.success).toBe(false)
    })
  })
}) 