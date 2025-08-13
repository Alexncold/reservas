# WhatsApp Business API Integration Plan

Este documento describe el plan para integrar WhatsApp Business API en el sistema de reservas de GameHub.

## Objetivos

1. Enviar confirmaciones de reserva por WhatsApp
2. Recordatorios de reservas próximas
3. Notificaciones de estado de pago
4. Soporte al cliente en tiempo real
5. Encuestas de satisfacción post-reserva

## Requisitos Previos

- Cuenta de WhatsApp Business API aprobada
- Número de teléfono empresarial verificado
- Credenciales de API de WhatsApp
- Servidor con IP fija y SSL configurado

## Flujos de Mensajería

### 1. Confirmación de Reserva
```
[Automático] ¡Hola {nombre}! Tu reserva en GameHub para el {fecha} a las {hora} ha sido confirmada. Nº de reserva: {id}
```

### 2. Recordatorio 24h Antes
```
[Recordatorio] Recuerda tu reserva mañana a las {hora} en GameHub. Responde CANCELAR para cancelar.
```

### 3. Notificación de Pago
```
[Pago] Tu pago de ${monto} por la reserva #{id} ha sido procesado exitosamente. ¡Te esperamos!
```

### 4. Encuesta Post-Reserva
```
[Opinión] ¿Cómo calificarías tu experiencia en GameHub? Responde con un número del 1 al 5.
```

## Implementación Técnica

### 1. Configuración Inicial
```typescript
// config/whatsapp.ts
export const whatsappConfig = {
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  apiVersion: 'v17.0',
  webhookSecret: process.env.WHATSAPP_WEBHOOK_SECRET,
  templates: {
    reservationConfirmation: 'reservation_confirmation',
    paymentReminder: 'payment_reminder',
    satisfactionSurvey: 'satisfaction_survey'
  }
};
```

### 2. Servicio de Mensajería
```typescript
// services/whatsappService.ts
import axios from 'axios';
import { whatsappConfig } from '../config/whatsapp';
import { logger } from '../lib/logger';

export class WhatsAppService {
  private static instance: WhatsAppService;
  private baseUrl = `https://graph.facebook.com/${whatsappConfig.apiVersion}/${whatsappConfig.phoneNumberId}/messages`;

  static getInstance(): WhatsAppService {
    if (!WhatsAppService.instance) {
      WhatsAppService.instance = new WhatsAppService();
    }
    return WhatsAppService.instance;
  }

  async sendTemplateMessage(to: string, templateName: string, language: string, components?: any[]) {
    try {
      const response = await axios.post(
        this.baseUrl,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: language }
          },
          ...(components && { components })
        },
        {
          headers: {
            'Authorization': `Bearer ${whatsappConfig.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      logger.info('Mensaje de WhatsApp enviado', { to, templateName, messageId: response.data.messages[0].id });
      return response.data;
    } catch (error) {
      logger.error('Error enviando mensaje de WhatsApp', { error, to, templateName });
      throw error;
    }
  }

  // Métodos específicos para cada tipo de mensaje
  async sendReservationConfirmation(reserva: IReserva) {
    const { cliente, _id, fecha, turno } = reserva;
    return this.sendTemplateMessage(
      cliente.telefono,
      whatsappConfig.templates.reservationConfirmation,
      'es',
      [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: cliente.nombre },
            { type: 'text', text: fecha },
            { type: 'text', text: turno },
            { type: 'text', text: _id }
          ]
        }
      ]
    );
  }
}

export const whatsappService = WhatsAppService.getInstance();
```

### 3. Webhook para Recepción de Mensajes
```typescript
// pages/api/webhooks/whatsapp.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { whatsappConfig } from '../../../config/whatsapp';
import { whatsappService } from '../../../services/whatsappService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verificar firma del webhook
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === whatsappConfig.webhookSecret) {
      return res.status(200).send(challenge);
    }
    
    return res.status(403).json({ error: 'Token de verificación inválido' });
  }

  // Procesar actualizaciones
  if (req.method === 'POST') {
    try {
      // Validar firma del webhook
      const signature = req.headers['x-hub-signature-256'];
      if (!verifySignature(signature, JSON.stringify(req.body))) {
        return res.status(401).json({ error: 'Firma no válida' });
      }

      const { entry } = req.body;
      
      // Procesar cada entrada
      for (const entryItem of entry) {
        for (const change of entryItem.changes) {
          if (change.value.messages) {
            for (const message of change.value.messages) {
              await processIncomingMessage(message);
            }
          }
        }
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error procesando webhook de WhatsApp:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

async function processIncomingMessage(message: any) {
  const { from, text, type } = message;
  
  // Procesar según el tipo de mensaje
  switch (type) {
    case 'text':
      await handleTextMessage(from, text.body);
      break;
    case 'button_reply':
      await handleButtonReply(from, text.id, text.title);
      break;
    // Manejar otros tipos de mensajes (imágenes, ubicación, etc.)
  }
}
```

## Plan de Implementación

### Fase 1: Configuración Inicial (Semana 1)
- [ ] Registrar número de teléfono en WhatsApp Business
- [ ] Configurar webhook en el servidor
- [ ] Implementar verificación de webhook
- [ ] Configurar plantillas de mensajes en WhatsApp Business

### Fase 2: Mensajería Básica (Semana 2)
- [ ] Envío de confirmación de reserva
- [ ] Recordatorio 24h antes
- [ ] Notificación de estado de pago
- [ ] Manejo de respuestas automáticas

### Fase 3: Interacciones Avanzadas (Semana 3)
- [ ] Encuestas de satisfacción
- [ ] Soporte al cliente con IA
- [ ] Análisis de sentimiento en respuestas
- [ ] Integración con CRM

### Fase 4: Pruebas y Lanzamiento (Semana 4)
- [ ] Pruebas de carga
- [ ] Pruebas de usabilidad
- [ ] Documentación para el equipo
- [ ] Lanzamiento controlado

## Consideraciones de Seguridad

1. **Validación de Entrada**: Validar todos los datos recibidos del webhook
2. **Autenticación**: Usar firma HMAC para verificar las solicitudes
3. **Protección de Datos**: No almacenar mensajes innecesariamente
4. **Cumplimiento**: Asegurar el cumplimiento con las políticas de WhatsApp
5. **Logging**: Registrar todas las interacciones con propósitos de auditoría

## Monitoreo y Mantenimiento

1. **Métricas Clave**:
   - Tasa de entrega de mensajes
   - Tiempo de respuesta promedio
   - Satisfacción del cliente

2. **Alertas**:
   - Errores en el envío de mensajes
   - Caídas del servicio
   - Comportamiento inusual

3. **Mantenimiento**:
   - Actualizaciones de la API
   - Actualización de plantillas
   - Escalado de infraestructura

## Recursos Adicionales

- [Documentación Oficial de WhatsApp Business API](https://developers.facebook.com/docs/whatsapp/)
- [Guía de Mejores Prácticas](https://developers.facebook.com/docs/whatsapp/best-practices)
- [Políticas de WhatsApp Business](https://www.whatsapp.com/legal/business-policy/)

## Soporte

Para soporte técnico, contactar a:
- Email: soporte@gamehub.com
- Teléfono: +54 11 1234-5678
- Horario de atención: Lunes a Viernes de 9 a 18hs
