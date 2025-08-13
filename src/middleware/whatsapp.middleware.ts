import { NextRequest, NextResponse } from 'next/server';
import { getNotificationService } from '@/lib/whatsapp/notification.service';
import { logger } from '@/lib/logger';

type ReservationEvent = {
  type: 'reservation.created' | 'reservation.updated' | 'reservation.cancelled';
  data: {
    id: string;
    cliente: {
      nombre: string;
      telefono: string;
      email?: string;
    };
    fecha: string;
    turno: string;
    mesa: number;
    estado: string;
    pago?: {
      monto: number;
      urlPago?: string;
    };
    juego?: string;
  };
  oldData?: {
    estado?: string;
    fecha?: string;
    turno?: string;
  };
};

export async function handleWhatsAppNotification(event: ReservationEvent) {
  if (process.env.NOTIFY_ENABLED !== 'true') {
    logger.debug('WhatsApp notifications are disabled');
    return;
  }

  const notificationService = getNotificationService();
  const { type, data, oldData } = event;
  
  try {
    // Format the event data for the notification service
    const notificationData = {
      reservaId: data.id,
      cliente: data.cliente,
      fecha: new Date(data.fecha),
      turno: data.turno,
      mesa: data.mesa,
      estado: data.estado,
      pago: data.pago,
      juego: data.juego,
    };

    switch (type) {
      case 'reservation.created':
        if (data.estado === 'pendiente' && data.pago?.urlPago) {
          await notificationService.sendReservationPending(notificationData);
        } else if (data.estado === 'confirmada') {
          await notificationService.sendReservationConfirmed(notificationData);
          await notificationService.initializeReservationNotifications(notificationData);
        }
        break;

      case 'reservation.updated':
        if (oldData) {
          // Handle status changes
          if (oldData.estado !== data.estado) {
            if (data.estado === 'confirmada') {
              await notificationService.sendReservationConfirmed(notificationData);
              await notificationService.initializeReservationNotifications(notificationData);
            } else if (data.estado === 'cancelada') {
              await notificationService.sendReservationCancelled(notificationData);
              await notificationService.cancelScheduledNotifications(data.id);
            }
          }
          
          // Handle date/time changes
          if (
            (oldData.fecha && oldData.fecha !== data.fecha) ||
            (oldData.turno && oldData.turno !== data.turno)
          ) {
            await notificationService.cancelScheduledNotifications(data.id);
            if (data.estado === 'confirmada') {
              await notificationService.initializeReservationNotifications(notificationData);
            }
          }
        }
        break;

      case 'reservation.cancelled':
        await notificationService.sendReservationCancelled(notificationData);
        await notificationService.cancelScheduledNotifications(data.id);
        break;
    }

    logger.info(`Processed WhatsApp notification for ${type}`, {
      reservaId: data.id,
      estado: data.estado,
    });
  } catch (error) {
    logger.error(`Failed to process WhatsApp notification for ${type}`, {
      error: error.message,
      stack: error.stack,
      reservaId: data.id,
    });
    throw error; // Re-throw to allow for retries if needed
  }
}

// Middleware for Next.js API routes
export function withWhatsAppNotifications(handler: any) {
  return async (req: NextRequest, ...args: any[]) => {
    const response = await handler(req, ...args);
    
    // Process notification asynchronously after the response is sent
    if (req.method === 'POST') {
      try {
        const event = await req.json();
        if (isReservationEvent(event)) {
          // Don't await to avoid blocking the response
          handleWhatsAppNotification(event).catch(error => {
            logger.error('Failed to handle WhatsApp notification', {
              error: error.message,
              event,
            });
          });
        }
      } catch (error) {
        logger.error('Error parsing request body for WhatsApp notification', {
          error: error.message,
        });
      }
    }
    
    return response;
  };
}

// Type guard for reservation events
function isReservationEvent(event: any): event is ReservationEvent {
  return (
    event &&
    typeof event === 'object' &&
    ['reservation.created', 'reservation.updated', 'reservation.cancelled'].includes(event.type) &&
    event.data &&
    typeof event.data.id === 'string' &&
    event.data.cliente &&
    typeof event.data.cliente.nombre === 'string' &&
    typeof event.data.cliente.telefono === 'string' &&
    typeof event.data.fecha === 'string' &&
    typeof event.data.turno === 'string' &&
    typeof event.data.mesa === 'number' &&
    typeof event.data.estado === 'string'
  );
}
