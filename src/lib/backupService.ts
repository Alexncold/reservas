import { Reserva } from './models/Reserva'
import dbConnect from './db/mongodb'
import { formatDateForSheets } from './dateUtils'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

interface BackupConfig {
  retentionDays: number
  backupDir: string
}

const DEFAULT_CONFIG: BackupConfig = {
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
  backupDir: './backups',
}

// Crear backup de todas las reservas
export async function createBackup(): Promise<string> {
  try {
    await dbConnect()
    
    // Obtener todas las reservas
    const reservas = await Reserva.find({}).sort({ created_at: -1 })
    
    // Crear directorio de backups si no existe
    if (!existsSync(DEFAULT_CONFIG.backupDir)) {
      mkdirSync(DEFAULT_CONFIG.backupDir, { recursive: true })
    }
    
    // Generar nombre de archivo con timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `reservas-backup-${timestamp}.json`
    const filepath = join(DEFAULT_CONFIG.backupDir, filename)
    
    // Preparar datos para backup
    const backupData = {
      timestamp: new Date().toISOString(),
      totalReservas: reservas.length,
      reservas: reservas.map(reserva => ({
        id: reserva._id,
        fecha: reserva.fecha,
        turno: reserva.turno,
        mesa: reserva.mesa,
        personas: reserva.personas,
        juego: reserva.juego,
        cliente: reserva.cliente,
        estado: reserva.estado,
        pago: reserva.pago,
        idempotencyKey: reserva.idempotencyKey,
        created_at: reserva.created_at,
        updated_at: reserva.updated_at,
      })),
    }
    
    // Escribir archivo de backup
    writeFileSync(filepath, JSON.stringify(backupData, null, 2))
    
    console.log(`Backup creado: ${filepath} (${reservas.length} reservas)`)
    
    return filepath
    
  } catch (error) {
    console.error('Error creating backup:', error)
    throw error
  }
}

// Crear backup en formato CSV para Google Sheets
export async function createCSVBackup(): Promise<string> {
  try {
    await dbConnect()
    
    // Obtener todas las reservas
    const reservas = await Reserva.find({}).sort({ created_at: -1 })
    
    // Crear directorio de backups si no existe
    if (!existsSync(DEFAULT_CONFIG.backupDir)) {
      mkdirSync(DEFAULT_CONFIG.backupDir, { recursive: true })
    }
    
    // Generar nombre de archivo con timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `reservas-backup-${timestamp}.csv`
    const filepath = join(DEFAULT_CONFIG.backupDir, filename)
    
    // Crear headers CSV
    const headers = [
      'ID',
      'Fecha',
      'Turno',
      'Mesa',
      'Personas',
      'Juego',
      'Nombre Cliente',
      'Email Cliente',
      'Teléfono Cliente',
      'Estado',
      'MercadoPago ID',
      'Monto',
      'Estado Pago',
      'Fecha Pago',
      'Fecha Creación',
      'Fecha Actualización',
    ]
    
    // Crear filas CSV
    const rows = reservas.map(reserva => [
      reserva._id,
      reserva.fecha,
      reserva.turno,
      reserva.mesa,
      reserva.personas,
      reserva.juego || '',
      reserva.cliente.nombre,
      reserva.cliente.email,
      reserva.cliente.telefono,
      reserva.estado,
      reserva.pago?.mercadopago_id || '',
      reserva.pago?.monto || '',
      reserva.pago?.estado || '',
      reserva.pago?.fecha_pago ? formatDateForSheets(reserva.pago.fecha_pago) : '',
      formatDateForSheets(reserva.created_at),
      formatDateForSheets(reserva.updated_at),
    ])
    
    // Crear contenido CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n')
    
    // Escribir archivo CSV
    writeFileSync(filepath, csvContent, 'utf8')
    
    console.log(`CSV Backup creado: ${filepath} (${reservas.length} reservas)`)
    
    return filepath
    
  } catch (error) {
    console.error('Error creating CSV backup:', error)
    throw error
  }
}

// Limpiar backups antiguos
export async function cleanupOldBackups(): Promise<number> {
  try {
    const fs = require('fs')
    const path = require('path')
    
    if (!existsSync(DEFAULT_CONFIG.backupDir)) {
      return 0
    }
    
    const files = fs.readdirSync(DEFAULT_CONFIG.backupDir)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - DEFAULT_CONFIG.retentionDays)
    
    let deletedCount = 0
    
    for (const file of files) {
      const filepath = join(DEFAULT_CONFIG.backupDir, file)
      const stats = fs.statSync(filepath)
      
      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(filepath)
        deletedCount++
        console.log(`Backup eliminado: ${file}`)
      }
    }
    
    console.log(`Limpieza completada: ${deletedCount} archivos eliminados`)
    
    return deletedCount
    
  } catch (error) {
    console.error('Error cleaning up old backups:', error)
    throw error
  }
}

// Obtener estadísticas de backup
export async function getBackupStats() {
  try {
    const fs = require('fs')
    const path = require('path')
    
    if (!existsSync(DEFAULT_CONFIG.backupDir)) {
      return {
        totalBackups: 0,
        totalSize: 0,
        oldestBackup: null,
        newestBackup: null,
      }
    }
    
    const files = fs.readdirSync(DEFAULT_CONFIG.backupDir)
    const backupFiles = files.filter((file: string) => file.endsWith('.json') || file.endsWith('.csv'))
    
    let totalSize = 0
    let oldestBackup = null
    let newestBackup = null
    
    for (const file of backupFiles) {
      const filepath = join(DEFAULT_CONFIG.backupDir, file)
      const stats = fs.statSync(filepath)
      
      totalSize += stats.size
      
      if (!oldestBackup || stats.mtime < oldestBackup.mtime) {
        oldestBackup = { file, mtime: stats.mtime }
      }
      
      if (!newestBackup || stats.mtime > newestBackup.mtime) {
        newestBackup = { file, mtime: stats.mtime }
      }
    }
    
    return {
      totalBackups: backupFiles.length,
      totalSize,
      oldestBackup: oldestBackup?.file,
      newestBackup: newestBackup?.file,
      retentionDays: DEFAULT_CONFIG.retentionDays,
    }
    
  } catch (error) {
    console.error('Error getting backup stats:', error)
    throw error
  }
} 