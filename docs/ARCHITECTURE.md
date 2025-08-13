# Arquitectura del Sistema GameHub

## Diagrama de Alto Nivel

```mermaid
graph TD
    A[Cliente Web] -->|1. Consulta disponibilidad| B[API GameHub]
    A -->|2. Envía reserva| B
    B -->|3. Crea preferencia| C[MercadoPago]
    C -->|4. Redirecciona a pago| A
    C -->|5. Notificación| D[Webhook MP]
    D -->|6. Actualiza estado| B
    B -->|7. Envía notificación| E[WhatsApp Business API]
    B -->|8. Sincroniza| F[Google Sheets]
    G[Panel Admin] -->|9. Monitorea| B
    B -->|10. Almacena| H[(MongoDB Atlas)]
```

## Flujo de Reserva

```mermaid
sequenceDiagram
    participant C as Cliente
    participant FE as Frontend
    participant BE as Backend (API)
    participant MP as MercadoPago
    participant WABA as WhatsApp Business API
    
    C->>FE: 1. Selecciona fecha, turno y mesa
    FE->>BE: 2. GET /api/disponibilidad?fecha=...&turno=...
    BE-->>FE: 3. Mesas disponibles
    C->>FE: 4. Completa datos y confirma
    FE->>BE: 5. POST /api/reservas
    BE->>MP: 6. Crea preferencia de pago
    MP-->>BE: 7. URL de pago
    BE-->>FE: 8. URL de pago
    FE->>MP: 9. Redirección a checkout
    MP-->>C: 10. Interfaz de pago
    C->>MP: 11. Completa pago
    MP->>BE: 12. Webhook POST /api/mp/webhook
    BE->>BE: 13. Valida firma y actualiza estado
    BE->>WABA: 14. Envía confirmación
    WABA->>C: 15. Mensaje de confirmación
    BE->>BE: 16. Sincroniza con Google Sheets
```

## Flujo de Notificaciones

```mermaid
graph LR
    A[Evento] --> B{¿Requiere notificación?}
    B -->|Sí| C[Agregar a cola]
    C --> D[Procesar cola]
    D --> E[Enviar por WABA]
    E --> F{¿Éxito?}
    F -->|Sí| G[Registrar éxito]
    F -->|No| H[Reintentar + Backoff]
    H -->|Máx reintentos| I[Registrar fallo + Alerta]
    G --> J[Actualizar estado]
    J --> K[Sincronizar con Sheets]
```

## Sincronización con Google Sheets

```mermaid
gantt
    title Proceso de Sincronización Batch
    dateFormat  YYYY-MM-DD HH:mm
    section Reservas
    Procesar lote actual   :a1, 2023-01-01, 5m
    Enviar a Sheets        :a2, after a1, 10m
    section Reconciliación
    Verificar discrepancias :b1, 2023-01-01, 15m
    Resolver conflictos    :b2, after b1, 10m
    section Mantenimiento
    Limpiar registros viejos :c1, 2023-01-01, 5m
```

## Estructura de la Base de Datos

### Diagrama Entidad-Relación

```mermaid
erDiagram
    USUARIO ||--o{ RESERVA : tiene
    RESERVA ||--o| MESA : incluye
    RESERVA ||--o| PAGO : genera
    PAGO ||--o| TRANSACCION_MP : referencia
    
    USUARIO {
        string _id
        string nombre
        string email
        string telefono
        string role
        date createdAt
    }
    
    RESERVA {
        string _id
        date fecha
        string turno
        string estado
        string usuarioId
        date createdAt
    }
    
    MESA {
        string _id
        string nombre
        number capacidad
        boolean activa
    }
    
    PAGO {
        string _id
        string reservaId
        number monto
        string estado
        string preferenceId
        date createdAt
    }
    
    TRANSACCION_MP {
        string _id
        string pagoId
        string mpId
        string estado
        date fechaAprobacion
    }
```

## Infraestructura

```mermaid
flowchart TB
    subgraph Vercel [Vercel Edge Network]
        FE[Frontend Next.js]
        BE[Serverless Functions]
    end
    
    subgraph External [Servicios Externos]
        DB[(MongoDB Atlas)]
        MP[MercadoPago]
        WABA[WhatsApp Business API]
        GS[Google Sheets]
    end
    
    subgraph Monitoring [Monitoreo]
        SENTRY[Sentry]
        LOGS[Logs]
        METRICS[Métricas]
    end
    
    FE <--> BE
    BE <--> DB
    BE <--> MP
    BE <--> WABA
    BE <--> GS
    BE -->|Errores| SENTRY
    BE -->|Registros| LOGS
    BE -->|Métricas| METRICS
```

## Flujo de Despliegue

```mermaid
flowchart LR
    A[GitHub] -->|Push a main| B[GitHub Actions]
    B -->|Ejecuta tests| C{¿Tests pasan?}
    C -->|Sí| D[Despliegue en Vercel]
    C -->|No| E[Notificar fallo]
    D -->|Previsualización| F[Vercel Preview]
    D -->|Producción| G[Vercel Production]
    G -->|Health Check| H{¿OK?}
    H -->|Sí| I[Completado]
    H -->|No| J[Rollback + Notificar]
```

## Consideraciones de Escalabilidad

1. **Frontend**:
   - Generación estática para páginas públicas
   - Server Components para datos dinámicos
   - CDN global con Vercel Edge Network

2. **Backend**:
   - Funciones serverless escalables automáticamente
   - Conexiones a MongoDB optimizadas
   - Caché de consultas frecuentes

3. **Base de Datos**:
   - Índices optimizados para consultas frecuentes
   - TTL para datos temporales
   - Sharding horizontal si es necesario

4. **Procesamiento Asíncrono**:
   - Colas para tareas pesadas (notificaciones, sincronización)
   - Reintentos con backoff exponencial
   - Dead Letter Queues para mensajes fallidos
