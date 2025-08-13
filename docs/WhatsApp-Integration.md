# WhatsApp Business API Integration

Esta documentación cubre la implementación de la integración con WhatsApp Business API para el sistema de reservas de GameHub.

## Tabla de Contenidos

- [Visión General](#visión-general)
- [Requisitos Previos](#requisitos-previos)
- [Configuración Inicial](#configuración-inicial)
- [Flujo de Notificaciones](#flujo-de-notificaciones)
- [Plantillas de Mensajes](#plantillas-de-mensajes)
- [Webhooks](#webhooks)
- [Manejo de Errores](#manejo-de-errores)
- [Pruebas](#pruebas)
- [Solución de Problemas](#solución-de-problemas)
- [Seguridad y Privacidad](#seguridad-y-privacidad)
- [Mantenimiento](#mantenimiento)

## Visión General

La integración con WhatsApp Business API permite enviar notificaciones automáticas a los clientes en diferentes etapas de su reserva, incluyendo:

- Confirmación de reserva pendiente de pago
- Confirmación de reserva exitosa
- Recordatorios 24 horas antes
- Recordatorios 2 horas antes
- Cancelaciones

## Requisitos Previos

1. Cuenta de desarrollador de Meta (Facebook Developer)
2. Aplicación de WhatsApp Business configurada
3. Número de teléfono empresarial verificado
4. Acceso al panel de WhatsApp Manager
5. Variables de entorno configuradas (ver `.env.example`)

## Configuración Inicial

### Variables de Entorno

Agregar al archivo `.env`:

```env
# WhatsApp Business API
WHATSAPP_BUSINESS_PHONE_ID=tu_phone_id
WHATSAPP_BUSINESS_ACCOUNT_ID=tu_business_account_id
WHATSAPP_TOKEN=tu_token_permanente
WHATSAPP_API_BASE=https://graph.facebook.com/v20.0
WHATSAPP_WEBHOOK_VERIFY_TOKEN=tu_token_secreto
NOTIFY_ENABLED=true

# Redis (para colas)
UPSTASH_REDIS_URL=url_de_tu_redis
```

### Script de Configuración

Ejecutar el script de configuración:

```bash
npm run setup:whatsapp
```

Seguir las instrucciones para configurar el webhook en el panel de desarrolladores de Meta.

## Flujo de Notificaciones

### 1. Reserva Creada (Pendiente de Pago)

- **Disparador**: Nueva reserva creada con estado "pendiente"
- **Plantilla**: `reserva_pendiente_v1`
- **Contenido**:
  ```
  ¡Hola {{1}}! Recibimos tu solicitud de reserva para el {{2}} en el turno {{3}} (mesa {{4}}).
  Por favor, completá el pago para confirmarla: {{5}}
  ```
- **Variables**:
  1. Nombre del cliente
  2. Fecha (formato: DD/MM/YYYY)
  3. Turno (ej: "19:00-21:00")
  4. Número de mesa
  5. URL de pago

### 2. Pago Aprobado (Reserva Confirmada)

- **Disparador**: Pago aprobado (webhook de MercadoPago)
- **Plantilla**: `reserva_confirmada_v1`
- **Contenido**:
  ```
  ¡Reserva confirmada, {{1}}! Te esperamos el {{2}} a las {{3}} (mesa {{4}}).
  Si no podés asistir, avisanos respondiendo a este mensaje.
  ```

### 3. Recordatorio 24 Horas Antes

- **Disparador**: 24 horas antes del turno
- **Plantilla**: `reserva_recordatorio_24h_v1`
- **Contenido**:
  ```
  Recordatorio: tu reserva es mañana {{1}} a las {{2}} (mesa {{3}}).
  ¿Seguís en pie? Respondé "OK" o "CANCELAR".
  ```

### 4. Recordatorio 2 Horas Antes

- **Disparador**: 2 horas antes del turno
- **Plantilla**: `reserva_recordatorio_2h_v1`
- **Contenido**:
  ```
  Faltan 2 horas para tu reserva de hoy {{1}} a las {{2}} (mesa {{3}}). ¡Te esperamos!
  ```

### 5. Reserva Cancelada

- **Disparador**: Reserva cancelada por el usuario o el sistema
- **Plantilla**: `reserva_cancelada_v1`
- **Contenido**:
  ```
  Lamentamos informarte que tu reserva del {{1}} a las {{2}} (mesa {{3}}) fue cancelada.
  Si necesitás reprogramar, escribinos por aquí.
  ```

## Webhooks

### Endpoint

```
POST /api/waba/webhook
```

### Eventos Manejados

1. **Verificación del Webhook** (GET)
   - Valida el token de verificación
   - Requerido por la API de WhatsApp

2. **Mensajes Entrantes**
   - Procesa respuestas de los clientes (ej: "OK", "CANCELAR")
   - Maneja solicitudes de baja ("STOP", "BAJA")

3. **Actualizaciones de Estado**
   - Entrega de mensajes
   - Mensajes leídos
   - Errores de entrega

## Manejo de Errores

### Reintentos Automáticos

- **Máximo de reintentos**: 5
- **Backoff exponencial**: 3s, 9s, 27s, 81s, 243s
- **Errores no recuperables**: No se reintentan (ej: número inválido)

### Monitoreo

Se registran los siguientes eventos:

- Envío exitoso
- Errores de entrega
- Reintentos
- Actualizaciones de estado
- Interacciones del usuario

## Pruebas

### Ambiente de Pruebas

1. Configurar número de prueba en el panel de desarrolladores
2. Usar el número de prueba proporcionado por WhatsApp
3. Verificar envío de mensajes en la pestaña "Webhooks"

### Casos de Prueba

1. Flujo completo de reserva
   - Creación
   - Pago
   - Recordatorios
   - Asistencia

2. Cancelación
   - Por el usuario
   - Por el sistema

3. Rechazo de pago
   - Reintento de pago
   - Vencimiento de reserva

## Seguridad y Privacidad

### Consentimiento

- Los usuarios deben dar su consentimiento explícito
- Opción de darse de baja en cualquier momento
- Almacenamiento seguro de preferencias

### Datos Personales

- Números de teléfono almacenados en formato E.164
- Historial de mensajes conservado por 90 días
- Sin almacenamiento de contenido sensible

## Mantenimiento

### Monitoreo

Revisar regularmente:

- Logs de errores
- Estado de las colas
- Uso de la API (cuotas)

### Actualizaciones

- Mantener actualizadas las dependencias
- Revisar cambios en la API de WhatsApp
- Actualizar plantillas según sea necesario

## Solución de Problemas

### Problemas Comunes

1. **Webhook no verificado**
   - Verificar el token de verificación
   - Asegurarse que la URL sea accesible desde internet

2. **Mensajes no entregados**
   - Verificar el formato del número de teléfono (E.164)
   - Comprobar el estado del número en WhatsApp Manager

3. **Errores de autenticación**
   - Verificar el token de acceso
   - Renovar el token si es necesario

### Soporte

Para problemas técnicos, contactar a:
- Equipo de desarrollo: dev@gamehub.com
- Soporte de WhatsApp Business: business.help.whatsapp.com
