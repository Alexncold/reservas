# Lista de Verificación Pre-Despliegue

## Requisitos Previos
- [ ] Crear cuenta en Vercel (si no existe)
- [ ] Configurar proyecto en MongoDB Atlas
- [ ] Crear aplicación en el panel de desarrolladores de MercadoPago
- [ ] Configurar cuenta de WhatsApp Business API
- [ ] Crear hoja de cálculo en Google Sheets
- [ ] Configurar cuenta en Sentry (opcional pero recomendado)

## Configuración de Entornos

### Variables de Entorno Requeridas
- [ ] `MONGODB_URI` - URI de conexión a MongoDB Atlas
- [ ] `NEXTAUTH_SECRET` - Secreto para NextAuth
- [ ] `JWT_SECRET` - Secreto para JWT
- [ ] `MP_ACCESS_TOKEN` - Token de acceso de MercadoPago
- [ ] `MP_PUBLIC_KEY` - Clave pública de MercadoPago
- [ ] `MP_WEBHOOK_SECRET` - Secreto para validar webhooks de MercadoPago
- [ ] `WHATSAPP_TOKEN` - Token de WhatsApp Business API
- [ ] `WHATSAPP_PHONE_NUMBER_ID` - ID del número de teléfono de WhatsApp
- [ ] `GOOGLE_SHEETS_CREDENTIALS` - Credenciales de Google Cloud
- [ ] `GOOGLE_SHEET_ID` - ID de la hoja de cálculo de Google

## Configuración de Dominios
- [ ] Registrar dominio (ej: gamehub.com)
- [ ] Configurar DNS para apuntar a Vercel
- [ ] Configurar SSL/TLS (automático con Vercel)
- [ ] Configurar redirección de www a dominio raíz (o viceversa)

## Pruebas Pre-Despliegue

### Pruebas Locales
- [ ] Ejecutar `yarn test` - Todas las pruebas deben pasar
- [ ] Ejecutar `yarn build` - La compilación debe ser exitosa
- [ ] Verificar que no hayan advertencias de dependencias desactualizadas
- [ ] Probar flujo completo localmente:
  - [ ] Búsqueda de disponibilidad
  - [ ] Creación de reserva
  - [ ] Flujo de pago con MercadoPago sandbox
  - [ ] Recepción de notificaciones
  - [ ] Sincronización con Google Sheets

### Pruebas de Seguridad
- [ ] Ejecutar `yarn audit` - Corregir vulnerabilidades críticas
- [ ] Verificar que no hay datos sensibles en el código
- [ ] Confirmar que todas las rutas de administración requieren autenticación
- [ ] Validar headers de seguridad (CSP, HSTS, etc.)

## Configuración de Monitoreo
- [ ] Configurar alertas de errores (Sentry)
- [ ] Configurar monitoreo de rendimiento
- [ ] Establecer canales de notificación (email, Slack, etc.)
- [ ] Configurar dashboards de métricas clave

## Plan de Rollback
- [ ] Documentar pasos para revertir a la versión anterior
- [ ] Probar proceso de rollback en entorno de staging
- [ ] Definir criterios para activar rollback

## Comunicación
- [ ] Notificar a los equipos sobre la ventana de mantenimiento
- [ ] Preparar comunicados para usuarios (si es necesario)
- [ ] Coordinar con soporte para posibles incidencias

## Últimas Verificaciones
- [ ] Hacer backup de la base de datos actual (si aplica)
- [ ] Verificar que no hayan despliegues en curso
- [ ] Confirmar que el equipo está disponible durante el despliegue
- [ ] Revisar métricas de rendimiento actuales para comparar post-despliegue

## Después del Despliegue
- [ ] Verificar que el sitio está accesible
- [ ] Ejecutar pruebas de humo en producción
- [ ] Monitorear métricas y logs
- [ ] Comunicar el éxito del despliegue
- [ ] Actualizar documentación si es necesario

## En Caso de Problemas
1. **Errores durante el despliegue**: Revisar logs de Vercel
2. **Problemas de rendimiento**: Escalar recursos según sea necesario
3. **Errores en producción**: Revisar logs de la aplicación y de Sentry
4. **Rollback**: Ejecutar el plan de rollback si es necesario

## Contactos Clave
- **Desarrollo**: equipo@ejemplo.com
- **Infraestructura**: infra@ejemplo.com
- **Soporte**: soporte@ejemplo.com
- **Urgencias**: +54 9 11 1234-5678

---
*Última actualización: Agosto 2025*
