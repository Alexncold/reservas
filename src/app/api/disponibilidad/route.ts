import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/middleware/security';
import { withCache } from '@/lib/cache';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { Reserva } from '@/models/Reserva';
import { connectToDatabase } from '@/lib/db';

// Schema for query parameters
const querySchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  turno: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
});

/**
 * GET /api/disponibilidad
 * Get available tables for a specific date and time slot
 */
export const GET = withSecurity(async (req: NextRequest) => {
  // Use the cache wrapper
  return withCache(handleAvailability, req, { ttl: 30 }); // Cache for 30 seconds
});

// Actual handler function that gets wrapped with caching
async function handleAvailability(req: NextRequest): Promise<NextResponse> {
  try {
    // Parse and validate query parameters
    const { searchParams } = new URL(req.url);
    const query = Object.fromEntries(searchParams.entries());
    
    const validation = querySchema.safeParse(query);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: validation.error.format() },
        { status: 400 }
      );
    }
    
    const { fecha, turno } = validation.data;
    
    // Connect to database
    await connectToDatabase();
    
    // Find all active reservations for the given date and time slot
    const reservas = await Reserva.find({
      fecha: new Date(fecha),
      turno,
      activo: true,
      estado: { $in: ['pendiente', 'confirmada'] },
    }).select('mesa');
    
    // Get all tables (assuming we have 10 tables)
    const totalTables = 10;
    const reservedTables = new Set(reservas.map(r => r.mesa.numero));
    const availableTables = [];
    
    for (let i = 1; i <= totalTables; i++) {
      if (!reservedTables.has(i)) {
        availableTables.push({
          numero: i,
          capacidad: i <= 4 ? 4 : 6, // Example: tables 1-4 seat 4, 5-10 seat 6
        });
      }
    }
    
    logger.info('Checked availability', { fecha, turno, available: availableTables.length });
    
    return NextResponse.json({
      fecha,
      turno,
      mesasDisponibles: availableTables,
      totalMesas: totalTables,
      mesasOcupadas: reservas.length,
    });
    
  } catch (error) {
    logger.error('Error checking availability', {
      error: error.message,
      stack: error.stack,
      url: req.url,
    });
    
    return NextResponse.json(
      { error: 'Error al verificar disponibilidad' },
      { status: 500 }
    );
  }
}
