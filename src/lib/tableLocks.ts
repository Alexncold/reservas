import { IReserva } from '../models/Reserva'
import { logger } from './logger'

interface TableLock {
  reservaId: string
  mesaId: string
  fecha: string
  turno: string
  expiresAt: Date
}

class TableLocksManager {
  private locks: Map<string, TableLock> = new Map()
  private cleanupInterval: NodeJS.Timeout
  private readonly LOCK_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

  constructor() {
    // Start cleanup interval
    this.cleanupInterval = setInterval(
      () => this.cleanupExpiredLocks(),
      this.CLEANUP_INTERVAL_MS
    )

    // Clean up on process exit
    process.on('exit', () => this.cleanup())
    process.on('SIGINT', () => this.cleanup())
    process.on('SIGTERM', () => this.cleanup())
  }

  /**
   * Attempt to acquire a lock for a table
   */
  public acquireLock(reserva: IReserva): boolean {
    const context = {
      reservaId: reserva._id?.toString(),
      mesaId: reserva.mesa,
      fecha: reserva.fecha,
      turno: reserva.turno,
      tableLock: true
    }
    if (!reserva._id || !reserva.mesa || !reserva.fecha || !reserva.turno) {
      const error = new Error('Reserva inválida: faltan campos requeridos')
      logger.error('Error al adquirir bloqueo: reserva inválida', { ...context, error })
      throw error
    }

    const lockKey = this.getLockKey(reserva.mesa.toString(), reserva.fecha, reserva.turno)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + this.LOCK_TIMEOUT_MS)

    // Check if table is already locked
    const existingLock = this.locks.get(lockKey)
    if (existingLock) {
      // If lock exists but is expired, remove it
      if (new Date(existingLock.expiresAt) < now) {
        logger.debug('Eliminando bloqueo expirado', { ...context, existingLock })
        this.locks.delete(lockKey)
      } else {
        logger.debug('Mesa ya está bloqueada', { ...context, existingLock })
        return false // Table is locked
      }
    }

    // Acquire new lock
    const newLock = {
      reservaId: reserva._id.toString(),
      mesaId: reserva.mesa.toString(),
      fecha: reserva.fecha,
      turno: reserva.turno,
      expiresAt,
    }
    
    this.locks.set(lockKey, newLock)
    logger.info('Nuevo bloqueo adquirido', { ...context, lock: newLock })

    return true
  }

  /**
   * Release a lock for a table
   */
  public releaseLock(reserva: IReserva): boolean {
    const context = {
      reservaId: reserva._id?.toString(),
      mesaId: reserva.mesa,
      fecha: reserva.fecha,
      turno: reserva.turno,
      tableLock: true
    }
    if (!reserva.mesa || !reserva.fecha || !reserva.turno) {
      return false
    }

    const lockKey = this.getLockKey(reserva.mesa.toString(), reserva.fecha, reserva.turno)
    const wasDeleted = this.locks.delete(lockKey)
    
    if (wasDeleted) {
      logger.info('Bloqueo liberado', { ...context, lockKey })
    } else {
      logger.debug('Intento de liberar bloqueo que no existe', { ...context, lockKey })
    }
    
    return wasDeleted
  }

  /**
   * Check if a table is currently locked
   */
  public isTableLocked(mesaId: string, fecha: string, turno: string): boolean {
    const context = {
      mesaId,
      fecha,
      turno,
      tableLock: true
    }
    const lockKey = this.getLockKey(mesaId, fecha, turno)
    const lock = this.locks.get(lockKey)
    
    if (!lock) return false
    
    // Check if lock is expired
    if (new Date(lock.expiresAt) < new Date()) {
      logger.debug('Bloqueo expirado encontrado', { ...context, lock })
      this.locks.delete(lockKey)
      return false
    }
    
    return true
  }

  /**
   * Get all active locks
   */
  public getActiveLocks(): TableLock[] {
    const now = new Date()
    const activeLocks: TableLock[] = []
    
    // Convert Map to array for iteration
    Array.from(this.locks.entries()).forEach(([key, lock]) => {
      if (new Date(lock.expiresAt) >= now) {
        activeLocks.push(lock)
      } else {
        this.locks.delete(key)
      }
    })
    
    return activeLocks
  }

  /**
   * Clean up expired locks
   */
  private cleanupExpiredLocks(): void {
    const now = new Date()
    let expiredCount = 0
    
    // Convert Map to array for iteration
    Array.from(this.locks.entries()).forEach(([key, lock]) => {
      if (new Date(lock.expiresAt) < now) {
        this.locks.delete(key)
        expiredCount++
      }
    })
    
    if (expiredCount > 0) {
      logger.info(`Limpieza de bloqueos expirados: ${expiredCount} eliminados`, { tableLock: true })
    }
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    clearInterval(this.cleanupInterval)
    const lockCount = this.locks.size
    this.locks.clear()
    
    if (lockCount > 0) {
      logger.warn(`Se limpiaron ${lockCount} bloqueos activos durante el cierre`, { tableLock: true })
    }
  }

  /**
   * Generate a unique key for a lock
   */
  private getLockKey(mesaId: string, fecha: string, turno: string): string {
    return `${mesaId}:${fecha}:${turno}`
  }
}

// Export a singleton instance
export const tableLocksManager = new TableLocksManager()
