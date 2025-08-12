import { format, parseISO, addDays, isAfter, startOfDay } from 'date-fns'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'

const ARGENTINA_TIMEZONE = 'America/Argentina/Buenos_Aires'

// Convertir fecha local a UTC para almacenar en MongoDB
export function toUTC(date: Date): Date {
  return new Date(date.toISOString())
}

// Convertir UTC a fecha local para mostrar
export function fromUTC(utcDate: Date): Date {
  return toZonedTime(utcDate, ARGENTINA_TIMEZONE)
}

// Formatear fecha para mostrar en frontend
export function formatDateForDisplay(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return formatInTimeZone(dateObj, ARGENTINA_TIMEZONE, 'EEEE, d \'de\' MMMM \'de\' yyyy')
}

// Formatear fecha y hora para mostrar
export function formatDateTimeForDisplay(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return formatInTimeZone(dateObj, ARGENTINA_TIMEZONE, 'dd/MM/yyyy HH:mm')
}

// Formatear fecha para Google Sheets (YYYY-MM-DD HH:mm)
export function formatDateForSheets(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return formatInTimeZone(dateObj, ARGENTINA_TIMEZONE, 'yyyy-MM-dd HH:mm')
}

// Verificar si una fecha es válida para reservas (futura)
export function isValidReservationDate(date: string): boolean {
  const reservationDate = parseISO(date)
  const today = startOfDay(new Date())
  return isAfter(reservationDate, today)
}

// Verificar si una fecha es un día laboral (jueves a domingo)
export function isWorkingDay(date: string): boolean {
  const reservationDate = parseISO(date)
  const dayOfWeek = formatInTimeZone(reservationDate, ARGENTINA_TIMEZONE, 'EEEE').toLowerCase()
  const workingDays = ['thursday', 'friday', 'saturday', 'sunday']
  return workingDays.includes(dayOfWeek)
}

// Obtener fecha actual en timezone de Argentina
export function getCurrentDateArgentina(): Date {
  return toZonedTime(new Date(), ARGENTINA_TIMEZONE)
}

// Generar fechas disponibles para los próximos 30 días
export function generateAvailableDates(): string[] {
  const dates: string[] = []
  const today = new Date()
  
  for (let i = 0; i < 30; i++) {
    const date = addDays(today, i)
    const dateString = format(date, 'yyyy-MM-dd')
    
    if (isWorkingDay(dateString)) {
      dates.push(dateString)
    }
  }
  
  return dates
}

// Verificar si un turno está disponible según la hora actual
export function isTimeSlotAvailable(turno: string): boolean {
  const now = getCurrentDateArgentina()
  const currentHour = now.getHours()
  
  switch (turno) {
    case '17-19':
      return currentHour < 17
    case '19-21':
      return currentHour < 19
    case '21-23':
      return currentHour < 21
    default:
      return false
  }
}

// Obtener turnos disponibles para una fecha específica
export function getAvailableTimeSlots(fecha: string): string[] {
  const today = format(new Date(), 'yyyy-MM-dd')
  const isToday = fecha === today
  
  if (!isToday) {
    return ['17-19', '19-21', '21-23']
  }
  
  const now = getCurrentDateArgentina()
  const currentHour = now.getHours()
  const availableSlots: string[] = []
  
  if (currentHour < 17) availableSlots.push('17-19')
  if (currentHour < 19) availableSlots.push('19-21')
  if (currentHour < 21) availableSlots.push('21-23')
  
  return availableSlots
}

// Formatear hora de turno para mostrar
export function formatTimeSlot(turno: string): string {
  const [start, end] = turno.split('-')
  return `${start}:00 - ${end}:00`
} 