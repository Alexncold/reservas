import { google } from 'googleapis'
import { IReserva } from './models/Reserva'

interface PendingUpdate {
  reserva: IReserva
  timestamp: number
}

const pendingUpdates: PendingUpdate[] = []
let isSyncing = false
let syncTimeout: NodeJS.Timeout | null = null

// Configuración de rate limiting
const BATCH_SIZE = parseInt(process.env.SHEETS_SYNC_BATCH_SIZE || '10')
const SYNC_DELAY = parseInt(process.env.SHEETS_SYNC_DELAY_MS || '1000')
const CACHE_TTL = parseInt(process.env.SHEETS_CACHE_TTL_MS || '60000')

// Cache para disponibilidad
const availabilityCache = new Map<string, { data: unknown; timestamp: number }>()

// Configurar autenticación de Google Sheets
function getGoogleAuth() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return auth
}

// Función para agregar actualización a la cola
export function queueUpdate(reserva: IReserva) {
  pendingUpdates.push({
    reserva,
    timestamp: Date.now(),
  })
  
  // Programar sincronización si no está en curso
  if (!isSyncing) {
    scheduleSync()
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

// Función para leer disponibilidad desde Sheets (con cache)
export async function getAvailabilityFromSheets(fecha: string) {
  const cacheKey = `availability_${fecha}`
  const cached = availabilityCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  
  try {
    const auth = getGoogleAuth()
    const sheets = google.sheets({ version: 'v4', auth })
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID!,
      range: 'Reservas!A:N',
    })
    
    const rows = response.data.values || []
    const reservas = rows
      .filter((row: unknown[]) => row[0] === fecha)
      .map((row: unknown[]) => ({
        fecha: row[0],
        turno: row[1],
        mesa: parseInt(row[2] as string),
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
    console.error('Error reading from Sheets:', error)
    throw error
  }
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