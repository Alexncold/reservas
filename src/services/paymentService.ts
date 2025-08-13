import { mp, PaymentPreference, PaymentResponse } from '@/lib/mercadopago';
import { logger } from '@/lib/logger';
import { IReserva } from '@/models/Reserva';

interface CreatePaymentPreferenceParams {
  reserva: IReserva;
  items: Array<{
    title: string;
    quantity: number;
    unit_price: number;
    currency_id?: 'ARS' | 'BRL' | 'MXN' | 'COP' | 'CLP' | 'PEN' | 'UYU';
  }>;
  baseUrl: string;
}

export class PaymentService {
  private static instance: PaymentService;

  static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  async createPaymentPreference({
    reserva,
    items,
    baseUrl,
  }: CreatePaymentPreferenceParams): Promise<PaymentResponse> {
    try {
      const preference: PaymentPreference = {
        items: items.map(item => ({
          ...item,
          currency_id: item.currency_id || 'ARS',
        })),
        payer: {
          name: reserva.cliente.nombre,
          email: reserva.cliente.email,
          phone: {
            area_code: reserva.cliente.telefono.substring(0, 3),
            number: reserva.cliente.telefono.substring(3),
          },
        },
        back_urls: {
          success: `${baseUrl}/reserva/pago/exito?id=${reserva._id}`,
          pending: `${baseUrl}/reserva/pago/pendiente?id=${reserva._id}`,
          failure: `${baseUrl}/reserva/pago/error?id=${reserva._id}`,
        },
        auto_return: 'approved',
        notification_url: `${baseUrl}/api/webhooks/mercadopago`,
        external_reference: reserva._id.toString(),
        expires: true,
        expires_date_from: new Date().toISOString(),
        expires_date_to: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutos para pagar
        payment_methods: {
          excluded_payment_methods: [
            { id: 'amex' }, // Excluir AMEX por defecto
          ],
          installments: 12, // Máximo de cuotas
        },
        statement_descriptor: 'GAMEHUB',
        binary_mode: true, // No permitir pagos pendientes
      };

      logger.info('Creando preferencia de pago', {
        reservaId: reserva._id,
        monto: items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
      });

      const response = await mp.preferences.create(preference);
      
      logger.info('Preferencia de pago creada exitosamente', {
        reservaId: reserva._id,
        preferenceId: response.body.id,
      });

      return response;
    } catch (error) {
      logger.error('Error al crear preferencia de pago', {
        error,
        reservaId: reserva._id,
      });
      throw new Error('Error al procesar el pago. Por favor, intente nuevamente.');
    }
  }

  async getPaymentStatus(paymentId: string) {
    try {
      const payment = await mp.payment.get(Number(paymentId));
      return {
        status: payment.body.status,
        statusDetail: payment.body.status_detail,
        externalReference: payment.body.external_reference,
        amount: payment.body.transaction_amount,
        paymentMethod: payment.body.payment_method_id,
        paymentType: payment.body.payment_type_id,
      };
    } catch (error) {
      logger.error('Error al obtener estado de pago', { paymentId, error });
      throw error;
    }
  }
}

export const paymentService = PaymentService.getInstance();
