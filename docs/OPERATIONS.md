# Manual de Operaciones GameHub

## Índice
1. [Gestión de Plantillas WABA](#gestión-de-plantillas-waba)
2. [Rotación de Tokens](#rotación-de-tokens)
3. [Resolución de Incidencias Comunes](#resolución-de-incidencias-comunes)
4. [Procedimiento de Backup y Restauración](#procedimiento-de-backup-y-restauración)
5. [Escalado de Recursos](#escalado-de-recursos)
6. [Monitoreo y Alertas](#monitoreo-y-alertas)

---

## Gestión de Plantillas WABA

### Alta de Nueva Plantilla

1. **Preparar el contenido**:
   - Definir nombre, idioma y categoría
   - Diseñar la estructura con variables
   - Asegurar cumplimiento de políticas de WhatsApp

2. **Solicitar aprobación**:
   ```bash
   curl -X POST "https://graph.facebook.com/v18.0/<NÚMERO_TELÉFONO>/message_templates" \
   -H "Authorization: Bearer <TOKEN_WABA>" \
   -H "Content-Type: application/json" \
   -d '{
     "name": "confirmacion_reserva",
     "language": "es_AR",
     "category": "UTILITY",
     "components": [
       {
         "type": "BODY",
         "text": "¡Hola {{1}}! Confirmamos tu reserva para el {{2}} a las {{3}} hs. N° de reserva: {{4}}"
       },
       {
         "type": "BUTTONS",
         "buttons": [
           {
             "type": "QUICK_REPLY",
             "text": "Ver detalles"
           },
           {
             "type": "PHONE_NUMBER",
             "text": "Llamar al local",
             "phone_number": "+541112345678"
           }
         ]
       }
     ]
   }'
   ```

3. **Verificar estado**:
   ```bash
   curl -X GET "https://graph.facebook.com/v18.0/<ID_TEMPLATE>" \
   -H "Authorization: Bearer <TOKEN_WABA>"
   ```

### Actualización de Plantillas

1. Crear nueva versión con cambios
2. Actualizar referencia en el código
3. Monitorear uso de la versión anterior
4. Eliminar versión antigua después de confirmar migración

---

## Rotación de Tokens

### Tokens de Acceso

1. **Generar nuevo token**:
   ```bash
   # Generar nuevo secreto seguro
   openssl rand -base64 32
   ```

2. **Actualizar en Vercel**:
   ```
   NEXTAUTH_SECRET=nuevo_secreto_seguro_123
   ```

3. **Notificar equipos** sobre la rotación

### Credenciales de MercadoPago

1. Generar nuevas credenciales en el panel de desarrollador
2. Actualizar en Vercel:
   ```
   MP_ACCESS_TOKEN=nuevo_access_token
   MP_PUBLIC_KEY=nueva_public_key
   ```
3. Actualizar webhooks con la nueva firma

### Tokens de WhatsApp Business API

1. Generar nuevo token en el Business Manager de Meta
2. Actualizar en Vercel:
   ```
   WHATSAPP_TOKEN=nuevo_token_waba
   ```
3. Actualizar configuración de webhooks

---

## Resolución de Incidencias Comunes

### Fallo en Webhook de MercadoPago

**Síntomas**:
- No se actualiza el estado de los pagos
- Alertas de fallo en los logs

**Acciones**:
1. Verificar estado del servicio en [status.mercadopago.com](https://status.mercadopago.com)
2. Revisar logs de la aplicación:
   ```bash
   vercel logs --limit 100
   ```
3. Reprocesar pagos pendientes:
   ```bash
   # Listar pagos pendientes
   curl -X GET "https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&status=pending" \
   -H "Authorization: Bearer $MP_ACCESS_TOKEN"
   
   # Obtener detalles de un pago
   curl -X GET "https://api.mercadopago.com/v1/payments/:id" \
   -H "Authorization: Bearer $MP_ACCESS_TOKEN"
   ```

### Problemas de Sincronización con Google Sheets

**Síntomas**:
- Datos desactualizados en la hoja
- Errores en los logs

**Solución**:
1. Verificar permisos de la cuenta de servicio
2. Ejecutar sincronización manual:
   ```bash
   curl -X POST "https://api.gamehub.com/api/admin/sync-sheets" \
   -H "Authorization: Bearer $ADMIN_TOKEN"
   ```
3. Revisar cola de sincronización

---

## Procedimiento de Backup y Restauración

### Backup de Base de Datos

1. **Automático**:
   - MongoDB Atlas realiza backups automáticos cada 6 horas
   - Retención de 7 días

2. **Manual**:
   ```bash
   # Exportar colección de reservas
   mongodump --uri=$MONGODB_URI --collection=reservas --out=./backups/reservas_$(date +%Y%m%d)
   
   # Comprimir backup
   tar -czvf backup_$(date +%Y%m%d).tar.gz ./backups/reservas_$(date +%Y%m%d)
   ```

### Restauración

1. **Desde MongoDB Atlas**:
   - Usar la interfaz web para restaurar a un punto en el tiempo

2. **Desde archivo de respaldo**:
   ```bash
   # Restaurar colección
   mongorestore --uri=$MONGODB_URI --drop ./backups/reservas_20230801/reservas.bson
   ```

---

## Escalado de Recursos

### Aumentar Recursos en Vercel

1. **Frontend**:
   - Actualizar plan en Vercel
   - Habilitar Auto-scaling

2. **Base de Datos**:
   ```bash
   # MongoDB Atlas -> Cluster -> Configuration -> Scale
   # Ajustar tier según necesidad
   ```

### Monitoreo de Recursos

```bash
# Ver uso de CPU/Memoria
vercel logs --limit 100

# MongoDB Atlas -> Metrics
# Monitorear:
# - Oplog Window
# - Query Targeting
# - Connection Pool
```

---

## Monitoreo y Alertas

### Configuración de Alertas

1. **Sentry**:
   - Errores en producción
   - Performance issues

2. **Vercel Log Drains**:
   - Errores 5xx
   - Tiempos de respuesta altos

3. **Uptime Robot**:
   - Monitoreo de endpoints críticos
   - Alertas vía email/SMS

### Umbrales Recomendados

| Métrica | Umbral Crítico | Acción |
|---------|----------------|--------|
| Tiempo de respuesta API | > 2000ms | Investigar cuello de botella |
| Tasa de error | > 1% | Revisar logs |
| Uso de CPU | > 80% | Escalar recursos |
| Conexiones DB | > 80% del límite | Optimizar consultas |
| Espacio en disco | > 85% | Limpiar logs/backups |

### Procedimiento de Respuesta a Incidentes

1. **Identificación**:
   - Revisar alertas
   - Verificar dashboards

2. **Contención**:
   - Activar modo mantenimiento si es necesario
   - Escalar recursos

3. **Resolución**:
   - Aplicar fix
   - Monitorear estabilidad

4. **Post-Mortem**:
   - Documentar incidente
   - Identificar acciones preventivas
   - Actualizar runbooks

---

## Mantenimiento Programado

### Tareas Diarias
- Revisar alertas y dashboards
- Verificar backups
- Monitorear uso de recursos

### Tareas Semanales
- Rotación de logs
- Revisión de métricas de rendimiento
- Limpieza de datos temporales

### Tareas Mensuales
- Revisión de seguridad
- Actualización de dependencias
- Pruebas de recuperación de desastres
