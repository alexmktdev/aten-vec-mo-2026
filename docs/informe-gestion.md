# Informe de gestión — Atención al Vecino 2026

Documento resumen del desarrollo del sistema de **Atención al Vecino** de la Ilustre Municipalidad. Pensado como base para el informe de gestión del responsable del proyecto.

---

## 1. Resumen ejecutivo

Atención al Vecino 2026 es una plataforma web que reemplaza el flujo manual de recepción y derivación de requerimientos ciudadanos (consultas, reclamos, sugerencias, felicitaciones, solicitudes vecinales y solicitudes de transparencia) por un sistema único:

- **Formulario público** para que el vecino ingrese su requerimiento.
- **Consulta pública de seguimiento** (número + RUT).
- **Panel de gestión interno** con roles, permisos y trazabilidad por estado.
- **Reportes y dashboard** con métricas en vivo.
- **Notificaciones por correo** en cada hito (ingreso, derivación, respuesta final).
- **Roles segregados:** superadmin, administradora municipal, admin municipal, admin de transparencia y directores por dirección.

El proyecto está desplegado y operativo, integrado con Firebase Authentication, Firestore, Cloudflare R2 (documentos) y un servicio SMTP institucional.

**Período de desarrollo principal:** mayo 2026 (desde commit inicial el 11 de mayo a la última entrega el 27 de mayo).

---

## 2. Objetivos cumplidos

| Objetivo | Estado |
|----------|--------|
| Recibir requerimientos por canal digital con validación de identidad (RUT, reCAPTCHA) | Cumplido |
| Derivar a la dirección municipal correspondiente con correo automático | Cumplido |
| Trazabilidad completa del estado (historial inmutable) | Cumplido |
| Roles diferenciados con permisos por tipo de requerimiento | Cumplido |
| Reportes en PDF y Excel filtrados o completos | Cumplido |
| Dashboard con indicadores en vivo (pendientes, urgentes, por dirección) | Cumplido |
| Consulta pública del estado por el vecino | Cumplido |
| Subrogación de directores sin perder histórico | Cumplido |
| Pruebas E2E y de seguridad automatizadas | Cumplido |

---

## 3. Alcance funcional

### 3.1 Canal público (vecino)

- Formulario de ingreso con validaciones (RUT chileno, email, reCAPTCHA, antibot, rate limit).
- Adjuntar documentos PDF.
- Confirmación por correo al ingresar.
- Consulta de estado con **número de seguimiento + RUT**, con barra de progreso y tooltip explicativo por estado.

### 3.2 Panel administrativo

- **Dashboard:** totales por estado, urgentes activos (≥20 días), top direcciones, distribuciones por tipo y estado, gráficos comparativos.
- **Listado de requerimientos:** búsqueda, filtros por estado, tipo, dirección, rango de fechas; paginación fluida con prefetch.
- **Detalle del requerimiento:** datos del vecino, descripción, documentos, historial de estados, notas internas, evidencia de resolución, respuesta enviada al vecino.
- **Edición de datos:** restringida por rol y estado.
- **Reversión de estado:** mientras no se haya enviado correo al vecino.
- **Gestión de usuarios:** crear, editar, activar/desactivar, eliminar.
- **Gestión de evidencia:** subir documento o link, eliminar al revertir.
- **Reportes:**
  - PDF resumen con filtros aplicados.
  - Excel multipestaña con datos completos sin filtros UI (auditoría).
  - Fechas en formato fijo DD-MM-AAAA y HH:MM.

### 3.3 Flujos por tipo de requerimiento

| Grupo | Tipos | Quién deriva al inicio | Quién cierra al vecino |
|-------|-------|------------------------|------------------------|
| Información (y similares) | Información, Reclamo, Sugerencia, Felicitación | Admin municipal | Admin municipal asignado |
| Solicitud Vecinal | Solicitud Vecinal | Admin municipal o transparencia | Director |
| Transparencia | Solicitud de transparencia | Admin transparencia → siempre Secretaría Municipal | Admin transparencia asignado |

Estados del workflow: `pendiente` (visible como "Pendiente por derivación") → `derivado` → `en_proceso` → `en_espera_1` → `en_espera_2` → `derivado_respuesta_final` → `completado` / `rechazado`. Cada transición queda en historial con fecha, usuario y nota.

