import { NextResponse } from 'next/server';
import { Reserva } from '@/models/Reserva';
import dbConnect from '@/lib/db/mongodb';
import { toReservaDTO } from '@/lib/mapper';
import { Sheets } from '@/lib/sheets';

// This is the secret defined in Vercel environment variables
const CRON_SECRET = process.env.CRON_SECRET;

// Maximum days to look back for reconciliation
const MAX_RECONCILE_DAYS = 7;

export async function GET(request: Request) {
  try {
    // Verify the request is coming from Vercel Cron
    const authHeader = request.headers.get('authorization');
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
      console.error('Unauthorized cron request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Connect to database
    await dbConnect();

    // Get reservations updated in the last MAX_RECONCILE_DAYS days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - MAX_RECONCILE_DAYS);

    const reservas = await Reserva.find({
      updatedAt: { $gte: cutoffDate }
    }).sort({ updatedAt: -1 });

    // Convert to DTOs and sync
    const dtos = reservas.map(toReservaDTO);
    const result = await Sheets.batchUpsert(dtos);

    // Log the sync result
    console.log('Daily sync completed:', {
      total: reservas.length,
      ...result,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      stats: {
        total: reservas.length,
        ...result
      },
      syncedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to run daily sync',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
