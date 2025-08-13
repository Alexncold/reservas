# GameHub - Sistema de Reservas

## Visión General

GameHub es un sistema de gestión de reservas para salas de juegos de mesa que permite a los usuarios reservar mesas, realizar pagos en línea a través de MercadoPago, y recibir confirmaciones y recordatorios por WhatsApp.

## Características Principales

- **Reservas en Tiem Real**: Visualización de disponibilidad de mesas en tiempo real
- **Pagos Seguros**: Integración con MercadoPago Checkout Pro
- **Notificaciones Automáticas**: Confirmaciones y recordatorios vía WhatsApp Business API
- **Sincronización con Hojas de Cálculo**: Actualización automática de reservas en Google Sheets
- **Panel de Administración**: Gestión de reservas, usuarios y configuración
- **Monitoreo**: Métricas, alertas y registros en tiempo real

## Requisitos del Sistema

- Node.js 18+
- MongoDB 6.0+
- Cuenta de MercadoPago
- Cuenta de WhatsApp Business API (opcional)
- Cuenta de Google Cloud para Google Sheets API

## Estructura del Proyecto

```
gamehub-reservas/
├── src/
│   ├── app/                 # Rutas de la aplicación (Next.js 13+)
│   ├── components/          # Componentes React reutilizables
│   ├── lib/                 # Lógica de negocio y utilidades
│   ├── models/              # Modelos de base de datos (Mongoose)
│   └── styles/              # Estilos globales
├── public/                  # Archivos estáticos
├── tests/                   # Pruebas unitarias y de integración
└── docs/                    # Documentación del proyecto
```

## Guía de Inicio Rápido

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/tu-usuario/gamehub-reservas.git
   cd gamehub-reservas
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env.local
   # Editar .env.local con tus credenciales
   ```

4. **Iniciar servidor de desarrollo**
   ```bash
   npm run dev
   ```

5. **Abrir en el navegador**
   ```
   http://localhost:3000
   ```

## Documentación Adicional

- [Arquitectura del Sistema](./ARCHITECTURE.md)
- [Documentación de la API](./API.md)
- [Guía de Operaciones](./OPERATIONS.md)
- [Seguridad](./SECURITY.md)
- [Pruebas](./TESTING.md)
- [Historial de Versiones](./RELEASES.md)
- [Variables de Entorno](./ENV.md)

## Despliegue

Ver la guía de [Despliegue](./DEPLOYMENT.md) para instrucciones detalladas sobre cómo desplegar en diferentes entornos.

## Contribución

1. Haz un fork del repositorio
2. Crea una rama para tu característica (`git checkout -b feature/AmazingFeature`)
3. Haz commit de tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Haz push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

Distribuido bajo la licencia MIT. Ver `LICENSE` para más información.

## Contacto

Equipo de Desarrollo - [dev@gamehub.com](mailto:dev@gamehub.com)

Enlace del Proyecto: [https://github.com/tu-usuario/gamehub-reservas](https://github.com/tu-usuario/gamehub-reservas)
