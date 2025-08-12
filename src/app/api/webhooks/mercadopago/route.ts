import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { updateReservaStatus } from '@/lib/reservaService'
import { queueUpdate } from '@/lib/sheetsSync'
import { Reserva } from '@/lib/models/Reserva'
import dbConnect from '@/lib/db/mongodb'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-signature')
    
    // Verificar firma
    if (!signature) {
      console.error('Missing signature header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', process.env.MERCADOPAGO_WEBHOOK_SECRET!)
      .update(body)
      .digest('hex')
    
    if (signature !== expectedSignature) {
      console.error('Invalid signature')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Parsear el body
    const payload = JSON.parse(body)
    
    // Verificar que sea una notificación de pago
    if (payload.type !== 'payment') {
      return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 })
    }
    
    const paymentId = payload.data.id
    
    // Conectar a la base de datos
    await dbConnect()
    
    // Buscar reserva por idempotencyKey o paymentId
    const reserva = await Reserva.findOne({
      $or: [
        { idempotencyKey: paymentId },
        { 'pago.mercadopago_id': paymentId }
      ]
    })
    
    if (!reserva) {
      console.error('Reserva no encontrada para paymentId:', paymentId)
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
    }
    
    // Verificar si ya procesamos este pago
    if (reserva.pago?.mercadopago_id === paymentId) {
      console.log('Pago ya procesado:', paymentId)
      return NextResponse.json({ message: 'Pago ya procesado' }, { status: 200 })
    }
    
    // Obtener detalles del pago desde MercadoPago
    const mercadopago = require('mercadopago')
    mercadopago.configure({
      access_token: process.env.MERCADOPAGO_ACCESS_TOKEN!
    })
    
    const payment = await mercadopago.payment.get(paymentId)
    
    // Actualizar reserva según el estado del pago
    const pagoData = {
      mercadopago_id: paymentId,
      monto: payment.transaction_amount,
      estado: payment.status,
      fecha_pago: new Date(),
    }
    
    let nuevoEstado: 'pendiente_pago' | 'confirmada' | 'cancelada' = 'pendiente_pago'
    
    switch (payment.status) {
      case 'approved':
        nuevoEstado = 'confirmada'
        break
      case 'rejected':
      case 'cancelled':
        nuevoEstado = 'cancelada'
        break
      default:
        nuevoEstado = 'pendiente_pago'
    }
    
    // Actualizar reserva
    const reservaActualizada = await updateReservaStatus(
      reserva._id.toString(),
      nuevoEstado,
      pagoData
    )
    
    if (reservaActualizada) {
      // Agregar a la cola de sincronización
      queueUpdate(reservaActualizada)
    }
    
    console.log(`Pago ${paymentId} procesado. Estado: ${nuevoEstado}`)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Webhook procesado correctamente' 
    })
    
  } catch (error: any) {
    console.error('Error processing webhook:', error)
    
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
      'Access-Control-Allow-Headers': 'Content-Type, x-signature',
    },
  })
} 