import mongoose, { Schema, Document } from 'mongoose'
import { Cliente } from '@/lib/schemas'

export interface IReserva extends Document {
  fecha: string // YYYY-MM-DD
  turno: '17-19' | '19-21' | '21-23'
  mesa: number // 1, 2, 3
  personas: number // 1-6
  juego?: string
  cliente: Cliente
  estado: 'pendiente_pago' | 'confirmada' | 'cancelada'
  pago?: {
    mercadopago_id: string
    monto: number
    estado: string
    fecha_pago: Date
  }
  idempotencyKey?: string // Para evitar duplicados en webhooks
  created_at: Date
  updated_at: Date
}

const ReservaSchema = new Schema<IReserva>({
  fecha: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/,
  },
  turno: {
    type: String,
    required: true,
    enum: ['17-19', '19-21', '21-23'],
  },
  mesa: {
    type: Number,
    required: true,
    min: 1,
    max: 3,
  },
  personas: {
    type: Number,
    required: true,
    min: 1,
    max: 6,
  },
  juego: {
    type: String,
    required: false,
  },
  cliente: {
    nombre: {
      type: String,
      required: true,
      minlength: 2,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    telefono: {
      type: String,
      required: true,
      match: /^\+54\d{9,10}$/,
    },
  },
  estado: {
    type: String,
    required: true,
    enum: ['pendiente_pago', 'confirmada', 'cancelada'],
    default: 'pendiente_pago',
  },
  pago: {
    mercadopago_id: String,
    monto: Number,
    estado: String,
    fecha_pago: Date,
  },
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true,
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})

// Índices para optimizar consultas
ReservaSchema.index({ fecha: 1, turno: 1, mesa: 1 })
ReservaSchema.index({ estado: 1 })
ReservaSchema.index({ 'cliente.email': 1 })
ReservaSchema.index({ idempotencyKey: 1 })

export const Reserva = mongoose.models.Reserva || mongoose.model<IReserva>('Reserva', ReservaSchema) 