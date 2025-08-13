# Documentación de la API GameHub

## Autenticación

La API utiliza JWT para autenticación. Inclya el token en el encabezado `Authorization`:

```
Authorization: Bearer <token>
```

## Endpoints Públicos

### Consultar Disponibilidad

```http
GET /api/disponibilidad
```

**Parámetros de consulta:**
- `fecha` (requerido): Fecha en formato YYYY-MM-DD
- `turno` (opcional): 'tarde' o 'noche'

**Ejemplo de respuesta exitosa (200 OK):**
```json
{
  "fecha": "2025-08-15",
  "turno": "tarde",
  "mesasDisponibles": ["Mesa 1", "Mesa 2", "Mesa 4"],
  "capacidadTotal": 12,
  "capacidadDisponible": 8
}
```

### Crear Reserva

```http
POST /api/reservas
```

**Cuerpo de la solicitud:**
```json
{
  "fecha": "2025-08-15",
  "turno": "tarde",
  "mesaId": "mesa_123",
  "cliente": {
    "nombre": "Juan Pérez",
    "email": "juan@example.com",
    "telefono": "+5491123456789"
  },
  "comentarios": "Necesitamos sillas altas"
}
```

**Respuesta exitosa (201 Created):**
```json
{
  "id": "res_123",
  "estado": "pendiente_pago",
  "preferenceId": "1234567890",
  "init_point": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1234567890"
}
```

## Endpoints de Administración

### Listar Reservas

```http
GET /api/admin/reservas
```

**Parámetros de consulta:**
- `estado` (opcional): Filtrar por estado
- `fechaDesde` (opcional): Fecha de inicio (YYYY-MM-DD)
- `fechaHasta` (opcional): Fecha de fin (YYYY-MM-DD)

**Headers requeridos:**
- `Authorization: Bearer <admin_token>`

### Actualizar Estado de Reserva

```http
PATCH /api/admin/reservas/:id/estado
```

**Cuerpo de la solicitud:**
```json
{
  "estado": "confirmada",
  "notas": "Se confirmó la reserva por teléfono"
}
```

## Webhooks

### Webhook de MercadoPago

```http
POST /api/mp/webhook
```

**Headers:**
- `x-signature`: Firma HMAC-SHA256
- `x-topic`: Tipo de notificación (payment, merchant_order, etc.)

**Respuesta exitosa (200 OK):**
```json
{"status": "ok"}
```

## Esquemas

### Reserva
```typescript
interface Reserva {
  id: string;
  fecha: string; // YYYY-MM-DD
  turno: 'tarde' | 'noche';
  mesaId: string;
  cliente: {
    nombre: string;
    email: string;
    telefono: string;
  };
  estado: 'pendiente_pago' | 'confirmada' | 'cancelada' | 'expirada';
  pagoId?: string;
  preferenceId?: string;
  comentarios?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

### Error
```typescript
interface ErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}
```

## Códigos de Estado HTTP

| Código | Descripción |
|--------|-------------|
| 200 OK | Solicitud exitosa |
| 201 Created | Recurso creado exitosamente |
| 400 Bad Request | Datos de solicitud inválidos |
| 401 Unauthorized | No autenticado |
| 403 Forbidden | No autorizado |
| 404 Not Found | Recurso no encontrado |
| 422 Unprocessable Entity | Error de validación |
| 500 Internal Server Error | Error del servidor |

## Ejemplos de Uso

### Consultar disponibilidad

```bash
curl -X GET "https://api.gamehub.com/api/disponibilidad?fecha=2025-08-15&turno=tarde"
```

### Crear reserva

```bash
curl -X POST https://api.gamehub.com/api/reservas \
  -H "Content-Type: application/json" \
  -d '{
    "fecha": "2025-08-15",
    "turno": "tarde",
    "mesaId": "mesa_123",
    "cliente": {
      "nombre": "Juan Pérez",
      "email": "juan@example.com",
      "telefono": "+5491123456789"
    }
  }'
```

### Listar reservas (admin)

```bash
curl -X GET "https://api.gamehub.com/api/admin/reservas" \
  -H "Authorization: Bearer admin_token_123"
```

## Seguridad

- Todas las solicitudes deben realizarse a través de HTTPS
- Los endpoints de administración requieren autenticación
- Se recomienda implementar rate limiting en producción
- Los webhooks deben validar la firma HMAC

## Versión

Versión actual de la API: `v1`

## Soporte

Para soporte técnico, contactar a soporte@gamehub.com
