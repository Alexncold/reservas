import { z } from 'zod'

// Esquema para datos del cliente
export const clienteSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(50),
  email: z.string().email('Email inválido'),
  telefono: z.string().regex(/^\+54\d{9,10}$/, 'Teléfono debe estar en formato E.164 (+54XXXXXXXXX)'),
})

// Esquema para crear una reserva
export const createReservaSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe estar en formato YYYY-MM-DD'),
  turno: z.enum(['17-19', '19-21', '21-23']),
  mesa: z.number().min(1).max(3),
  personas: z.number().min(1).max(6),
  juego: z.string().optional(),
  cliente: clienteSchema,
})

// Esquema para actualizar estado de reserva
export const updateReservaSchema = z.object({
  estado: z.enum(['pendiente_pago', 'confirmada', 'cancelada']).optional(),
  pago: z.object({
    mercadopago_id: z.string(),
    monto: z.number(),
    estado: z.string(),
    fecha_pago: z.date(),
  }).optional(),
})

// Esquema para webhook de MercadoPago
export const mercadopagoWebhookSchema = z.object({
  data: z.object({
    id: z.string(),
    type: z.string(),
  }),
  type: z.string(),
})

// Esquema para respuesta de API
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
})

// Tipos derivados de los esquemas
export type Cliente = z.infer<typeof clienteSchema>
export type CreateReserva = z.infer<typeof createReservaSchema>
export type UpdateReserva = z.infer<typeof updateReservaSchema>
export type MercadoPagoWebhook = z.infer<typeof mercadopagoWebhookSchema>
export type ApiResponse = z.infer<typeof apiResponseSchema> 