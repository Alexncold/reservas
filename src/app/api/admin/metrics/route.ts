import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { alertManager } from '@/lib/alerting';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/metrics
 * Get application metrics and alerts
 */
export async function GET() {
  // Only allow admin users
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // Get alert status
    const alertStatus = alertManager.getStatus();
    
    // Get recent logs (in a real app, this would come from a log aggregation service)
    const recentLogs = logger.getLogs().slice(-100); // Last 100 logs
    
    // Get system metrics (simplified example)
    const metrics = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      // Add more metrics as needed
    };
    
    return NextResponse.json({
      status: 'ok',
      data: {
        alerts: alertStatus,
        logs: recentLogs,
        metrics,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to get metrics', error);
    return NextResponse.json(
      { status: 'error', message: 'Failed to get metrics' },
      { status: 500 }
    );
  }
}
