import { google, sheets_v4 } from 'googleapis'
import { IReserva } from '../models/Reserva'
import { v4 as uuidv4 } from 'uuid'

type OperationType = 'create' | 'update' | 'cancel'

interface PendingUpdate {
  id: string
  reserva: IReserva
  timestamp: number
  operation: OperationType
  retryCount: number
  lastError?: string
}

interface SheetsConfig {
  batchSize: number
  syncDelay: number
  maxRetries: number
  retryDelay: number
  cacheTTL: number
  spreadsheetId: string | undefined
  sheets: {
    reservas: string
    logs: string
  }
  ranges: {
    reservas: string
    logs: string
  }
}

interface SheetsState {
  isInitialized: boolean
  pendingUpdates: PendingUpdate[]
  isSyncing: boolean
  syncTimeout: NodeJS.Timeout | null
  client: sheets_v4.Sheets | null
  lastError: Error | null
  lastSync: number | null
  stats: {
    totalProcessed: number
    totalErrors: number
    lastErrorAt: number | null
  }
}

// Configuración
const CONFIG: SheetsConfig = {
  batchSize: parseInt(process.env.SHEETS_SYNC_BATCH_SIZE || '10'),
  syncDelay: parseInt(process.env.SHEETS_SYNC_DELAY_MS || '2000'),
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds
  cacheTTL: parseInt(process.env.SHEETS_CACHE_TTL_MS || '60000'),
  spreadsheetId: process.env.SPREADSHEET_ID,
  sheets: {
    reservas: 'Reservas',
    logs: 'Logs',
  },
  ranges: {
    reservas: 'A:N',
    logs: 'A:F'
  }
}

// Estado global
const state: SheetsState = {
  isInitialized: false,
  pendingUpdates: [],
  isSyncing: false,
  syncTimeout: null,
  client: null,
  lastError: null,
  lastSync: null,
  stats: {
    totalProcessed: 0,
    totalErrors: 0,
    lastErrorAt: null,
  },
}

// Constantes
const BATCH_SIZE = 10
const SYNC_DELAY = 1000
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

// Cache para disponibilidad
const availabilityCache = new Map<string, { data: unknown; timestamp: number }>()

// Inicializar cliente de Google Sheets
async function initSheetsClient(): Promise<sheets_v4.Sheets> {
  if (state.sheetsClient) {
    return state.sheetsClient
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    state.client = google.sheets({ version: 'v4', auth })
    state.isInitialized = true
    logger.info('Google Sheets client initialized')
    return state.client
  } catch (error) {
    logger.error('Failed to initialize Google Sheets client', error as Error)
    throw error
  }
}

// Logger
const logger = {
  error: (message: string, error?: Error) => {
    logToSheets('ERROR', message, error?.stack || '')
    console.error(`[Sheets Sync] ${message}`, error)
  },
  info: (message: string) => {
    logToSheets('INFO', message)
    console.log(`[Sheets Sync] ${message}`)
  },
  warn: (message: string) => {
    logToSheets('WARN', message)
    console.warn(`[Sheets Sync] ${message}`)
  }
}

// Función para agregar actualización a la cola
export function queueUpdate(reserva: IReserva, operation: OperationType = 'create'): string {
  if (!reserva._id) {
    throw new Error('La reserva debe tener un ID válido')
  }
  
  const updateId = uuidv4()
  const existingIndex = state.pendingUpdates.findIndex(
    (update) => update.reserva._id?.toString() === reserva._id.toString()
  )

  const update: PendingUpdate = {
    id: updateId,
    reserva,
    timestamp: Date.now(),
    operation,
    retryCount: 0,
  }

  if (existingIndex >= 0) {
    // Reemplazar actualización existente
    state.pendingUpdates[existingIndex] = update
    logger.info(`Updated pending sync for reservation ${reserva._id} (${operation})`)
  } else {
    // Agregar nueva actualización
    state.pendingUpdates.push(update)
    logger.info(`Queued ${operation} for reservation ${reserva._id}`)
  }

  // Programar sincronización si no está en curso
  if (!state.isSyncing) {
    scheduleSync()
  }

  return updateId
}

// Programar sincronización con delay
function scheduleSync() {
  if (state.syncTimeout) {
    clearTimeout(state.syncTimeout)
    state.syncTimeout = null
  }

  state.syncTimeout = setTimeout(() => {
    syncToSheets().catch((error) => {
      logger.error('Error in scheduled sync', error as Error)
    })
  }, SYNC_DELAY)
}

