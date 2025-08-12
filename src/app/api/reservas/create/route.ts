import { NextRequest, NextResponse } from 'next/server'
import { createReservaSchema } from '@/lib/schemas'
import { createReservaWithLock, generateIdempotencyKey } from '@/lib/reservaService'
import { queueUpdate } from '@/lib/sheetsSync'
import { formatCurrency } from '@/lib/utils'
import { RESERVATION_CONFIG } from '@/lib/constants'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validar datos de entrada
    const validatedData = createReservaSchema.parse(body)
    
    // Generar idempotency key
    const idempotencyKey = generateIdempotencyKey(validatedData)
    
    // Crear reserva con verificación atómica
    const reserva = await createReservaWithLock(validatedData)
    
    // Agregar a la cola de sincronización con Google Sheets
    queueUpdate(reserva)
    
    // Calcular monto total
    const montoTotal = validatedData.personas * RESERVATION_CONFIG.pricePerPerson
    
    // Preparar respuesta
    const response = {
      success: true,
      data: {
        reserva: {
          id: reserva._id,
          fecha: reserva.fecha,
          turno: reserva.turno,
          mesa: reserva.mesa,
          personas: reserva.personas,
          cliente: reserva.cliente,
          estado: reserva.estado,
          montoTotal: formatCurrency(montoTotal),
        },
        idempotencyKey,
      },
      message: 'Reserva creada exitosamente',
    }
    
    return NextResponse.json(response, { status: 201 })
    
  } catch (error: any) {
    console.error('Error creating reservation:', error)
    
    // Manejar errores específicos
    if (error.message === 'Turno no disponible') {
      return NextResponse.json({
        success: false,
        error: 'El turno seleccionado ya no está disponible',
      }, { status: 409 })
    }
    
    if (error.name === 'ZodError') {
      return NextResponse.json({
        success: false,
        error: 'Datos de entrada inválidos',
        details: error.errors,
      }, { status: 400 })
    }
    
    // Error interno del servidor
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    }, { status: 500 })
  }
}

// Método OPTIONS para CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
} 