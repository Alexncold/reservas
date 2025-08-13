import { NextApiRequest, NextApiResponse } from 'next';
import { Reserva } from '@/models/Reserva';
import { queueUpdate } from '@/lib/sheetsSync';
import { logger } from '@/lib/logger';
import dbConnect from '@/lib/db/mongodb';
import { Sheets } from '@/lib/sheets';
import { toReservaDTO } from '@/lib/mapper';

interface PaymentNotification {
  action: string;
  api_version: string;
  data: {
    id: string;
  };
  date_created: string;
  id: number;
  live_mode: boolean;
  type: 'payment' | 'plan' | 'subscription' | 'invoice' | 'point_integration_wh';
  user_id: string;
}

export class WebhookService {
  private static instance: WebhookService;

  static getInstance(): WebhookService {
    if (!WebhookService.instance) {
      WebhookService.instance = new WebhookService();
    }
    return WebhookService.instance;
  }

  async handlePaymentNotification(req: NextApiRequest, res: NextApiResponse) {
    try {
      // Verificar que sea una solicitud POST
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      // Verificar la firma del webhook (opcional pero recomendado)
      const signature = req.headers['x-signature'] as string;
      if (!this.verifySignature(signature, req.body)) {
        logger.warn('Firma de webhook no válida', { signature });
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const notification = req.body as PaymentNotification;
      
      // Solo procesar notificaciones de pago
      if (notification.type !== 'payment') {
        logger.info('Tipo de notificación no manejado', { type: notification.type });
        return res.status(200).json({ status: 'ignored', reason: 'Not a payment notification' });
      }

      // Obtener el pago de MercadoPago
      const paymentId = notification.data.id;
      const payment = await this.getPaymentDetails(paymentId);
      
      if (!payment) {
        logger.error('No se pudo obtener el pago de MercadoPago', { paymentId });
        return res.status(404).json({ error: 'Payment not found' });
      }

      // Procesar el pago y actualizar la reserva
      const result = await this.processPayment(payment);
      
      if (!result.success) {
        logger.error('Error al procesar el pago', { 
          paymentId, 
          error: result.error 
        });
        return res.status(400).json({ 
          error: result.error || 'Error processing payment' 
        });
      }

      logger.info('Pago procesado exitosamente', { 
        paymentId, 
        reservaId: result.reservaId,
        status: payment.status 
      });

      return res.status(200).json({ 
        status: 'success',
        paymentId,
        reservaId: result.reservaId
      });

    } catch (error) {
      logger.error('Error en el webhook de MercadoPago', { 
        error,
        body: req.body 
      });
      return res.status(500).json({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private verifySignature(signature: string, body: any): boolean {
    // Implementar lógica de verificación de firma
    // Esto es un ejemplo básico, ajustar según la documentación de MercadoPago
    if (!process.env.MERCADOPAGO_WEBHOOK_SECRET) {
      logger.warn('No se configuró MERCADOPAGO_WEBHOOK_SECRET');
      return false;
    }
    
    const expectedSignature = this.createSignature(JSON.stringify(body), process.env.MERCADOPAGO_WEBHOOK_SECRET);
    return signature === expectedSignature;
  }

  private createSignature(payload: string, secret: string): string {
    // Implementar lógica de creación de firma según la documentación de MercadoPago
    const crypto = require('crypto');
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  private async getPaymentDetails(paymentId: string): Promise<any> {
    try {
      const mercadopago = require('mercadopago');
      mercadopago.configure({
        access_token: process.env.MP_ACCESS_TOKEN || '',
      });

      const payment = await mercadopago.payment.get(Number(paymentId));
      return payment.body;
    } catch (error) {
      logger.error('Error al obtener detalles del pago', { paymentId, error });
      return null;
    }
  }

  private async processPayment(payment: any): Promise<{
    success: boolean;
    reservaId?: string;
    error?: string;
  }> {
    const session = await dbConnect.startSession();
    session.startTransaction();

    try {
      const externalReference = payment.external_reference;
      if (!externalReference) {
        throw new Error('No se encontró la referencia externa en el pago');
      }

      // Buscar la reserva
      const reserva = await Reserva.findById(externalReference).session(session);
      if (!reserva) {
        throw new Error(`No se encontró la reserva con ID: ${externalReference}`);
      }

      // Actualizar el estado de la reserva según el estado del pago
      let nuevoEstado: 'pendiente_pago' | 'confirmada' | 'cancelada' = 'pendiente_pago';
      let estadoPago = 'pendiente';

      switch (payment.status) {
        case 'approved':
          nuevoEstado = 'confirmada';
          estadoPago = 'aprobado';
          break;
        case 'rejected':
        case 'cancelled':
        case 'refunded':
          nuevoEstado = 'cancelada';
          estadoPago = payment.status;
          break;
        case 'in_process':
        case 'pending':
          nuevoEstado = 'pendiente_pago';
          estadoPago = payment.status;
          break;
        default:
          logger.warn('Estado de pago no manejado', { 
            status: payment.status,
            paymentId: payment.id 
          });
          break;
      }

      // Actualizar la reserva en la base de datos
      const updatedReserva = await Reserva.findByIdAndUpdate(
        reserva.id,
        { 
          'pago.estado': estadoPago,
          'pago.mercadopago_id': payment.id,
          'pago.fecha_actualizacion': new Date(),
          estado: nuevoEstado,
          $push: { 
            historial_estados: { 
              estado: nuevoEstado, 
              fecha: new Date(),
              motivo: `Actualizado por webhook de MercadoPago (${payment.status})`
            } 
          }
        },
        { new: true }
      );

      if (!updatedReserva) {
        logger.error('No se pudo actualizar la reserva', { reservaId: reserva.id });
        return res.status(404).json({ error: 'Reserva no encontrada' });
      }

      // Sincronizar con Google Sheets si está habilitado
      if (process.env.SHEETS_SYNC_ENABLED === 'true') {
        try {
          const dto = toReservaDTO(updatedReserva);
          await Sheets.withRetry(() => Sheets.upsertReserva(dto));
          logger.info('Reserva sincronizada con Google Sheets', { 
            reservaId: updatedReserva._id,
            estado: nuevoEstado 
          });
        } catch (error) {
          logger.error('Error al sincronizar con Google Sheets', {
            reservaId: updatedReserva._id,
            error: error instanceof Error ? error.message : 'Error desconocido'
          });
          // No fallar el webhook completo por un error en la sincronización
        }
      } else {
        // Usar el sistema de cola como respaldo
        queueUpdate(updatedReserva);
      }

      return {
        success: true,
        reservaId: reserva._id.toString(),
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error('Error al procesar el pago', { 
        error, 
        paymentId: payment?.id 
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al procesar el pago',
      };
    } finally {
      await session.endSession();
    }
  }
}

export const webhookService = WebhookService.getInstance();