### 3.4 Roles y permisos

- **Superadmin:** acceso total, único que puede crear usuarios.
- **Administradora municipal:** todas las operaciones excepto crear usuarios.
- **Admin municipal:** opera Información / Reclamo / Sugerencia / Felicitación / Solicitud Vecinal.
- **Admin transparencia:** opera Solicitud de transparencia y Solicitud Vecinal.
- **Director:** opera únicamente requerimientos de su(s) dirección(es) asignadas.

Regla operativa: **un único director activo por dirección municipal** (más adelante hicimos compatible la subrogación).

---

## 4. Arquitectura y stack técnico

### 4.1 Stack

- **Framework:** Next.js 16 (App Router, Turbopack, Server Components, React 19).
- **Lenguaje:** TypeScript estricto.
- **UI:** Tailwind CSS 4, Radix UI, Lucide Icons, gráficos con Recharts.
- **Estado cliente:** TanStack Query (cache, prefetch, mutaciones optimistas) + Zustand.
- **Backend serverless:** Route Handlers de Next.js (Node runtime).
- **Base de datos:** Firestore (Admin SDK desde servidor, cliente sin acceso directo).
- **Autenticación:** Firebase Authentication con session cookies HttpOnly + SameSite=strict.
- **Almacenamiento de archivos:** Cloudflare R2 con URLs presignadas S3-compatibles.
- **Correo:** SMTP institucional vía Nodemailer con plantillas HTML embebidas.
- **Validación:** Zod (formularios, request body, query params).
- **Logging:** pino con loggers por ruta.
- **Rate limiting:** Upstash KV en producción, bucket en memoria como fallback local.
- **Hosting:** Vercel (deploy automático desde rama `main`).

### 4.2 Capas del backend

```
HTTP route handler  →  service  →  repository  →  Firestore
```

- **Repository:** queries puras a Firestore con `.select()` y filtros en servidor.
- **Service:** reglas de negocio, transiciones de estado, notificaciones, caché.
- **Route handler:** autenticación, autorización por rol, validación con Zod, respuesta estandarizada.

### 4.3 Seguridad implementada

- Cookies de sesión **HttpOnly + SameSite=strict + Secure** en producción.
- Validación de sesión en cada request a través de `requireAuth` / `requireRole`.
- Verificación reCAPTCHA en formulario público.
- Rate limiting en endpoints públicos (`/api/seguimiento`, `/api/requerimientos`).
- Saneamiento de inputs y normalización (RUT, email).
- Respuesta genérica en recuperación de contraseña (anti-enumeración de emails).
- Reglas de Firestore que **prohíben acceso directo del cliente**; todo pasa por API.
- Bloqueo de sesión para usuarios desactivados (campo `activo` + Firebase Auth `disabled`).
- URLs presignadas con TTL corto para documentos.
- Aislamiento por dirección: un director no puede leer requerimientos fuera de su dirección.

### 4.4 Métricas del repositorio

- **143 archivos TypeScript/TSX** en `src/`.
- **57 commits** en `main` desde el inicio.
- 9 grupos de rutas API.
- 4 colecciones de Firestore (`requerimientos`, `usuarios`, `password_reset_tokens`, `dashboard_metrics`).

---

## 5. Línea de tiempo (hitos)

### Semana 1 — 11 al 17 de mayo
- Bootstrap del proyecto Next.js.
- Sistema inicial de requerimientos: modelo, formulario, panel básico.
- Autenticación Firebase + cookies de sesión.
- Primeras optimizaciones de caché y paginación.

### Semana 2 — 18 al 24 de mayo
- Workflow estricto de estados por rol.
- Modal de confirmación al enviar respuesta al vecino.
- Permitir al director revertir entre estados antes del correo al vecino.
- Evidencia de resolución (subir/eliminar PDF o link).
- Restricciones de edición por rol y estado.
- Columna "respuesta enviada al vecino" en listado.
- Dashboard con conteos correctos y eliminación de tarjeta de vencidos.
- Barra de progreso por estado en la pantalla de seguimiento.
- Mejora de rendimiento (reducción ~99% de lecturas Firestore, Vercel Data Cache, envío de emails en background con `after()`).

