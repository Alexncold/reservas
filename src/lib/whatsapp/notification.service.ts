import { NotificationType } from '@/models/Notification';
import { enqueueNotification } from './queue';
import { Customer } from '@/models/Customer';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ReservationEvent {
  reservaId: string;
  cliente: {
    nombre: string;
    telefono: string;
    email?: string;
  };
  fecha: Date;
  turno: string;
  mesa: number;
  estado: string;
  pago?: {
    monto: number;
    urlPago?: string;
  };
  juego?: string;
}

export class NotificationService {
  // Send notification when reservation is created (pending payment)
  static async sendReservationPending(event: ReservationEvent) {
    const { reservaId, cliente, fecha, turno, mesa, pago } = event;
    
    // Format date and time for the message
    const formattedDate = format(fecha, "d 'de' MMMM 'de' yyyy", { locale: es });
    const [horaInicio] = turno.split('-');
    
    return enqueueNotification(
      reservaId,
      NotificationType.PENDING_CONFIRMATION,
      cliente.telefono,
      'reserva_pendiente_v1',
      [
        cliente.nombre,
        formattedDate,
        turno,
        mesa.toString(),
        pago?.urlPago || '#',
      ],
      { delay: 0 } // Send immediately
    );
  }

  // Send notification when payment is approved
  static async sendReservationConfirmed(event: ReservationEvent) {
    const { reservaId, cliente, fecha, turno, mesa, juego } = event;
    
    const formattedDate = format(fecha, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
    const [horaInicio] = turno.split('-');
    
    return enqueueNotification(
      reservaId,
      NotificationType.CONFIRMED,
      cliente.telefono,
      'reserva_confirmada_v1',
      [
        cliente.nombre,
        formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1), // Capitalize day
        horaInicio.trim(),
        mesa.toString(),
      ]
    );
  }

  // Schedule 24-hour reminder
  static async schedule24HourReminder(event: ReservationEvent) {
    const { reservaId, cliente, fecha, turno, mesa } = event;
    
    // Schedule for 24 hours before the reservation
    const reminderTime = new Date(fecha);
    reminderTime.setHours(reminderTime.getHours() - 24);
    
    // Don't schedule if the event is in less than 24 hours
    if (reminderTime < new Date()) {
      return null;
    }
    
    const formattedDate = format(fecha, "d 'de' MMMM 'de' yyyy", { locale: es });
    
    return enqueueNotification(
      reservaId,
      NotificationType.REMINDER_24H,
      cliente.telefono,
      'reserva_recordatorio_24h_v1',
      [
        formattedDate,
        turno,
        mesa.toString(),
      ],
      { scheduledFor: reminderTime }
    );
  }

  // Schedule 2-hour reminder
  static async schedule2HourReminder(event: ReservationEvent) {
    const { reservaId, cliente, fecha, turno, mesa } = event;
    
    // Schedule for 2 hours before the reservation
    const reminderTime = new Date(fecha);
    reminderTime.setHours(reminderTime.getHours() - 2);
    
    // Don't schedule if the event is in less than 2 hours
    if (reminderTime < new Date()) {
      return null;
    }
    
    const formattedDate = format(fecha, "d 'de' MMMM 'de' yyyy", { locale: es });
    
    return enqueueNotification(
      reservaId,
      NotificationType.REMINDER_2H,
      cliente.telefono,
      'reserva_recordatorio_2h_v1',
      [
        formattedDate,
        turno,
        mesa.toString(),
      ],
      { scheduledFor: reminderTime }
    );
  }

  // Send cancellation notification
  static async sendReservationCancelled(event: ReservationEvent) {
    const { reservaId, cliente, fecha, turno, mesa } = event;
    
    const formattedDate = format(fecha, "d 'de' MMMM 'de' yyyy", { locale: es });
    const [horaInicio] = turno.split('-');
    
    return enqueueNotification(
      reservaId,
      NotificationType.CANCELLED,
      cliente.telefono,
      'reserva_cancelada_v1',
      [
        formattedDate,
        horaInicio.trim(),
        mesa.toString(),
      ]
    );
  }

  // Cancel all scheduled notifications for a reservation
  static async cancelScheduledNotifications(reservaId: string) {
    // This would cancel any pending notifications in the queue
    // Implementation depends on your queue system
    // For BullMQ, you would need to find and remove the jobs
    console.log(`Canceling scheduled notifications for reservation ${reservaId}`);
    // TODO: Implement queue-specific cancellation logic
  }

  // Initialize all scheduled notifications for a reservation
  static async initializeReservationNotifications(event: ReservationEvent) {
    // Only initialize for confirmed reservations
    if (event.estado === 'confirmada') {
      await this.schedule24HourReminder(event);
      await this.schedule2HourReminder(event);
    }
  }

  // Update notifications when reservation changes
  static async updateReservationNotifications(
    oldEvent: ReservationEvent,
    newEvent: ReservationEvent
  ) {
    // If the date or time changed, cancel existing reminders and create new ones
    if (
      oldEvent.fecha.getTime() !== newEvent.fecha.getTime() ||
      oldEvent.turno !== newEvent.turno
    ) {
      await this.cancelScheduledNotifications(oldEvent.reservaId);
      
      if (newEvent.estado === 'confirmada') {
        await this.schedule24HourReminder(newEvent);
        await this.schedule2HourReminder(newEvent);
      }
    }
  }
}

// Helper function to get the notification service
export function getNotificationService() {
  return new NotificationService();
}
