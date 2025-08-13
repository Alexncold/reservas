import { Sheets } from '@/lib/sheets';
import { IReserva } from '@/models/Reserva';
import { config } from '@/lib/config';

// Mock the Google Sheets API
jest.mock('googleapis', () => {
  const mockSheets = {
    spreadsheets: {
      values: {
        get: jest.fn(),
        update: jest.fn(),
        append: jest.fn(),
        batchUpdate: jest.fn(),
      },
    },
  };

  return {
    google: {
      auth: {
        JWT: jest.fn().mockImplementation(() => ({
          authorize: jest.fn().mockResolvedValue(undefined),
        })),
      },
      sheets: jest.fn().mockReturnValue(mockSheets),
    },
  };
});

describe('Google Sheets Integration', () => {
  const mockReserva: IReserva = {
    _id: '123',
    fecha: new Date('2025-08-15T19:00:00-03:00'),
    turno: '19:00-21:00',
    mesa: 1,
    clientes: {
      nombre: 'Test User',
      telefono: '+5491112345678',
      email: 'test@example.com',
    },
    personas: 4,
    juego: 'Catan',
    estado: 'pendiente',
    pago: {
      estado: 'pending',
      mercadopago_id: 'mp-123',
      monto: 4000,
    },
    notas: 'Test reservation',
    createdAt: new Date('2025-08-13T10:00:00-03:00'),
    updatedAt: new Date('2025-08-13T10:00:00-03:00'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock environment variables
    process.env.SPREADSHEET_ID = 'test-spreadsheet-id';
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: 'test@example.com',
      private_key: 'test-key',
    });
  });

  describe('ensureHeaders', () => {
    it('should create headers if sheet is empty', async () => {
      const { google } = require('googleapis');
      google.sheets().spreadsheets.values.get.mockResolvedValueOnce({
        data: { values: [] },
      });

      await Sheets.ensureHeaders();

      expect(google.sheets().spreadsheets.values.update).toHaveBeenCalledWith(
        expect.objectContaining({
          range: 'Reservas!A1:O1',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              [
                'reserva_uuid', 'fecha_iso', 'turno_label', 'mesa_num',
                'cliente_nombre', 'cliente_telefono', 'cliente_email',
                'personas', 'juego', 'estado', 'pago_id', 'monto_ars',
                'updated_at_iso', 'idempotency_key', 'notas'
              ]
            ],
          },
        })
      );
    });
  });

  describe('upsertReserva', () => {
    it('should append new reservation when not exists', async () => {
      const { google } = require('googleapis');
      
      // Mock find row to return null (not found)
      google.sheets().spreadsheets.values.get.mockResolvedValueOnce({
        data: { values: [[], []] }, // Headers + one empty row
      });

      await Sheets.upsertReserva(mockReserva);

      expect(google.sheets().spreadsheets.values.append).toHaveBeenCalledWith(
        expect.objectContaining({
          range: 'Reservas!A1',
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
        })
      );
    });

    it('should update existing reservation when newer', async () => {
      const { google } = require('googleapis');
      
      // Mock find row
      google.sheets().spreadsheets.values.get
        // First call to find row
        .mockResolvedValueOnce({
          data: { 
            values: [
              ['123'], // Found ID
            ],
          },
        })
        // Second call to get existing row
        .mockResolvedValueOnce({
          data: {
            values: [
              [
                '123',
                '2025-08-15',
                '19:00-21:00',
                '1',
                'Old Name', // Old name
                '+5491112345678',
                'old@example.com',
                '4',
                'Catan',
                'pendiente',
                'mp-123',
                '4000',
                '2025-08-13T10:00:00.000Z', // Older timestamp
                '123:2025-08-13T10:00:00.000Z',
                'Old notes',
              ],
            ],
          },
        });

      await Sheets.upsertReserva(mockReserva);

      expect(google.sheets().spreadsheets.values.update).toHaveBeenCalledWith(
        expect.objectContaining({
          range: 'Reservas!A1:O1',
          valueInputOption: 'USER_ENTERED',
        })
      );
    });

    it('should skip update when existing is newer', async () => {
      const { google } = require('googleapis');
      
      // Mock find row
      google.sheets().spreadsheets.values.get
        // First call to find row
        .mockResolvedValueOnce({
          data: { 
            values: [
              ['123'], // Found ID
            ],
          },
        })
        // Second call to get existing row
        .mockResolvedValueOnce({
          data: {
            values: [
              [
                '123',
                '2025-08-15',
                '19:00-21:00',
                '1',
                'Newer Name', // Newer data
                '+5491112345678',
                'newer@example.com',
                '4',
                'Catan',
                'confirmada', // Newer status
                'mp-123',
                '4000',
                '2025-08-14T10:00:00.000Z', // Newer timestamp
                '123:2025-08-14T10:00:00.000Z',
                'Newer notes',
              ],
            ],
          },
        });

      const result = await Sheets.upsertReserva(mockReserva);

      expect(result.action).toBe('noop');
      expect(google.sheets().spreadsheets.values.update).not.toHaveBeenCalled();
    });
  });

  describe('withRetry', () => {
    it('should retry on rate limit', async () => {
      const { google } = require('googleapis');
      
      // Mock rate limit error
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).code = 429;
      
      // First call fails with rate limit, second succeeds
      google.sheets().spreadsheets.values.get
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ data: { values: [] } });

      await Sheets.withRetry(() => Sheets.ensureHeaders());
      
      expect(google.sheets().spreadsheets.values.get).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      const { google } = require('googleapis');
      
      // Mock rate limit error
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).code = 429;
      
      // Always fail with rate limit
      google.sheets().spreadsheets.values.get.mockRejectedValue(rateLimitError);

      await expect(
        Sheets.withRetry(() => Sheets.ensureHeaders(), { maxRetries: 2 })
      ).rejects.toThrow('Rate limit exceeded');
      
      expect(google.sheets().spreadsheets.values.get).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });
});
