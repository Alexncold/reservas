export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validatePhone(phone: string): boolean {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/
  return phoneRegex.test(phone.replace(/\s/g, ''))
}

export function validateDate(date: string): boolean {
  const selectedDate = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  return selectedDate >= today
}

export function validateTimeSlot(timeSlot: string): boolean {
  const validSlots = ['17-19', '19-21', '21-23']
  return validSlots.includes(timeSlot)
}

export function validateTableNumber(table: number): boolean {
  return table >= 1 && table <= 3
}

export function validatePersonCount(count: number): boolean {
  return count >= 1 && count <= 6
} 