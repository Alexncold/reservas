import { z } from 'zod';

// Common reusable schemas
const phoneRegex = /^\+?[1-9]\d{1,14}$/; // E.164 format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const timeSlotRegex = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/;

export const common = {
  // Date in YYYY-MM-DD format
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  
  // Time slot in HH:MM-HH:MM format
  timeSlot: z.string().regex(timeSlotRegex, 'Formato de horario inválido (HH:MM-HH:MM)'),
  
  // Phone number in E.164 format
  phone: z.string().regex(phoneRegex, 'Número de teléfono inválido'),
  
  // Email
  email: z.string().email('Email inválido'),
  
  // Name (2-50 chars, letters and basic punctuation)
  name: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(50, 'El nombre no puede tener más de 50 caracteres')
    .regex(/^[\p{L}\s'-]+$/u, 'Nombre inválido'),
  
  // Table number (positive integer)
  tableNumber: z.number().int().positive('Número de mesa inválido'),
  
  // Number of people (1-10)
  peopleCount: z.number().int().min(1, 'Mínimo 1 persona').max(10, 'Máximo 10 personas'),
};

// API Schemas
export const availabilitySchema = z.object({
  fecha: common.date,
  turno: common.timeSlot,
});

export const createReservationSchema = z.object({
  cliente: z.object({
    nombre: common.name,
    telefono: common.phone,
    email: common.email.optional(),
  }),
  fecha: common.date,
  turno: common.timeSlot,
  mesa: z.object({
    numero: common.tableNumber,
    capacidad: z.number().int().positive(),
  }),
  cantidadPersonas: common.peopleCount,
  juego: z.string().optional(),
  notas: z.string().max(500, 'Las notas no pueden tener más de 500 caracteres').optional(),
});

export const updateReservationSchema = createReservationSchema.partial().extend({
  estado: z.enum(['pendiente', 'confirmada', 'cancelada', 'completada', 'no_show']).optional(),
  motivoCancelacion: z.string().max(500).optional(),
});

export const paymentNotificationSchema = z.object({
  action: z.string(),
  api_version: z.string(),
  data: z.object({
    id: z.string(),
  }),
  date_created: z.string(),
  id: z.number(),
  live_mode: z.boolean(),
  type: z.string(),
  user_id: z.string(),
});

// Admin schemas
export const adminLoginSchema = z.object({
  email: common.email,
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

export const adminUpdateSchema = z.object({
  nombre: common.name.optional(),
  email: common.email.optional(),
  rol: z.enum(['admin', 'staff']).optional(),
  activo: z.boolean().optional(),
});

// Export types for TypeScript
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;
export type PaymentNotificationInput = z.infer<typeof paymentNotificationSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type AdminUpdateInput = z.infer<typeof adminUpdateSchema>;
