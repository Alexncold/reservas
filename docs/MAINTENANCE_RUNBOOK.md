# Manual de Mantenimiento GameHub

## Índice
1. [Procedimientos de Backup](#procedimientos-de-backup)
2. [Procedimientos de Restauración](#procedimientos-de-restauración)
3. [Rotación de Secretos](#rotación-de-secretos)
4. [Monitoreo y Mantenimiento](#monitoreo-y-mantenimiento)
5. [Procedimientos de Escalado](#procedimientos-de-escalado)
6. [Solución de Problemas](#solución-de-problemas)

---

## Procedimientos de Backup

### Backup de Base de Datos

**Frecuencia**: Diaria (completa) + cada 6 horas (incremental)

**Comando para Backup Completo**:
```bash
# Exportar todas las colecciones
mongodump --uri=$MONGODB_URI --out=/backups/mongodb/$(date +%Y%m%d_%H%M%S)

# Comprimir el backup
tar -czvf /backups/mongodb_$(date +%Y%m%d_%H%M%S).tar.gz /backups/mongodb/

# Subir a almacenamiento en la nube
rclone copy /backups/ backup:gamehub/backups/
```

**Automatización con Cron**:
```
# Backup completo diario a las 2 AM
0 2 * * * /ruta/al/script/backup_mongodb.sh full

# Backup incremental cada 6 horas
0 */6 * * * /ruta/al/script/backup_mongodb.sh incremental
```

### Backup de Google Sheets

**Frecuencia**: Diaria

**Procedimiento**:
1. Ir a Google Drive
2. Localizar la hoja de cálculo
3. Archivo > Hacer una copia > "Copia de seguridad YYYY-MM-DD"
4. Mover a la carpeta de backups

### Backup de Configuración

**Frecuencia**: Semanal o cuando haya cambios

**Incluir**:
- Archivo de configuración de Vercel
- Variables de entorno
- Configuración de dominios
- Configuración de DNS

---

## Procedimientos de Restauración

### Restauración de Base de Datos

**Desde Backup Completo**:
```bash
# Descomprimir backup si es necesario
tar -xzvf mongodb_20230801_020000.tar.gz

# Restaurar
mongorestore --uri=$MONGODB_URI --drop /backups/mongodb/
```

**Restauración Puntual**:
```bash
# Restaurar colección específica
mongorestore --uri=$MONGODB_URI --drop --nsInclude=gamehub.reservas /backups/mongodb/gamehub/reservas.bson
```

### Restauración de Google Sheets

1. Ir a Google Drive
2. Ubicar la copia de respaldo
3. Archivo > Hacer una copia
4. Renombrar y mover a la ubicación original

### Recuperación ante Desastres

1. **Evaluar el alcance**: Determinar qué sistemas están afectados
2. **Aislar el problema**: Prevenir daño adicional
3. **Restaurar desde backup**: Usar el último backup válido
4. **Verificar integridad**: Comprobar que los datos son consistentes
5. **Reanudar operaciones**: Volver a poner en línea los servicios
6. **Documentar el incidente**: Registrar causas y acciones tomadas

---

## Rotación de Secretos

### Tokens de Acceso

**Frecuencia**: Cada 90 días o inmediatamente en caso de filtración

**Procedimiento**:
1. Generar nuevos tokens
2. Actualizar en Vercel:
   ```bash
   vercel env add MONGODB_URI production
   vercel env add JWT_SECRET production
   # Repetir para cada secreto
   ```
3. Reiniciar servicios afectados

**Rotación de Claves de Cifrado**:
1. Generar nuevo par de claves
2. Cifrar datos existentes con la nueva clave
3. Actualizar referencias
4. Eliminar clave antigua después de confirmar que ya no se usa

### Certificados SSL

**Renovación Automática**:
- Vercel maneja la renovación automática
- Verificar en https://vercel.com/[usuario]/[proyecto]/settings/domains

**Renovación Manual**:
1. Ir a la configuración del dominio en Vercel
2. Seleccionar "Revalidar" en la sección SSL
3. Seguir las instrucciones

---

## Monitoreo y Mantenimiento

### Tareas Diarias

1. Revisar alertas y dashboards
2. Verificar estado de los servicios:
   ```bash
   # Verificar estado de MongoDB
   mongosh --eval "db.serverStatus().ok"
   
   # Verificar espacio en disco
   df -h
   ```
3. Revisar logs de errores

### Tareas Semanales

1. Revisar métricas de rendimiento
2. Limpieza de logs antiguos
3. Verificar backups
4. Revisar actualizaciones de seguridad

### Tareas Mensuales

1. Revisar acceso y permisos
2. Auditar logs de seguridad
3. Revisar costos y optimizar recursos
4. Actualizar documentación

---

## Procedimientos de Escalado

### Escalado Vertical (Aumentar Recursos)

**Base de Datos**:
1. Ir a MongoDB Atlas
2. Seleccionar cluster > Configuration > Scale
3. Ajustar tier según necesidad
4. Aplicar cambios en ventana de mantenimiento

**Aplicación (Vercel)**:
1. Ir a la configuración del proyecto en Vercel
2. Ajustar plan según necesidad
3. Configurar autoescalado si es necesario

### Escalado Horizontal (Añadir Nodos)

**Base de Datos**:
1. En MongoDB Atlas, ir a Clusters
2. Seleccionar "Add a Replica Set Member"
3. Configurar región y prioridad
4. Aplicar cambios

**Aplicación**:
1. En Vercel, habilitar "Auto-Scale"
2. Configurar límites mínimos y máximos
3. Definir métricas de escalado

---

## Solución de Problemas

### Problemas Comunes

**Conexión a la Base de Datos**:
```bash
# Verificar conexión
mongosh $MONGODB_URI --eval "db.serverStatus().ok"

# Verificar logs de MongoDB
docker logs -f mongodb
```

**Problemas de Rendimiento**:
```bash
# Verificar consultas lentas
mongosh $MONGODB_URI --eval "db.currentOp().inprog.forEach(op => { if(op.secs_running > 5) printjson(op) })"

# Verificar uso de índices
db.reservas.explain().find({ estado: "confirmada" })
```

**Problemas con Pagos**:
1. Verificar estado en el panel de MercadoPago
2. Revisar logs de la aplicación
3. Verificar webhooks

### Herramientas de Diagnóstico

```bash
# Verificar estado de la aplicación
curl -I https://api.gamehub.com/health

# Verificar versión
git log -1 --pretty=format:"%h %s"

# Monitorear logs en tiempo real
vercel logs --follow
```

### Contactos de Emergencia

| Rol | Nombre | Contacto |
|-----|--------|----------|
| Responsable de Infraestructura | Juan Pérez | juan@ejemplo.com, +54 9 11 1234-5678 |
| Desarrollador Senior | María Gómez | maria@ejemplo.com, +54 9 11 8765-4321 |
| Soporte Técnico | Equipo de Soporte | soporte@ejemplo.com, +54 800-123-4567 |

---

## Registro de Cambios

| Fecha | Versión | Cambios | Responsable |
|-------|---------|---------|-------------|
| 2025-08-15 | 1.0.0 | Versión inicial del runbook | Equipo de DevOps |

---
*Última actualización: Agosto 2025*
