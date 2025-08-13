import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { formatInTimeZone } from 'date-fns-tz';
import pino from 'pino';
import { IReserva } from '@/models/Reserva';

const logger = pino({ 
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

// Define the sheet structure
const SHEET_NAME = 'Reservas';
const HEADERS = [
  'reserva_uuid',
  'fecha_iso',
  'turno_label',
  'mesa_num',
  'cliente_nombre',
  'cliente_telefono',
  'cliente_email',
  'personas',
  'juego',
  'estado',
  'pago_id',
  'monto_ars',
  'updated_at_iso',
  'idempotency_key',
  'notas',
] as const;

// Cache for auth client
let authClient: JWT | null = null;

/**
 * Get authenticated Google Sheets client
 */
async function getAuthClient() {
  if (authClient) return authClient;

  const serviceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccount) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set');
  }

  try {
    const credentials = JSON.parse(serviceAccount);
    
    authClient = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    // Test the connection
    await authClient.authorize();
    return authClient;
  } catch (error) {
    logger.error('Failed to authenticate with Google Sheets API');
    throw error;
  }
}

/**
 * Convert a reservation to a row for the Google Sheet
 */
function reservaToRow(reserva: IReserva): string[] {
  const fechaIso = formatInTimeZone(reserva.fecha, 'UTC', 'yyyy-MM-dd');
  const updatedAtIso = reserva.updatedAt.toISOString();
  const idempotencyKey = `${reserva._id}:${updatedAtIso}`;

  return [
    reserva._id.toString(),
    fechaIso,
    reserva.turno,
    reserva.mesa.toString(),
    reserva.clientes.nombre,
    reserva.clientes.telefono,
    reserva.clientes.email || '',
    reserva.personas.toString(),
    reserva.juego || '',
    reserva.estado,
    reserva.pago?.mercadopago_id || '',
    reserva.pago?.monto?.toString() || '',
    updatedAtIso,
    idempotencyKey,
    reserva.notas || '',
  ];
}

/**
 * Get Google Sheets API client
 */
async function getSheets() {
  const auth = await getAuthClient();
  return google.sheets({ version: 'v4', auth });
}

/**
 * Ensure the sheet has the correct headers
 */
async function ensureHeaders() {
  const sheets = await getSheets();
  const spreadsheetId = process.env.SPREADSHEET_ID;
  
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID environment variable is not set');
  }

  try {
    // Check if headers exist
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAME}!A1:${String.fromCharCode(64 + HEADERS.length)}1`,
    });

    const existingHeaders = response.data.values?.[0] || [];
    const needsUpdate = existingHeaders.length !== HEADERS.length || 
      !HEADERS.every((header, i) => existingHeaders[i] === header);

    if (needsUpdate) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_NAME}!A1:${String.fromCharCode(64 + HEADERS.length)}1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [HEADERS],
        },
      });
      logger.info('Updated sheet headers');
    }
  } catch (error: any) {
    if (error.code === 404) {
      // Sheet doesn't exist, create it
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: SHEET_NAME,
              },
            },
          }],
        },
      });

      // Add headers
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_NAME}!A1:${String.fromCharCode(64 + HEADERS.length)}1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [HEADERS],
        },
      });
      logger.info('Created new sheet with headers');
    } else {
      throw error;
    }
  }
}

/**
 * Find a row by reservation ID
 */
async function findRowByReservaId(reservaId: string): Promise<number | null> {
  const sheets = await getSheets();
  const spreadsheetId = process.env.SPREADSHEET_ID;
  
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID environment variable is not set');
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A:A`,
  });

  const rows = response.data.values || [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === reservaId) {
      return i + 1; // +1 because rows are 1-indexed in Google Sheets
    }
  }

  return null;
}

/**
 * Upsert a reservation to the sheet
 */
async function upsertReserva(reserva: IReserva) {
  const sheets = await getSheets();
  const spreadsheetId = process.env.SPREADSHEET_ID;
  
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID environment variable is not set');
  }

  await ensureHeaders();
  const row = reservaToRow(reserva);
  const rowIndex = await findRowByReservaId(reserva._id.toString());

  if (rowIndex !== null) {
    // Update existing row
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!A${rowIndex}:${String.fromCharCode(64 + HEADERS.length)}${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });
    return { action: 'updated', rowIndex };
  } else {
    // Append new row
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SET_NAME}!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [row],
      },
    });
    return { action: 'created', rowIndex: -1 };
  }
}

/**
 * Upsert multiple reservations with retry logic
 */
async function batchUpsertReservas(reservas: IReserva[]) {
  const results = {
    success: 0,
    errors: 0,
    details: [] as Array<{
      reservaId: string;
      success: boolean;
      error?: string;
    }>,
  };

  for (const reserva of reservas) {
    try {
      await withRetry(() => upsertReserva(reserva));
      results.success++;
      results.details.push({ reservaId: reserva._id.toString(), success: true });
    } catch (error) {
      results.errors++;
      results.details.push({
        reservaId: reserva._id.toString(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      logger.error(`Failed to sync reserva ${reserva._id}:`, error);
    }
  }

  return results;
}

/**
 * Retry helper with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelay?: number } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelay = options.baseDelay ?? 1000; // 1 second

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on 404 or 403 errors
      if (
        (error as any).code === 404 || 
        (error as any).code === 403 ||
        (error as any).response?.status === 404 ||
        (error as any).response?.status === 403
      ) {
        break;
      }

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        logger.warn(`Retry ${attempt + 1}/${maxRetries} after error:`, (error as Error).message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Unknown error in withRetry');
}

export const Sheets = {
  upsertReserva: withRetry.bind(null, upsertReserva),
  batchUpsert: batchUpsertReservas,
  ensureHeaders,
  withRetry,
};

export default Sheets;
