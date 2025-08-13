import { NextApiRequest, NextApiResponse, NextApiHandler } from 'next'
import { tableLocksManager } from '../lib/tableLocks'
import { IReserva } from '../models/Reserva'

/**
 * Middleware to handle table locking for reservation endpoints
 */
export function withTableLock(handler: NextApiHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Only apply to POST, PUT, and DELETE methods
    if (!['POST', 'PUT', 'DELETE'].includes(req.method || '')) {
      return handler(req, res)
    }

    const reserva = req.body as IReserva

    try {
      // For DELETE requests, try to release the lock
      if (req.method === 'DELETE') {
        tableLocksManager.releaseLock(reserva)
        return handler(req, res)
      }

      // For POST/PUT, check and acquire lock
      if (reserva.estado === 'pendiente' || reserva.estado === 'confirmada') {
        const lockAcquired = tableLocksManager.acquireLock(reserva)
        
        if (!lockAcquired) {
          return res.status(423).json({
            success: false,
            error: 'La mesa seleccionada no está disponible en este momento. Por favor, intente con otra mesa o intente más tarde.'
          })
        }
      }

      // If lock acquired or not needed, proceed with the handler
      return handler(req, res)
    } catch (error) {
      console.error('Error in table lock middleware:', error)
      return res.status(500).json({
        success: false,
        error: 'Error al procesar la reserva. Por favor, intente nuevamente.'
      })
    }
  }
}

/**
 * Middleware to check table availability
 */
export function checkTableAvailability(handler: NextApiHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== 'GET') {
      return handler(req, res)
    }

    try {
      const { mesaId, fecha, turno } = req.query
      
      if (!mesaId || !fecha || !turno) {
        return handler(req, res)
      }

      const isLocked = tableLocksManager.isTableLocked(
        mesaId as string,
        fecha as string,
        turno as string
      )

      if (isLocked) {
        return res.status(200).json({
          available: false,
          reason: 'La mesa está temporalmente reservada. Por favor, intente con otra mesa o intente más tarde.'
        })
      }

      return handler(req, res)
    } catch (error) {
      console.error('Error checking table availability:', error)
      return handler(req, res)
    }
  }
}