// Función principal de sincronización
async function syncToSheets() {
  if (state.isSyncing || state.pendingUpdates.length === 0) {
    return
  }

  state.isSyncing = true
  logger.info(`Starting sync with ${state.pendingUpdates.length} pending updates`)

  try {
    // Inicializar cliente si es necesario
    const sheets = await initSheetsClient()
    if (!sheets) {
      throw new Error('Failed to initialize Google Sheets client')
    }

    // Procesar en lotes
    while (state.pendingUpdates.length > 0) {
      const batch = state.pendingUpdates.splice(0, BATCH_SIZE)
      logger.info(`Processing batch of ${batch.length} updates`)

      // Procesar cada actualización en el lote
      for (const update of batch) {
        try {
          await processUpdate(sheets, update)
          state.stats.totalProcessed++
        } catch (error) {
          state.stats.totalErrors++
          state.stats.lastErrorAt = Date.now()
          handleUpdateError(update, error as Error)
        }

        // Pequeño delay entre actualizaciones
        if (state.pendingUpdates.length > 0) {
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      }
    }

    state.lastSync = Date.now()
    logger.info('Sync completed successfully')
  } catch (error) {
    const errorObj = error as Error & { response?: { status?: number } }
    logger.error('Fatal error in sync process', errorObj)
    
    // Reintentar con backoff exponencial
    const isRateLimit = 
      errorObj.response?.status === 429 ||
      (errorObj.response?.status && errorObj.response.status >= 500)

    if (isRateLimit) {
      const retryCount = state.pendingUpdates[0]?.retryCount || 0
      const retryDelay = Math.min(
        SYNC_DELAY * Math.pow(2, retryCount),
        60000 // Máximo 1 minuto
      )

      logger.warn(`Rate limited, retrying in ${retryDelay}ms (attempt ${retryCount + 1})`)

      // Reagendar
      state.syncTimeout = setTimeout(() => {
        state.isSyncing = false
        if (state.pendingUpdates.length > 0) {
          syncToSheets().catch((err) => 
            logger.error('Error in retry sync', err as Error)
          )
        }
      }, retryDelay)

      return
    }
  } finally {
        state.isSyncing = false
    state.lastSync = state.lastSync || Date.now()

    // Si quedan actualizaciones pendientes, programar siguiente sync
    if (state.pendingUpdates.length > 0) {
      logger.info(`Scheduling next sync with ${state.pendingUpdates.length} pending updates`)
      scheduleSync()
    } else {
      logger.info('No more pending updates')
    }
  }
}

// Inicializar cliente de Google Sheets
async function initSheetsClient(): Promise<sheets_v4.Sheets | null> {
  if (state.client) {
    return state.client
  }

  try {
    const auth = getGoogleAuth()
    state.client = google.sheets({ version: 'v4', auth })
    state.isInitialized = true
    logger.info('Google Sheets client initialized')
    return state.client
  } catch (error) {
    logger.error('Failed to initialize Google Sheets client', error as Error)
    state.isInitialized = false
    state.lastError = error as Error
    state.stats.lastErrorAt = Date.now()
    state.stats.totalErrors++
    return null
  }
}
}

// Procesar una actualización individual
async function processUpdate(sheets: sheets_v4.Sheets, update: PendingUpdate) {
  const { reserva, operation } = update
  
  try {
    switch (operation) {
      case 'create':
        await createReserva(sheets, reserva)
        break
      case 'update':
        await updateReserva(sheets, reserva)
        break
      case 'cancel':
        await cancelReserva(sheets, reserva)
        break
      default:
        throw new Error(`Operación no soportada: ${operation}`)
    }
    
    logger.info(`Successfully ${operation}d reservation ${reserva._id}`)
  } catch (error) {
    logger.error(`Failed to ${operation} reservation ${reserva._id}`, error as Error)
    throw error
  }
}

// Manejar errores de actualización
function handleUpdateError(update: PendingUpdate, error: Error) {
  const maxRetries = CONFIG.maxRetries
  const retryCount = update.retryCount || 0
  
  if (retryCount >= maxRetries) {
    logger.error(`Max retries (${maxRetries}) reached for reservation ${update.reserva._id}. Giving up.`, error)
    return
  }
  
  // Reintentar
  update.retryCount = retryCount + 1
  update.lastError = error.message
  state.pendingUpdates.push(update)
  logger.warn(`Will retry (${update.retryCount}/${maxRetries}) reservation ${update.reserva._id}`)
}

