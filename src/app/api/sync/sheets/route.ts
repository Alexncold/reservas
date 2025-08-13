import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { Reserva } from '@/models/Reserva';
import dbConnect from '@/lib/db/mongodb';
import { toReservaDTO } from '@/lib/mapper';
import { Sheets } from '@/lib/sheets';

// Maximum number of days to sync in one request
const MAX_DAYS = 30;

export async function POST(request: Request) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    let days = 1; // Default to 1 day
    try {
      const body = await request.json();
      if (body.days && typeof body.days === 'number') {
        days = Math.min(Math.max(1, body.days), MAX_DAYS);
      }
    } catch (error) {
      // Use default if body parsing fails
    }

    // Connect to database
    await dbConnect();

    // Get reservations from the last N days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const reservas = await Reserva.find({
      updatedAt: { $gte: cutoffDate }
    }).sort({ updatedAt: -1 });

    // Convert to DTOs and sync
    const dtos = reservas.map(toReservaDTO);
    const result = await Sheets.batchUpsert(dtos);

    return NextResponse.json({
      success: true,
      stats: {
        total: reservas.length,
        ...result
      },
      syncedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to sync with Google Sheets',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Add OPTIONS handler for CORS preflight
// This is necessary for Vercel Cron to work
// @ts-ignore - This is a valid route handler
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
