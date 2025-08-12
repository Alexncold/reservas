# GameHub - Sistema de Reservas

Sistema web completo para la gestión de reservas de mesas en un local de juegos de mesa.

## 🎯 Características

- **Reservas Online**: Sistema simple y rápido para reservar mesas
- **Gestión de Turnos**: 3 turnos diarios (17-19h, 19-21h, 21-23h)
- **Múltiples Mesas**: 3 mesas disponibles, hasta 6 personas por mesa
- **Panel de Admin**: Gestión completa de reservas y pagos
- **Integración de Pagos**: MercadoPago para procesar pagos
- **Sincronización**: Google Sheets para backup y gestión
- **Lógica Anti-Double Booking**: Prevención de reservas duplicadas
- **Validación Robusta**: Esquemas Zod para validación de datos
- **Manejo de Timezones**: Soporte completo para Argentina
- **Sistema de Backup**: Exportación automática de datos

## 🚀 Desarrollo Local

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

El proyecto estará disponible en [http://localhost:3000](http://localhost:3000)

## 📋 Scripts Disponibles

- `npm run dev` - Servidor de desarrollo
- `npm run build` - Build de producción
- `npm run start` - Servidor de producción
- `npm run lint` - Verificar código con ESLint
- `npm run lint:fix` - Corregir errores de ESLint automáticamente
- `npm run prettier` - Formatear código con Prettier
- `npm run prettier:check` - Verificar formato de código
- `npm run type-check` - Verificar tipos de TypeScript
- `npm test` - Ejecutar tests
- `npm run test:watch` - Tests en modo watch
- `npm run test:coverage` - Tests con cobertura

## 🛠 Stack Tecnológico

- **Frontend**: Next.js 14 + React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Next.js API Routes (Serverless)
- **Database**: MongoDB Atlas
- **Deployment**: Vercel (Free Tier)
- **Pagos**: MercadoPago
- **Integración**: Google Sheets API
- **Validación**: Zod
- **Testing**: Jest
- **Fechas**: date-fns + date-fns-tz

## 📁 Estructura del Proyecto

```
src/
├── app/                 # App Router (Next.js 14)
│   ├── api/            # API Routes
│   │   ├── reservas/   # Endpoints de reservas
│   │   ├── webhooks/   # Webhooks de MercadoPago
│   │   └── admin/      # Endpoints de administración
│   ├── reservar/       # Página de reservas
│   └── admin/          # Panel de administración
├── components/         # Componentes React
│   ├── ui/            # Componentes base (Button, Input, etc.)
│   ├── layout/        # Componentes de layout
│   └── reservas/      # Componentes específicos de reservas
├── lib/               # Utilidades y configuraciones
│   ├── db/           # Configuración de base de datos
│   ├── models/       # Modelos de MongoDB
│   ├── __tests__/    # Tests unitarios
│   ├── utils.ts      # Funciones utilitarias
│   ├── constants.ts  # Constantes de la aplicación
│   ├── validations.ts # Validaciones
│   ├── schemas.ts    # Esquemas Zod
│   ├── reservaService.ts # Servicio de reservas
│   ├── sheetsSync.ts # Sincronización con Google Sheets
│   ├── dateUtils.ts  # Utilidades de fechas
│   └── backupService.ts # Servicio de backup
└── types/            # Definiciones de tipos TypeScript
```

## 🔧 Configuración

1. Copia el archivo `env.example` a `.env.local`
2. Configura las variables de entorno necesarias:
   - `MONGODB_URI`: Conexión a MongoDB Atlas
   - `MERCADOPAGO_ACCESS_TOKEN`: Token de MercadoPago
   - `MERCADOPAGO_WEBHOOK_SECRET`: Secreto para webhooks
   - `MERCADOPAGO_PUBLIC_KEY`: Clave pública de MercadoPago
   - `GOOGLE_SHEETS_PRIVATE_KEY`: Clave privada de Google Sheets
   - `GOOGLE_SHEETS_CLIENT_EMAIL`: Email del cliente de servicio
   - `SPREADSHEET_ID`: ID de la hoja de cálculo
   - `ADMIN_PASSWORD`: Contraseña del panel de administración
   - `TZ`: Timezone (America/Argentina/Buenos_Aires)
   - `BACKUP_RETENTION_DAYS`: Días de retención de backups
   - `SHEETS_SYNC_BATCH_SIZE`: Tamaño de batch para sincronización
   - `SHEETS_SYNC_DELAY_MS`: Delay entre sincronizaciones
   - `SHEETS_CACHE_TTL_MS`: TTL del cache de disponibilidad

## 📝 Información del Negocio

- **Cliente**: Local de juegos de mesa
- **Producto**: Sistema web para reservar mesas por turnos de 2 horas
- **Recursos**: 3 mesas, máx 6 personas c/u
- **Horarios**: 17-19h/19-21h/21-23h, jueves a domingo
- **Precio**: $3.000 por persona por turno

## 🚧 Estado del Proyecto

Este es el **Prompt 2** de una serie de 17 que completarán todo el proyecto.

### ✅ Completado en este prompt:
- ✅ **Lógica Anti-Double Booking**: Prevención de reservas duplicadas
- ✅ **Modelos de MongoDB**: Esquemas con índices optimizados
- ✅ **Validación con Zod**: Esquemas robustos para todos los datos
- ✅ **Sincronización Google Sheets**: Con rate limiting y cache
- ✅ **Webhook MercadoPago**: Con validación de firma e idempotencia
- ✅ **Manejo de Timezones**: Soporte completo para Argentina
- ✅ **Sistema de Backup**: Exportación JSON y CSV
- ✅ **Tests Unitarios**: Cobertura de funciones críticas
- ✅ **APIs Robustas**: Endpoints con manejo de errores
- ✅ **Configuración Avanzada**: Variables de entorno completas

### 🔄 Próximos pasos:
- Prompt 3: Frontend de reservas completo
- Prompt 4: Integración con MercadoPago Checkout Pro
- Prompt 5: Panel de administración
- Y más...

## 🔒 Características de Seguridad

- **Transacciones Atómicas**: MongoDB sessions para consistencia
- **Validación de Firma**: Webhooks de MercadoPago seguros
- **Idempotencia**: Prevención de procesamiento duplicado
- **Rate Limiting**: Protección contra abuso de APIs
- **Validación de Datos**: Esquemas Zod estrictos
- **Manejo de Errores**: Logging y recuperación robusta

## 📊 APIs Disponibles

### Reservas
- `POST /api/reservas/create` - Crear nueva reserva
- `GET /api/reservas/availability` - Obtener disponibilidad

### Webhooks
- `POST /api/webhooks/mercadopago` - Webhook de MercadoPago

### Administración
- `POST /api/admin/backup` - Gestión de backups

## 🧪 Testing

```bash
# Ejecutar todos los tests
npm test

# Tests en modo watch
npm run test:watch

# Tests con cobertura
npm run test:coverage
```

## 📄 Licencia

Este proyecto es privado y está desarrollado específicamente para GameHub.