// Crear nueva reserva en Google Sheets
async function createReserva(sheets: sheets_v4.Sheets, reserva: IReserva) {
  const values = [formatReservaForSheets(reserva)]
  
  await sheets.spreadsheets.values.append({
    spreadsheetId: CONFIG.spreadsheetId!,
    range: `${CONFIG.sheets.reservas}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  })
}

// Actualizar reserva existente en Google Sheets
async function updateReserva(sheets: sheets_v4.Sheets, reserva: IReserva) {
  if (!reserva._id) {
    throw new Error('Se requiere ID de reserva para actualizar')
  }
  
  // Buscar la fila de la reserva
  const rowIndex = await findReservaRowIndex(sheets, reserva._id.toString())
  if (rowIndex === -1) {
    throw new Error(`No se encontró la reserva con ID ${reserva._id}`)
  }
  
  const range = `${CONFIG.sheets.reservas}!A${rowIndex + 1}`
  const values = [formatReservaForSheets(reserva)]
  
  await sheets.spreadsheets.values.update({
    spreadsheetId: CONFIG.spreadsheetId!,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  })
}

// Cancelar reserva en Google Sheets
async function cancelReserva(sheets: sheets_v4.Sheets, reserva: IReserva) {
  if (!reserva._id) {
    throw new Error('Se requiere ID de reserva para cancelar')
  }
  
  // Buscar la fila de la reserva
  const rowIndex = await findReservaRowIndex(sheets, reserva._id.toString())
  if (rowIndex === -1) {
    throw new Error(`No se encontró la reserva con ID ${reserva._id}`)
  }
  
  // Actualizar solo el estado a 'cancelada'
  const range = `${CONFIG.sheets.reservas}!I${rowIndex + 1}` // Columna I = estado
  
  await sheets.spreadsheets.values.update({
    spreadsheetId: CONFIG.spreadsheetId!,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [['cancelada']]
    },
  })
}

// Encontrar el índice de fila de una reserva por ID
async function findReservaRowIndex(sheets: sheets_v4.Sheets, reservaId: string): Promise<number> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: CONFIG.spreadsheetId!,
    range: `${CONFIG.sheets.reservas}!A:A`, // Buscar en la columna A (ID)
  })
  
  const rows = response.data.values || []
  
  // Buscar el ID en la primera columna (asumiendo que el ID está en la columna A)
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === reservaId) {
      return i + 1 // +1 porque las filas en Sheets empiezan en 1
    }
  }
  
  return -1 // No encontrado
}

// Registrar en el log de Sheets
async function logToSheets(level: 'INFO' | 'WARN' | 'ERROR', message: string, details = '') {
  if (!CONFIG.spreadsheetId) return
  
  try {
    const sheets = await initSheetsClient()
    if (!sheets) return
    
    const timestamp = new Date().toISOString()
    const values = [[timestamp, level, message, details, process.env.VERCEL_ENV || 'development']]
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: CONFIG.spreadsheetId,
      range: `${CONFIG.sheets.logs}!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    })
  } catch (error) {
    console.error('Failed to write to log sheet:', error)
  }
}

// Programar sincronización con delay
function scheduleSync() {
  if (syncTimeout) {
    clearTimeout(syncTimeout)
  }
  
  syncTimeout = setTimeout(() => {
    syncToSheets()
  }, SYNC_DELAY)
}

// Función principal de sincronización
async function syncToSheets() {
  if (isSyncing || pendingUpdates.length === 0) {
    return
  }
  
  isSyncing = true
  
  try {
    const auth = getGoogleAuth()
    const sheets = google.sheets({ version: 'v4', auth })
    
    while (pendingUpdates.length > 0) {
      const batch = pendingUpdates.splice(0, BATCH_SIZE)
      const values = batch.map(({ reserva }) => formatReservaForSheets(reserva))
      
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.SPREADSHEET_ID!,
        range: 'Reservas!A1',
        valueInputOption: 'RAW',
        requestBody: { values },
      })
      
      // Delay entre batches para evitar rate limits
      if (pendingUpdates.length > 0) {
        await new Promise(resolve => setTimeout(resolve, SYNC_DELAY))
      }
    }
  } catch (error) {
    console.error('Error syncing to Sheets:', error)
    
    // Implementar backoff exponencial
    const errorObj = error as { response?: { status?: number } }
    if (errorObj.response?.status === 429 || errorObj.response?.status && errorObj.response.status >= 500) {
      // Reintentar con delay exponencial
      const retryDelay = Math.min(SYNC_DELAY * 2, 30000) // Máximo 30 segundos
      setTimeout(() => {
        isSyncing = false
        if (pendingUpdates.length > 0) {
          syncToSheets()
        }
      }, retryDelay)
      return
    }
    
    // Para otros errores, mantener las actualizaciones en la cola
    console.error('Failed to sync updates, will retry later')
  } finally {
    isSyncing = false
    
    // Si quedan actualizaciones pendientes, programar siguiente sync
    if (pendingUpdates.length > 0) {
      scheduleSync()
    }
  }
}

