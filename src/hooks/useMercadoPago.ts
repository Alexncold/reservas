import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { IReserva } from '@/models/Reserva';
import { paymentService } from '@/services/paymentService';

export interface PaymentItem {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: 'ARS' | 'BRL' | 'MXN' | 'COP' | 'CLP' | 'PEN' | 'UYU';
}

export function useMercadoPago() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);

  const createPaymentPreference = useCallback(
    async (reserva: IReserva, items: PaymentItem[]) => {
      if (!reserva) {
        const error = new Error('No se encontró la información de la reserva');
        setError(error);
        throw error;
      }

      setIsLoading(true);
      setError(null);

      try {
        const baseUrl = window.location.origin;
        const response = await paymentService.createPaymentPreference({
          reserva,
          items,
          baseUrl,
        });

        setPreferenceId(response.body.id);
        return response.body.id;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Error al crear la preferencia de pago');
        setError(error);
        toast.error('Error al procesar el pago. Por favor, intente nuevamente.');
        console.error('Error creating payment preference:', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const checkPaymentStatus = useCallback(async (paymentId: string) => {
    try {
      setIsLoading(true);
      const status = await paymentService.getPaymentStatus(paymentId);
      return status;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error al verificar el estado del pago');
      setError(error);
      console.error('Error checking payment status:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setPreferenceId(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    createPaymentPreference,
    checkPaymentStatus,
    preferenceId,
    isLoading,
    error,
    reset,
  };
}

export default useMercadoPago;
