import mongoose from 'mongoose'
import { Reserva, IReserva } from './models/Reserva'
import { CreateReserva } from './schemas'
import dbConnect from './db/mongodb'
import crypto from 'crypto'
import { logger } from './logger'

// Función para verificar disponibilidad
export async function checkAvailability(
  fecha: string,
  turno: string,
  mesa: number
): Promise<boolean> {
  await dbConnect()
  
  const existingReserva = await Reserva.findOne({
    fecha,
    turno,
    mesa,
    estado: { $in: ['pendiente_pago', 'confirmada'] },
  })
  
  return !existingReserva
}

// Función para crear reserva con verificación atómica
export async function createReservaWithLock(reservaData: CreateReserva): Promise<IReserva> {
  await dbConnect()
  
  const session = await mongoose.startSession()
  
  try {
    session.startTransaction()
    
    // Verificar disponibilidad con bloqueo
    const isAvailable = await checkAvailability(
      reservaData.fecha,
      reservaData.turno,
      reservaData.mesa
    )
    
    if (!isAvailable) {
      await session.abortTransaction()
      throw new Error('Turno no disponible')
    }
    
    // Crear la reserva
    const reserva = new Reserva(reservaData)
    await reserva.save({ session })
    
    await session.commitTransaction()
    return reserva
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}

// Función para obtener reservas por fecha
export async function getReservasByDate(fecha: string): Promise<IReserva[]> {
  await dbConnect()
  
  return await Reserva.find({
    fecha,
    estado: { $in: ['pendiente_pago', 'confirmada'] },
  }).sort({ turno: 1, mesa: 1 })
}

// Función para actualizar estado de reserva
export async function updateReservaStatus(
  reservaId: string,
  estado: 'pendiente_pago' | 'confirmada' | 'cancelada',
  pagoData?: Record<string, unknown>
): Promise<IReserva | null> {
  await dbConnect()
  
  const updateData: Record<string, unknown> = { estado }
  if (pagoData) {
    updateData.pago = pagoData
  }
  
  return await Reserva.findByIdAndUpdate(
    reservaId,
    updateData,
    { new: true }
  )
}

// Función para obtener disponibilidad de todas las mesas en una fecha
export async function getAvailabilityByDate(fecha: string) {
  await dbConnect()
  
  const reservas = await getReservasByDate(fecha)
  const turnos = ['17-19', '19-21', '21-23']
  const mesas = [1, 2, 3]
  
  const availability: Record<string, Record<number, boolean>> = {}
  
  turnos.forEach(turno => {
    availability[turno] = {}
    mesas.forEach(mesa => {
      const reserva = reservas.find(r => r.turno === turno && r.mesa === mesa)
      availability[turno][mesa] = !reserva
    })
  })
  
  return availability
}

// Función para generar idempotency key
export function generateIdempotencyKey(reservaData: CreateReserva): string {
  const data = `${reservaData.fecha}-${reservaData.turno}-${reservaData.mesa}-${Date.now()}`
  return crypto.createHash('md5').update(data).digest('hex')
}

/**
 * Actualiza una reserva con la información de preferencia de pago
 * @param reservaId ID de la reserva a actualizar
 * @param preferenceId ID de la preferencia de pago de MercadoPago
 * @returns La reserva actualizada o null si no se encontró
 */
export async function updateReservaWithPaymentPreference(
  reservaId: string,
  preferenceId: string
): Promise<IReserva | null> {
  const session = await mongoose.startSession()
  
  try {
    session.startTransaction()
    
    const reserva = await Reserva.findById(reservaId).session(session)
    
    if (!reserva) {
      logger.warn('Reserva no encontrada al actualizar preferencia de pago', { reservaId })
      await session.abortTransaction()
      return null
    }
    
    // Actualizar la reserva con el ID de preferencia
    reserva.pago = reserva.pago || {}
    reserva.pago.mercadopago_preference_id = preferenceId
    reserva.pago.estado = 'pendiente'
    reserva.pago.fecha_actualizacion = new Date()
    
    await reserva.save({ session })
    await session.commitTransaction()
    
    logger.info('Reserva actualizada con preferencia de pago', {
      reservaId,
      preferenceId,
      estado: 'pendiente'
    })
    
    return reserva
  } catch (error) {
    await session.abortTransaction()
    logger.error('Error al actualizar la reserva con preferencia de pago', {
      error,
      reservaId,
      preferenceId
    })
    throw error
  } finally {
    await session.endSession()
  }
}