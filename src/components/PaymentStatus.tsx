'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Clock, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { paymentExpiryService } from '@/services/paymentExpiryService';
import { paymentService } from '@/services/paymentService';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

interface PaymentStatusProps {
  reservaId: string;
  initialStatus: 'pending' | 'approved' | 'rejected' | 'in_process' | 'cancelled' | 'expired';
  preferenceId?: string;
  onRetry?: () => void;
  onSuccess?: () => void;
}

export function PaymentStatus({
  reservaId,
  initialStatus,
  preferenceId,
  onRetry,
  onSuccess,
}: PaymentStatusProps) {
  const [status, setStatus] = useState(initialStatus);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Efecto para verificar el estado del pago periódicamente
  useEffect(() => {
    if (status !== 'pending' && status !== 'in_process') {
      return;
    }

    const checkPaymentStatus = async () => {
      try {
        const paymentStatus = await paymentService.getPaymentStatus(reservaId);
        
        if (paymentStatus.status !== status) {
          setStatus(paymentStatus.status);
          
          if (paymentStatus.status === 'approved' && onSuccess) {
            onSuccess();
          }
        }
      } catch (error) {
        console.error('Error al verificar el estado del pago:', error);
      }
    };

    // Verificar inmediatamente
    checkPaymentStatus();
    
    // Verificar cada 15 segundos
    const interval = setInterval(checkPaymentStatus, 15000);
    
    return () => clearInterval(interval);
  }, [reservaId, status, onSuccess]);

  // Efecto para el contador de tiempo restante
  useEffect(() => {
    if (status !== 'pending' && status !== 'in_process') {
      return;
    }

    const updateRemainingTime = async () => {
      try {
        const time = await paymentExpiryService.getRemainingTime(reservaId);
        setRemainingTime(time);
        
        // Si el tiempo expiró, actualizar el estado
        if (time === 0) {
          setStatus('expired');
        }
      } catch (error) {
        console.error('Error al obtener el tiempo restante:', error);
      }
    };

    // Actualizar inmediatamente
    updateRemainingTime();
    
    // Actualizar cada segundo
    const timer = setInterval(updateRemainingTime, 1000);
    
    return () => clearInterval(timer);
  }, [reservaId, status]);

  const handleRetry = async () => {
    if (!preferenceId) {
      toast({
        title: 'Error',
        description: 'No se pudo procesar el reintento de pago. Por favor, intente nuevamente más tarde.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Renovar el tiempo de expiración
      const renewed = await paymentExpiryService.renewPaymentExpiry(reservaId);
      
      if (!renewed) {
        throw new Error('No se pudo renovar el tiempo de pago');
      }
      
      // Redirigir a la página de pago
      window.location.href = `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${preferenceId}`;
      
    } catch (error) {
      console.error('Error al reintentar el pago:', error);
      
      toast({
        title: 'Error',
        description: 'No se pudo procesar el reintento de pago. Por favor, intente nuevamente más tarde.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderStatus = () => {
    switch (status) {
      case 'pending':
      case 'in_process':
        return (
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
              <Clock className="h-12 w-12 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h3 className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              Pago Pendiente
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Estamos esperando la confirmación de tu pago.
            </p>
            {remainingTime !== null && (
              <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Tiempo restante: {Math.floor(remainingTime / 60)}:{String(remainingTime % 60).padStart(2, '0')}
              </div>
            )}
            <Button 
              onClick={handleRetry} 
              disabled={isLoading}
              className="mt-4"
              variant="outline"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                'Reintentar Pago'
              )}
            </Button>
          </div>
        );

      case 'approved':
        return (
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-full">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-2xl font-bold text-green-600 dark:text-green-400">
              ¡Pago Aprobado!
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Tu reserva ha sido confirmada. Te hemos enviado un correo con los detalles.
            </p>
            <Button 
              onClick={() => router.push('/mis-reservas')}
              className="mt-4"
            >
              Ver mis reservas
            </Button>
          </div>
        );

      case 'rejected':
        return (
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full">
              <XCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-2xl font-bold text-red-600 dark:text-red-400">
              Pago Rechazado
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              No pudimos procesar tu pago. Por favor, intenta con otro método de pago.
            </p>
            <div className="flex gap-2 mt-4">
              <Button 
                variant="outline" 
                onClick={() => router.push('/')}
              >
                Volver al inicio
              </Button>
              <Button 
                onClick={handleRetry}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  'Reintentar Pago'
                )}
              </Button>
            </div>
          </div>
        );

      case 'expired':
        return (
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-4 bg-orange-100 dark:bg-orange-900/30 rounded-full">
              <AlertTriangle className="h-12 w-12 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              Tiempo Agotado
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              El tiempo para realizar el pago ha expirado. Por favor, inicia una nueva reserva.
            </p>
            <Button 
              onClick={() => router.push('/reservar')}
              className="mt-4"
            >
              Nueva Reserva
            </Button>
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full">
              <AlertCircle className="h-12 w-12 text-gray-600 dark:text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-600 dark:text-gray-300">
              Estado desconocido
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              No pudimos determinar el estado de tu pago. Por favor, verifica más tarde o contacta a soporte.
            </p>
            <Button 
              variant="outline" 
              onClick={() => router.push('/contacto')}
              className="mt-4"
            >
              Contactar Soporte
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Estado del Pago
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            ID de reserva: {reservaId}
          </p>
        </div>
        
        <div className="mt-8">
          {renderStatus()}
        </div>
        
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            Si tienes alguna duda, no dudes en contactar a nuestro equipo de soporte.
          </p>
        </div>
      </div>
    </div>
  );
}
