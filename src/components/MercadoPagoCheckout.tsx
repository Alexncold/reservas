'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

declare global {
  interface Window {
    MercadoPago?: {
      (publicKey: string, options?: { locale: string }): {
        checkout: (options: {
          preference: {
            id: string;
          };
          autoOpen?: boolean;
          theme?: {
            elementsColor?: string;
            headerColor?: string;
          };
          render?: {
            container: string;
            label: string;
          };
        }) => void;
      };
    };
  }
}

interface MercadoPagoCheckoutProps {
  preferenceId: string | null;
  onError?: (error: Error) => void;
  onLoadingChange?: (isLoading: boolean) => void;
  buttonClassName?: string;
  buttonText?: string;
}

export function MercadoPagoCheckout({
  preferenceId,
  onError,
  onLoadingChange,
  buttonClassName = '',
  buttonText = 'Pagar con MercadoPago',
}: MercadoPagoCheckoutProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.MercadoPago) {
      const script = document.createElement('script');
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.async = true;
      script.onload = () => setSdkLoaded(true);
      script.onerror = () => {
        const error = new Error('Error al cargar el SDK de MercadoPago');
        console.error(error);
        onError?.(error);
        toast.error('No se pudo cargar el sistema de pagos. Por favor, recarga la página.');
      };
      document.body.appendChild(script);
    } else {
      setSdkLoaded(true);
    }

    return () => {
      // Cleanup
      if (window.MercadoPago) {
        delete window.MercadoPago;
      }
    };
  }, [onError]);

  const handlePayment = () => {
    if (!preferenceId) {
      const error = new Error('No se pudo iniciar el pago. Falta el ID de preferencia.');
      console.error(error);
      onError?.(error);
      toast.error('Error al procesar el pago. Por favor, intente nuevamente.');
      return;
    }

    if (!sdkLoaded) {
      toast.info('El sistema de pagos aún se está cargando. Por favor, espere un momento.');
      return;
    }

    setIsLoading(true);

    try {
      const mp = new window.MercadoPago!(
        process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || '',
        {
          locale: 'es-AR',
        }
      );

      mp.checkout({
        preference: {
          id: preferenceId,
        },
        autoOpen: true,
        theme: {
          elementsColor: '#4f46e5', // Color principal de la aplicación
          headerColor: '#4f46e5',
        },
      });

      // Manejar el cierre del checkout
      const handleClose = () => {
        setIsLoading(false);
        // No forzamos recarga para permitir manejo de estados en la página
      };

      // Agregar event listener para detectar cierre del checkout
      window.addEventListener('message', (event) => {
        if (event.data.type === 'MP_READY') {
          console.log('MercadoPago Checkout está listo');
        }
      });

      return () => {
        window.removeEventListener('message', handleClose);
      };
    } catch (error) {
      console.error('Error al abrir el checkout de MercadoPago:', error);
      onError?.(error as Error);
      toast.error('Error al abrir el sistema de pagos. Por favor, intente nuevamente.');
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <Button
        onClick={handlePayment}
        disabled={!preferenceId || isLoading || !sdkLoaded}
        className={`w-full ${buttonClassName}`}
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Procesando pago...
          </>
        ) : (
          buttonText
        )}
      </Button>
      
      {process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_MP_PUBLIC_KEY && (
        <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
          Advertencia: NEXT_PUBLIC_MP_PUBLIC_KEY no está configurado. El botón de pago no funcionará correctamente.
        </p>
      )}
    </div>
  );
}
