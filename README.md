# GameHub - Sistema de Reservas

Sistema web completo para la gestión de reservas de mesas en un local de juegos de mesa.

## 🎯 Características

- **Reservas Online**: Sistema simple y rápido para reservar mesas
- **Gestión de Turnos**: 3 turnos diarios (17-19h, 19-21h, 21-23h)
- **Múltiples Mesas**: 3 mesas disponibles, hasta 6 personas por mesa
- **Panel de Admin**: Gestión completa de reservas y pagos
- **Integración de Pagos**: MercadoPago para procesar pagos
- **Sincronización**: Google Sheets para backup y gestión

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

## 🛠 Stack Tecnológico

- **Frontend**: Next.js 14 + React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Next.js API Routes (Serverless)
- **Database**: MongoDB Atlas
- **Deployment**: Vercel (Free Tier)
- **Pagos**: MercadoPago
- **Integración**: Google Sheets API

## 📁 Estructura del Proyecto

```
src/
├── app/                 # App Router (Next.js 14)
│   ├── api/            # API Routes
│   ├── reservar/       # Página de reservas
│   └── admin/          # Panel de administración
├── components/         # Componentes React
│   ├── ui/            # Componentes base (Button, Input, etc.)
│   ├── layout/        # Componentes de layout
│   └── reservas/      # Componentes específicos de reservas
├── lib/               # Utilidades y configuraciones
│   ├── db/           # Configuración de base de datos
│   ├── utils.ts      # Funciones utilitarias
│   ├── constants.ts  # Constantes de la aplicación
│   └── validations.ts # Validaciones
└── types/            # Definiciones de tipos TypeScript
```

## 🔧 Configuración

1. Copia el archivo `env.example` a `.env.local`
2. Configura las variables de entorno necesarias:
   - `MONGODB_URI`: Conexión a MongoDB Atlas
   - `MERCADOPAGO_ACCESS_TOKEN`: Token de MercadoPago
   - `GOOGLE_SHEETS_PRIVATE_KEY`: Clave privada de Google Sheets
   - `ADMIN_PASSWORD`: Contraseña del panel de administración

## 📝 Información del Negocio

- **Cliente**: Local de juegos de mesa
- **Producto**: Sistema web para reservar mesas por turnos de 2 horas
- **Recursos**: 3 mesas, máx 6 personas c/u
- **Horarios**: 17-19h/19-21h/21-23h, jueves a domingo
- **Precio**: $3.000 por persona por turno

## 🚧 Estado del Proyecto

Este es el **Prompt 1** de una serie de 17 que completarán todo el proyecto.

### ✅ Completado en este prompt:
- ✅ Proyecto Next.js 14 con TypeScript
- ✅ Configuración de Tailwind CSS
- ✅ Estructura de carpetas profesional
- ✅ Componentes UI base
- ✅ Layout y navegación
- ✅ Homepage responsive
- ✅ Configuración de ESLint y Prettier
- ✅ Variables de entorno template

### 🔄 Próximos pasos:
- Prompt 2: Conexión a MongoDB y modelos
- Prompt 3: APIs de reservas
- Prompt 4: Sistema de reservas completo
- Y más...

## 📄 Licencia

Este proyecto es privado y está desarrollado específicamente para GameHub.
