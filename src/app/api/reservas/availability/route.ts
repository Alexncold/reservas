import { NextRequest, NextResponse } from 'next/server'
import { getAvailabilityByDate } from '@/lib/reservaService'
import { getAvailabilityFromSheets } from '@/lib/sheetsSync'
import { z } from 'zod'

const availabilityQuerySchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(['database', 'sheets']).optional().default('database'),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = Object.fromEntries(searchParams.entries())
    
    // Validar parámetros de consulta
    const validatedQuery = availabilityQuerySchema.parse(query)
    
    let availability: any
    
    // Obtener disponibilidad según la fuente especificada
    if (validatedQuery.source === 'sheets') {
      availability = await getAvailabilityFromSheets(validatedQuery.fecha)
    } else {
      availability = await getAvailabilityByDate(validatedQuery.fecha)
    }
    
    // Formatear respuesta
    const response = {
      success: true,
      data: {
        fecha: validatedQuery.fecha,
        availability,
        source: validatedQuery.source,
        timestamp: new Date().toISOString(),
      },
    }
    
    return NextResponse.json(response)
    
  } catch (error: any) {
    console.error('Error getting availability:', error)
    
    if (error.name === 'ZodError') {
      return NextResponse.json({
        success: false,
        error: 'Parámetros de consulta inválidos',
        details: error.errors,
      }, { status: 400 })
    }
    
    return NextResponse.json({
      success: false,
      error: 'Error al obtener disponibilidad',
    }, { status: 500 })
  }
}

// Método OPTIONS para CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
} 