// Formatear reserva para Google Sheets
function formatReservaForSheets(reserva: IReserva): unknown[] {
  return [
    reserva.fecha,
    reserva.turno,
    reserva.mesa,
    reserva.personas,
    reserva.cliente.nombre,
    reserva.cliente.email,
    reserva.cliente.telefono,
    reserva.juego || '',
    reserva.estado,
    reserva.pago?.mercadopago_id || '',
    reserva.pago?.monto || '',
    reserva.pago?.estado || '',
    reserva.pago?.fecha_pago ? new Date(reserva.pago.fecha_pago).toISOString() : '',
    new Date(reserva.created_at).toISOString(),
  ]
}

// Configurar autenticación de Google Sheets
function getGoogleAuth() {
  if (!process.env.GOOGLE_SHEETS_CLIENT_EMAIL || !process.env.GOOGLE_SHEETS_PRIVATE_KEY) {
    throw new Error('Missing Google Sheets credentials in environment variables')
  }

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

// Función para leer disponibilidad desde Sheets (con cache)
export async function getAvailabilityFromSheets(fecha: string) {
  const cacheKey = `availability_${fecha}`
  const cached = availabilityCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CONFIG.cacheTTL) {
    return cached.data
  }
  
  try {
    const sheets = await initSheetsClient()
    if (!sheets) {
      throw new Error('Failed to initialize Google Sheets client')
    }
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.spreadsheetId!,
      range: `${CONFIG.sheets.reservas}!${CONFIG.ranges.reservas}`,
    })
    
    const rows = response.data.values || []
    const reservas = rows
      .filter((row) => row[0] === fecha)
      .map((row) => ({
        fecha: row[0],
        turno: row[1],
        mesa: parseInt(row[2] as string, 10),
        estado: row[8],
      }))
    
    // Formatear disponibilidad
    const availability = formatAvailabilityFromReservas(reservas)
    
    // Guardar en cache
    availabilityCache.set(cacheKey, {
      data: availability,
      timestamp: Date.now(),
    })
    
    return availability
  } catch (error) {
    logger.error('Error reading availability from Sheets', error as Error)
    throw error
  }
}

// Exportar funciones de utilidad
export const sheetsUtils = {
  // Obtener estadísticas de la cola de sincronización
  getQueueStats: () => ({
    pendingUpdates: state.pendingUpdates.length,
    isSyncing: state.isSyncing,
    cacheSize: availabilityCache.size,
    lastError: state.pendingUpdates[0]?.lastError || null,
  }),
  
  // Forzar sincronización inmediata
  forceSync: async () => {
    if (state.syncTimeout) {
      clearTimeout(state.syncTimeout)
      state.syncTimeout = null
    }
    return syncToSheets()
  },
  
  // Limpiar caché de disponibilidad
  clearCache: () => {
    availabilityCache.clear()
    logger.info('Availability cache cleared')
  },
  
  // Obtener estado del cliente
  getClientStatus: () => ({
    isInitialized: state.isInitialized,
    lastSync: state.lastSync,
  }),
}

// Formatear disponibilidad desde reservas
function formatAvailabilityFromReservas(reservas: unknown[]) {
  const turnos = ['17-19', '19-21', '21-23']
  const mesas = [1, 2, 3]
  const availability: Record<string, Record<number, boolean>> = {}
  
  turnos.forEach(turno => {
    availability[turno] = {}
    mesas.forEach(mesa => {
      const reserva = reservas.find((r: any) => 
        r.turno === turno && 
        r.mesa === mesa && 
        ['pendiente_pago', 'confirmada'].includes(r.estado)
      )
      availability[turno][mesa] = !reserva
    })
  })
  
  return availability
}

// Función para limpiar cache
export function clearCache() {
  availabilityCache.clear()
}

// Función para obtener estadísticas de la cola
export function getQueueStats() {
  return {
    pendingUpdates: pendingUpdates.length,
    isSyncing,
    cacheSize: availabilityCache.size,
  }
} 