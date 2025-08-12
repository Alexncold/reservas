export const APP_CONFIG = {
  name: 'GameHub',
  description: 'Sistema de reservas para juegos de mesa',
  url: process.env.NEXTAUTH_URL || 'http://localhost:3000',
}

export const RESERVATION_CONFIG = {
  maxPersonsPerTable: 6,
  tablesCount: 3,
  timeSlots: ['17-19', '19-21', '21-23'] as const,
  pricePerPerson: 3000,
  workingDays: ['thursday', 'friday', 'saturday', 'sunday'] as const,
}

export const TIME_SLOTS = {
  '17-19': { start: '17:00', end: '19:00' },
  '19-21': { start: '19:00', end: '21:00' },
  '21-23': { start: '21:00', end: '23:00' },
} as const 