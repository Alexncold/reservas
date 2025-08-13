import { NextRequest, NextResponse } from 'next/server'
import { webhookService } from '@/services/webhookService'

export async function POST(request: NextRequest) {
  try {
    // Parsear el body como texto primero para validar la firma
    const body = await request.text();
    
    // Crear un objeto de respuesta de Next.js
    const response = {
      status: (status: number) => ({
        json: (data: any) => ({
          status,
          body: JSON.stringify(data),
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      }),
    };

    // Procesar la notificación con el servicio de webhook
    const result = await webhookService.handlePaymentNotification(
      {
        ...request,
        method: request.method,
        headers: {
          ...Object.fromEntries(request.headers.entries()),
          'x-signature': request.headers.get('x-signature') || '',
        },
        body: body ? JSON.parse(body) : {},
      } as any,
      response as any
    );

    return new NextResponse(result.body, {
      status: result.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error en el manejador del webhook:', error);
    return new NextResponse(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
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