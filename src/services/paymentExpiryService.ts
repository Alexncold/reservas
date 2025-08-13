import { Reserva } from '@/models/Reserva';
import { logger } from '@/lib/logger';
import dbConnect from '@/lib/db/mongodb';
import { queueUpdate } from '@/lib/sheetsSync';

class PaymentExpiryService {
  private static instance: PaymentExpiryService;
  private expiryMinutes = 15; // Tiempo de expiración en minutos
  private checkInterval = 5 * 60 * 1000; // Revisar cada 5 minutos
  private intervalId: NodeJS.Timeout | null = null;

  static getInstance(): PaymentExpiryService {
    if (!PaymentExpiryService.instance) {
      PaymentExpiryService.instance = new PaymentExpiryService();
    }
    return PaymentExpiryService.instance;
  }

  /**
   * Inicia el servicio de verificación de expiración de pagos
   */
  start() {
    if (this.intervalId) {
      logger.warn('El servicio de expiración de pagos ya está en ejecución');
      return;
    }

    logger.info(`Iniciando servicio de expiración de pagos (verificación cada ${this.checkInterval / 60000} minutos)`);
    
    // Ejecutar inmediatamente la primera verificación
    this.checkExpiredPayments().catch(error => {
      logger.error('Error en la verificación inicial de pagos expirados', { error });
    });

    // Programar verificaciones periódicas
    this.intervalId = setInterval(() => {
      this.checkExpiredPayments().catch(error => {
        logger.error('Error en la verificación periódica de pagos expirados', { error });
      });
    }, this.checkInterval);
  }

  /**
   * Detiene el servicio de verificación de expiración de pagos
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Servicio de expiración de pagos detenido');
    }
  }

  /**
   * Verifica y actualiza los pagos expirados
   */
  async checkExpiredPayments(): Promise<void> {
    const session = await dbConnect.startSession();
    
    try {
      session.startTransaction();
      
      const expiryTime = new Date(Date.now() - this.expiryMinutes * 60 * 1000);
      
      logger.debug('Buscando pagos pendientes expirados...', { expiryTime });
      
      // Buscar reservas con pagos pendientes que hayan expirado
      const expiredReservas = await Reserva.find({
        'pago.estado': 'pendiente',
        'pago.fecha_creacion': { $lt: expiryTime },
        estado: 'pendiente_pago'
      }).session(session);

      if (expiredReservas.length === 0) {
        logger.debug('No se encontraron pagos pendientes expirados');
        await session.commitTransaction();
        return;
      }

      logger.info(`Actualizando ${expiredReservas.length} reservas con pagos expirados`);
      
      // Actualizar cada reserva expirada
      for (const reserva of expiredReservas) {
        try {
          reserva.estado = 'cancelada';
          reserva.pago.estado = 'expirado';
          reserva.pago.fecha_actualizacion = new Date();
          
          await reserva.save({ session });
          
          // Agregar a la cola de sincronización
          queueUpdate(reserva);
          
          logger.info(`Reserva ${reserva._id} marcada como expirada`);
          
          // Aquí podrías agregar notificaciones al usuario
          // this.notifyUser(reserva);
          
        } catch (error) {
          logger.error(`Error al actualizar reserva expirada ${reserva._id}`, { error });
          // Continuar con la siguiente reserva en caso de error
        }
      }
      
      await session.commitTransaction();
      
    } catch (error) {
      await session.abortTransaction();
      logger.error('Error en la verificación de pagos expirados', { error });
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Verifica si un pago ha expirado
   */
  async isPaymentExpired(reservaId: string): Promise<boolean> {
    const reserva = await Reserva.findById(reservaId);
    
    if (!reserva || reserva.estado !== 'pendiente_pago' || !reserva.pago?.fecha_creacion) {
      return false;
    }
    
    const expiryTime = new Date(reserva.pago.fecha_creacion.getTime() + this.expiryMinutes * 60 * 1000);
    return new Date() > expiryTime;
  }

  /**
   * Obtiene el tiempo restante para que expire un pago (en segundos)
   */
  async getRemainingTime(reservaId: string): Promise<number | null> {
    const reserva = await Reserva.findById(reservaId);
    
    if (!reserva || reserva.estado !== 'pendiente_pago' || !reserva.pago?.fecha_creacion) {
      return null;
    }
    
    const expiryTime = new Date(reserva.pago.fecha_creacion.getTime() + this.expiryMinutes * 60 * 1000);
    const remainingMs = expiryTime.getTime() - Date.now();
    
    return Math.max(0, Math.floor(remainingMs / 1000));
  }

  /**
   * Intenta renovar el tiempo de expiración de un pago
   */
  async renewPaymentExpiry(reservaId: string, additionalMinutes = 15): Promise<boolean> {
    const session = await dbConnect.startSession();
    
    try {
      session.startTransaction();
      
      const reserva = await Reserva.findById(reservaId).session(session);
      
      if (!reserva || reserva.estado !== 'pendiente_pago' || !reserva.pago) {
        throw new Error('Reserva no encontrada o estado inválido');
      }
      
      // Actualizar la fecha de creación para extender el tiempo de expiración
      reserva.pago.fecha_creacion = new Date();
      await reserva.save({ session });
      
      await session.commitTransaction();
      
      logger.info(`Tiempo de pago renovado para la reserva ${reservaId}`, {
        nuevaExpiracion: new Date(Date.now() + this.expiryMinutes * 60 * 1000)
      });
      
      return true;
      
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error al renovar el tiempo de pago para la reserva ${reservaId}`, { error });
      return false;
    } finally {
      await session.endSession();
    }
  }
}

export const paymentExpiryService = PaymentExpiryService.getInstance();
