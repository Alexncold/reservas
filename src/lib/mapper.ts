import { z } from 'zod';
import { Reserva } from '@/models/Reserva';

// Define the schema for our DTO
export const ReservaDTOSchema = z.object({
  _id: z.string(),
  fecha: z.date(),
  turno: z.string(),
  mesa: z.number(),
  clientes: z.object({
    nombre: z.string(),
    telefono: z.string(),
    email: z.string().email().nullable(),
  }),
  personas: z.number(),
  juego: z.string().nullable(),
  estado: z.enum(['pendiente', 'confirmada', 'cancelada']),
  pagoId: z.string().nullable(),
  montoArs: z.number().nullable(),
  updatedAt: z.date(),
  notas: z.string().nullable(),
});

export type ReservaDTO = z.infer<typeof ReservaDTOSchema>;

/**
 * Converts a database Reserva document to a DTO for Google Sheets
 */
export function toReservaDTO(reserva: any): ReservaDTO {
  // Ensure we have a plain object, not a Mongoose document
  const plainReserva = reserva.toObject ? reserva.toObject() : reserva;
  
  return {
    _id: String(plainReserva._id),
    fecha: new Date(plainReserva.fecha),
    turno: plainReserva.turno,
    mesa: Number(plainReserva.mesa),
    clientes: {
      nombre: plainReserva.clientes?.nombre?.trim() || '',
      telefono: plainReserva.clientes?.telefono?.trim() || '',
      email: plainReserva.clientes?.email?.trim() || null,
    },
    personas: Number(plainReserva.personas || 0),
    juego: plainReserva.juego?.trim() || null,
    estado: plainReserva.estado || 'pendiente',
    pagoId: plainReserva.pago?.mercadopago_id?.trim() || null,
    montoArs: plainReserva.pago?.monto ? Number(plainReserva.pago.monto) : null,
    updatedAt: new Date(plainReserva.updatedAt || plainReserva.createdAt || new Date()),
    notas: plainReserva.notas?.trim() || null,
  };
}

/**
 * Validates a plain object against the ReservaDTO schema
 */
export function validateReservaDTO(data: unknown): ReservaDTO {
  return ReservaDTOSchema.parse(data);
}
