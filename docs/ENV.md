# Variables de Entorno GameHub

## Configuración Base

| Variable | Requerido | Valor por Defecto | Descripción |
|----------|-----------|-------------------|-------------|
| `NODE_ENV` | No | `development` | Entorno de ejecución (`development`, `test`, `production`) |
| `PORT` | No | `3000` | Puerto del servidor |
| `BASE_URL` | Sí | `http://localhost:3000` | URL base de la aplicación |

## Base de Datos

| Variable | Requerido | Valor por Defecto | Descripción |
|----------|-----------|-------------------|-------------|
| `MONGODB_URI` | Sí | - | URI de conexión a MongoDB |
| `DB_NAME` | No | `gamehub` | Nombre de la base de datos |
| `DB_USER` | Depende | - | Usuario de la base de datos |
| `DB_PASSWORD` | Depende | - | Contraseña de la base de datos |

## Autenticación

| Variable | Requerido | Valor por Defecto | Descripción |
|----------|-----------|-------------------|-------------|
| `NEXTAUTH_SECRET` | Sí | - | Secreto para firmar tokens JWT |
| `NEXTAUTH_URL` | Sí | - | URL base de autenticación |
| `JWT_SECRET` | Sí | - | Secreto para firmar tokens JWT |
| `JWT_EXPIRES_IN` | No | `1h` | Tiempo de expiración del token |

## MercadoPago

| Variable | Requerido | Valor por Defecto | Descripción |
|----------|-----------|-------------------|-------------|
| `MP_ACCESS_TOKEN` | Sí | - | Token de acceso de MercadoPago |
| `MP_PUBLIC_KEY` | Sí | - | Clave pública de MercadoPago |
| `MP_WEBHOOK_SECRET` | Sí | - | Secreto para validar webhooks |
| `MP_SUCCESS_URL` | No | `${BASE_URL}/reserva/exito` | URL de éxito de pago |
| `MP_FAILURE_URL` | No | `${BASE_URL}/reserva/error` | URL de fallo de pago |
| `MP_PENDING_URL` | No | `${BASE_URL}/reserva/pendiente` | URL de pago pendiente |

## WhatsApp Business API

| Variable | Requerido | Valor por Defecto | Descripción |
|----------|-----------|-------------------|-------------|
| `WHATSAPP_TOKEN` | Sí | - | Token de acceso a WhatsApp Business API |
| `WHATSAPP_PHONE_NUMBER_ID` | Sí | - | ID del número de teléfono |
| `WHATSAPP_WEBHOOK_SECRET` | Sí | - | Secreto para validar webhooks |

## Google Sheets

| Variable | Requerido | Valor por Defecto | Descripción |
|----------|-----------|-------------------|-------------|
| `GOOGLE_SHEETS_CREDENTIALS` | Sí | - | JSON de credenciales de Google Cloud |
| `GOOGLE_SHEET_ID` | Sí | - | ID de la hoja de cálculo |
| `GOOGLE_SHEET_RANGE` | No | `'Reservas'!A:Z` | Rango de celdas a actualizar |

## Monitoreo y Logs

| Variable | Requerido | Valor por Defecto | Descripción |
|----------|-----------|-------------------|-------------|
| `SENTRY_DSN` | No | - | DSN para enviar errores a Sentry |
| `LOG_LEVEL` | No | `info` | Nivel de logs (`error`, `warn`, `info`, `debug`) |
| `NODE_ENV` | No | `development` | Define el entorno de ejecución |

## Configuración de Correo

| Variable | Requerido | Valor por Defecto | Descripción |
|----------|-----------|-------------------|-------------|
| `EMAIL_SERVER` | No | - | URL del servidor SMTP |
| `EMAIL_FROM` | No | - | Dirección de correo remitente |
| `EMAIL_USER` | No | - | Usuario SMTP |
| `EMAIL_PASSWORD` | No | - | Contraseña SMTP |

## Configuración de la Aplicación

| Variable | Requerido | Valor por Defecto | Descripción |
|----------|-----------|-------------------|-------------|
| `RESERVATION_TIMEOUT_MINUTES` | No | `15` | Tiempo de espera para pagos pendientes |
| `MAX_TABLES_PER_RESERVATION` | No | `3` | Máximo de mesas por reserva |
| `MAINTENANCE_MODE` | No | `false` | Habilita el modo mantenimiento |
| `ALLOW_REGISTRATION` | No | `true` | Permite registro de nuevos usuarios |

## Configuración de Seguridad

| Variable | Requerido | Valor por Defecto | Descripción |
|----------|-----------|-------------------|-------------|
| `CORS_ORIGIN` | No | `*` | Orígenes permitidos para CORS |
| `RATE_LIMIT_WINDOW` | No | `15` | Ventana de tiempo para rate limiting (minutos) |
| `RATE_LIMIT_MAX` | No | `100` | Máximo de peticiones por ventana |
| `TRUST_PROXY` | No | `false` | Confiar en cabeceras de proxy |

## Configuración para Desarrollo

| Variable | Requerido | Valor por Defecto | Descripción |
|----------|-----------|-------------------|-------------|
| `DEBUG` | No | - | Habilita modo debug |
| `SEED_DATABASE` | No | `false` | Poblar base de datos con datos de prueba |
| `DISABLE_AUTH` | No | `false` | Desactiva autenticación (solo desarrollo) |

## Ejemplo de Archivo .env

```env
# Configuración Base
NODE_ENV=development
PORT=3000
BASE_URL=http://localhost:3000

# Base de Datos
MONGODB_URI=mongodb://localhost:27017/gamehub

# Autenticación
NEXTAUTH_SECRET=tu_secreto_seguro
NEXTAUTH_URL=http://localhost:3000
JWT_SECRET=otro_secreto_seguro

# MercadoPago
MP_ACCESS_TOKEN=TEST-1234567890
MP_PUBLIC_KEY=TEST-1234567890
MP_WEBHOOK_SECRET=secreto_webhook

# WhatsApp
WHATSAPP_TOKEN=tu_token_waba
WHATSAPP_PHONE_NUMBER_ID=1234567890

# Google Sheets
GOOGLE_SHEETS_CREDENTIALS={"type": "service_account", ...}
GOOGLE_SHEET_ID=1234567890

# Monitoreo
SENTRY_DSN=tu_dsn_sentry
LOG_LEVEL=debug

# Configuración
RESERVATION_TIMEOUT_MINUTES=15
MAX_TABLES_PER_RESERVATION=3
MAINTENANCE_MODE=false
```

## Notas de Seguridad

1. **Nunca** subas el archivo `.env` al control de versiones
2. Usa `.env.example` como plantilla
3. Las variables sensibles deben manejarse a través del sistema de secretos de tu plataforma de despliegue
4. Rota los secretos regularmente
5. Usa permisos mínimos necesarios para las credenciales de base de datos

## Variables por Entorno

### Desarrollo
- `NODE_ENV=development`
- `LOG_LEVEL=debug`
- `DISABLE_AUTH=true` (opcional)

### Producción
- `NODE_ENV=production`
- `LOG_LEVEL=warn`
- `NODE_OPTIONS=--max-old-space-size=1536`

### Testing
- `NODE_ENV=test`
- `MONGODB_URI=mongodb://localhost:27017/gamehub_test`
- `DISABLE_LOGS=true`
