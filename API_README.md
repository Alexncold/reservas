# GameHub Reservation API

API para el sistema de reservas de GameHub, que permite a los usuarios ver disponibilidad de mesas, realizar reservas y gestionar sus reservaciones.

## Documentación de la API

La documentación completa de la API está disponible en formato OpenAPI 3.0:
- [Documentación OpenAPI](./src/docs/openapi.json)

Puedes visualizar la documentación usando herramientas como:
- [Swagger UI](https://swagger.io/tools/swagger-ui/)
- [Redoc](https://github.com/Redocly/redoc)
- [Postman](https://www.postman.com/)

## Endpoints Principales

### 1. Verificar disponibilidad
```
GET /api/reservas/availability?fecha=2025-12-31&turno=19-21
```

### 2. Crear reserva
```
POST /api/reservas/create
```

### 3. Actualizar reserva
```
PUT /api/reservas/{id}
```

### 4. Cancelar reserva
```
DELETE /api/reservas/{id}
```

## Autenticación

La API utiliza autenticación JWT. Incluye el token en el header `Authorization` de tus peticiones:

```
Authorization: Bearer tu_token_jwt_aquí
```

## Manejo de Errores

La API devuelve códigos de estado HTTP estándar junto con un objeto JSON de error en caso de fallo:

```json
{
  "success": false,
  "error": "Mensaje descriptivo del error",
  "details": []
}
```

## Códigos de Estado

- `200 OK` - La solicitud se completó exitosamente
- `201 Created` - Recurso creado exitosamente
- `400 Bad Request` - Solicitud incorrecta o parámetros inválidos
- `401 Unauthorized` - Autenticación requerida
- `403 Forbidden` - No tienes permiso para realizar esta acción
- `404 Not Found` - Recurso no encontrado
- `409 Conflict` - Conflicto con el estado actual del recurso
- `423 Locked` - Recurso bloqueado temporalmente
- `500 Internal Server Error` - Error interno del servidor

## Ejemplos de Uso

### Crear una reserva

```http
POST /api/reservas/create
Content-Type: application/json
Authorization: Bearer tu_token_jwt

{
  "fecha": "2025-12-31",
  "turno": "19-21",
  "mesa": 1,
  "personas": 4,
  "cliente": {
    "nombre": "Juan Pérez",
    "email": "juan@example.com",
    "telefono": "+541112345678"
  },
  "notas": "Mesa cerca de la ventana"
}
```

### Respuesta exitosa

```json
{
  "success": true,
  "data": {
    "reserva": {
      "id": "507f1f77bcf86cd799439011",
      "fecha": "2025-12-31",
      "turno": "19-21",
      "mesa": 1,
      "personas": 4,
      "estado": "pendiente_pago",
      "montoTotal": "$4000.00"
    },
    "idempotencyKey": "abc123-def456-ghi789"
  },
  "message": "Reserva creada exitosamente"
}
```

## Configuración del Entorno

Copia el archivo `.env.example` a `.env` y configura las siguientes variables:

```
# Base de datos
MONGODB_URI=mongodb://localhost:27017/gamehub

# JWT
JWT_SECRET=tu_clave_secreta
JWT_EXPIRES_IN=1d

# Google Sheets
GOOGLE_SHEETS_CLIENT_EMAIL=tu-email@proyecto.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
SPREADSHEET_ID=tu-spreadsheet-id

# MercadoPago
MP_ACCESS_TOKEN=TU_ACCESS_TOKEN_DE_PRODUCCION
MP_PUBLIC_KEY=TU_PUBLIC_KEY

# Configuración de la aplicación
NODE_ENV=development
PORT=3000
```

## Instalación

1. Clona el repositorio
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Configura las variables de entorno
4. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

## Pruebas

Para ejecutar las pruebas unitarias:

```bash
npm test
```

## Despliegue

El proyecto está configurado para desplegarse en Vercel. Simplemente haz push a la rama `main` para desplegar automáticamente.

## Seguridad

- Todas las comunicaciones deben realizarse a través de HTTPS
- Nunca expongas las claves de API en el frontend
- Implementa rate limiting en producción
- Mantén las dependencias actualizadas

## Soporte

Para soporte, contacta a soporte@gamehub.com
