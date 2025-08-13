#!/usr/bin/env node
import mongoose from 'mongoose';
import { dbConnect } from '../src/lib/db';
import { logger } from '../src/lib/logger';

async function setupIndexes() {
  try {
    logger.info('Connecting to database...');
    await dbConnect();
    const db = mongoose.connection.db;

    logger.info('Setting up indexes...');

    // 1. Reservas collection
    await db.collection('reservas').createIndexes([
      // For availability queries
      { 
        key: { fecha: 1, turno: 1, 'mesa.numero': 1 },
        name: 'idx_availability',
        partialFilterExpression: { activo: true }
      },
      // For atomic reservation creation
      {
        key: { fecha: 1, turno: 1, 'mesa.numero': 1, activo: 1 },
        name: 'idx_reservation_unique',
        unique: true,
        partialFilterExpression: { activo: true }
      },
      // For TTL on pending payments
      {
        key: { createdAt: 1 },
        name: 'idx_ttl_pending',
        expireAfterSeconds: 15 * 60, // 15 minutes
        partialFilterExpression: { 
          estado: 'pendiente',
          'pago.estado': 'pending'
        }
      }
    ]);

    // 2. Notifications collection
    await db.collection('notifications').createIndexes([
      { key: { reservaId: 1 }, name: 'idx_notification_reserva' },
      { key: { status: 1 }, name: 'idx_notification_status' },
      { key: { to: 1 }, name: 'idx_notification_to' },
      { key: { scheduledFor: 1 }, name: 'idx_notification_scheduled' },
      { key: { idempotencyKey: 1 }, unique: true, name: 'idx_notification_idempotency' }
    ]);

    // 3. Customers collection
    await db.collection('customers').createIndexes([
      { key: { phoneE164: 1 }, unique: true, name: 'idx_customer_phone' },
      { key: { email: 1 }, unique: true, sparse: true, name: 'idx_customer_email' },
      { 
        key: { whatsappConsent: 1, lastNotifiedAt: 1 },
        name: 'idx_customer_notifications'
      }
    ]);

    // 4. Notification logs TTL (90 days)
    await db.collection('notification_logs').createIndex(
      { createdAt: 1 },
      {
        name: 'idx_notification_logs_ttl',
        expireAfterSeconds: 90 * 24 * 60 * 60 // 90 days in seconds
      }
    );

    logger.info('✅ Database indexes created successfully');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Failed to create database indexes', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Run the setup
setupIndexes();
