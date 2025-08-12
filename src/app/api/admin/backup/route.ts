import { NextRequest, NextResponse } from 'next/server'
import { createBackup, createCSVBackup, cleanupOldBackups, getBackupStats } from '@/lib/backupService'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, format = 'json' } = body
    
    // Verificar autenticación básica (en producción usar NextAuth)
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const token = authHeader.split(' ')[1]
    if (token !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    let result: any
    
    switch (action) {
      case 'create':
        if (format === 'csv') {
          result = await createCSVBackup()
        } else {
          result = await createBackup()
        }
        return NextResponse.json({
          success: true,
          data: { filepath: result },
          message: `Backup ${format.toUpperCase()} creado exitosamente`,
        })
        
      case 'cleanup':
        const deletedCount = await cleanupOldBackups()
        return NextResponse.json({
          success: true,
          data: { deletedCount },
          message: `${deletedCount} backups antiguos eliminados`,
        })
        
      case 'stats':
        const stats = await getBackupStats()
        return NextResponse.json({
          success: true,
          data: stats,
        })
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Acción no válida',
        }, { status: 400 })
    }
    
  } catch (error: any) {
    console.error('Error in backup endpoint:', error)
    
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