### Semana 3 — 25 al 27 de mayo
- Nuevo workflow con tipos, esperas, derivación final y reversión.
- Eliminación de campo "Categoría" de UI, filtros y reportes.
- Plantillas de correo actualizadas (sin dirección municipal ni categoría).
- Separación del rol "admin" en **admin-municipal** y **admin-transparencia**.
- Dashboard y gráficas con datos en caliente.
- Reportes con formato fijo de fecha DD-MM-AAAA y HH:MM.
- Filtro de dirección para directores con varias direcciones.
- Activar / desactivar usuarios y subrogación.
- Correo de derivación dinámico según director activo.
- Etiqueta "Pendiente por derivación" en lugar de "Pendiente".
- Tooltip explicativo de estados en la consulta pública.
- Script `npm run test:security` con pruebas básicas y medias.

---

## 6. Funcionalidades destacadas implementadas

### Subrogación de directores
El sistema permite **desactivar** al director titular sin borrarlo, **crear** al director subrogante con la misma dirección y, al volver el titular, **reactivar** al titular y desactivar al subrogante. Los correos de derivación se actualizan automáticamente al email del director activo.

### Derivación inteligente
Al derivar un requerimiento a una dirección, el sistema selecciona como destinatario:
1. El email del **director activo** de esa dirección.
2. Si no hay director activo, un **correo de respaldo** configurado por dirección.

### Trazabilidad y reversión
Cada cambio de estado se registra con usuario, fecha y nota. Los usuarios con permiso pueden revertir el último cambio **siempre que aún no se haya enviado correo al vecino**, restaurando el estado anterior (incluido el plazo).

### Reportes
- PDF resumen para impresión y archivo, con filtros aplicados visibles.
- Excel multipestaña con todos los datos para auditoría y análisis externo.
- Cálculo de urgentes activos (≥20 días calendario desde ingreso).

### Pruebas automatizadas
- `npm run test:e2e-requerimientos`: recorre los flujos por tipo de requerimiento end-to-end.
- `npm run test:security`: comprueba 401/403/400 en endpoints, IDOR entre direcciones, atributos de cookies, anti-enumeración en password reset, rate limiting.

---

## 7. Indicadores de calidad

- **Cobertura de roles:** 5 roles diferenciados con matriz explícita en `requerimiento-permissions.ts`.
- **Build sin errores:** `next build` con TypeScript estricto pasa correctamente.
- **Pruebas de seguridad básicas:** 12/13 ✓ en suite básica (el único caso pendiente es benigno: el endpoint de upload público devuelve 400 antes de chequear sesión, esperado en el flujo de vecinos).
- **Optimización:** reducción ~99% de lecturas Firestore mediante caché y `.select()` con campos mínimos.

---

## 8. Documentación interna del proyecto

Bajo `docs/` existen los siguientes documentos técnicos:

- `e2e-requerimientos-flujos.md` — pruebas E2E de flujos de requerimientos.
- `security-check.md` — pruebas automáticas de seguridad.
- `informe-gestion.md` — este documento.

Además, el código está organizado para que un nuevo desarrollador entienda el dominio sin lectura previa:
- `src/types/requerimiento.types.ts` define los estados, tipos y etiquetas.
- `src/lib/requerimiento-permissions.ts` centraliza el control de permisos.
- `src/services/` agrupa la lógica de negocio.

---

## 9. Próximos pasos sugeridos

Mejoras posibles para futuras iteraciones (no son bloqueantes):

1. **Notificaciones in-app** para cuando un admin reciba un caso derivado para respuesta final.
2. **Auditoría con exportable** (Excel de log de acciones por usuario).
3. **Métricas SLA por tipo y dirección** (tiempo medio en cada estado).
4. **Reapertura formal** de casos cerrados con justificación obligatoria.
5. **Estado "subrogación" visible** para informar al usuario que está cubriendo a otro director.
6. **Búsqueda full-text** por descripción del requerimiento (Algolia o equivalente).
7. **Pruebas unitarias** además de las E2E e integración.

---

## 10. Equipo y agradecimientos

- **Desarrollo y diseño:** Alexander Zananiri (responsable del proyecto).
- **Asistencia técnica con IA:** Cursor AI Assistant para acelerar implementación y revisiones.
- **Stakeholders municipales:** Administradora Municipal y direcciones involucradas en validación de flujos.

---

> Documento generado a partir del historial real del repositorio (`git log`) y del estado actual del código en mayo de 2026.
