import mercadopago from 'mercadopago';
import { logger } from './logger';

// Configuración básica del SDK de MercadoPago
const configureMercadoPago = () => {
  try {
    if (!process.env.MP_ACCESS_TOKEN) {
      throw new Error('MP_ACCESS_TOKEN no está configurado en las variables de entorno');
    }

    mercadopago.configure({
      access_token: process.env.MP_ACCESS_TOKEN,
      client_id: process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      sandbox: process.env.NODE_ENV !== 'production',
    });

    logger.info('MercadoPago SDK configurado correctamente', {
      env: process.env.NODE_ENV,
      sandbox: process.env.NODE_ENV !== 'production',
    });
    
    return mercadopago;
  } catch (error) {
    logger.error('Error al configurar MercadoPago SDK', { error });
    throw error;
  }
};

export const mp = configureMercadoPago();

export interface PaymentPreference {
  items: Array<{
    id?: string;
    title: string;
    description?: string;
    quantity: number;
    unit_price: number;
    currency_id: 'ARS' | 'BRL' | 'MXN' | 'COP' | 'CLP' | 'PEN' | 'UYU';
    picture_url?: string;
  }>;
  payer?: {
    name?: string;
    surname?: string;
    email?: string;
    phone?: {
      area_code: string;
      number: string;
    };
    address?: {
      zip_code: string;
      street_name: string;
      street_number?: number;
    };
  };
  payment_methods?: {
    excluded_payment_methods?: Array<{ id: string }>;
    excluded_payment_types?: Array<{ id: string }>;
    installments?: number;
    default_installments?: number;
  };
  back_urls?: {
    success: string;
    pending: string;
    failure: string;
  };
  auto_return?: 'approved' | 'all';
  notification_url?: string;
  external_reference?: string;
  expires?: boolean;
  expiration_date_from?: string;
  expiration_date_to?: string;
  statement_descriptor?: string;
  binary_mode?: boolean;
}

export interface PaymentResponse {
  body: {
    id: string;
    init_point: string;
    sandbox_init_point: string;
    date_created: string;
  };
  response: {
    status: number;
    statusText: string;
  };
}
