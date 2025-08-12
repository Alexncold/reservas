export interface Reserva {
  _id?: string
  fecha: string // YYYY-MM-DD
  turno: string // "17-19" | "19-21" | "21-23"
  mesa: number // 1, 2, 3
  personas: number // 1-6
  juego?: string
  cliente: {
    nombre: string
    telefono: string
    email: string
  }
  estado: 'pendiente_pago' | 'confirmada' | 'cancelada'
  pago?: {
    mercadopago_id: string
    monto: number
    estado: string
    fecha_pago: Date
  }
  created_at: Date
  updated_at: Date
}

export interface Mesa {
  numero: number
  capacidad: number
  ocupada: boolean
  reservas_turno?: number
}

export interface Turno {
  hora: string // "17-19"
  disponible: boolean
  mesas_disponibles: number
} 