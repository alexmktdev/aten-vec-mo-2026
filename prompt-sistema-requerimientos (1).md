# Prompt: Sistema Municipal de Gestión de Requerimientos Vecinales

---

## 1. DESCRIPCIÓN GENERAL DE LA APP

Necesito construir un sistema web full stack con Next.js (App Router) para una **Municipalidad**, cuya función es gestionar requerimientos de vecinos. El sistema tiene dos grandes áreas:

### 1.1 Área pública (sin login)

#### Formulario de ingreso de requerimiento
Cualquier vecino puede ingresar un requerimiento sin autenticarse. La página se llama **"Atención al Vecino — Sistema de ingreso de requerimientos municipales"**.

El formulario se divide en dos tarjetas (`card`) visualmente separadas:

**Tarjeta 1 — Datos del Vecino** (grid 2 columnas, responsive a 1 columna en móvil):
| Campo | Tipo | Requerido | Notas |
|---|---|---|---|
| Nombre | text | ✓ | |
| Primer Apellido | text | ✓ | |
| Segundo Apellido | text | ✗ | Opcional |
| RUT | text | ✓ | Placeholder: `12.345.678-9`. Validar formato y dígito verificador con Zod |
| Teléfono | tel | ✓ | Placeholder: `+56912345678` |
| Correo | email | ✓ | |
| Confirmar correo | email | ✓ | Validar que coincida con el campo anterior |
| Región | select | ✓ | Lista completa de las 16 regiones de Chile |
| Comuna | text | ✓ | |
| Dirección | text | ✓ | Placeholder: `Ej: Av. Libertador Bernardo O'Higgins 1234, Depto 201` |
| Tipo de inmueble | select | ✓ | Opciones: Casa, Departamento, Oficina |

**Tarjeta 2 — Datos del Requerimiento** (grid 2 columnas):
| Campo | Tipo | Requerido | Notas |
|---|---|---|---|
| Tipo de Requerimiento | select | ✓ | Opciones: Información, Reclamo, Sugerencia, Felicitación, Solicitud, Denuncia |
| Dirección Municipal | select | ✓ | Ver lista completa más abajo. Al seleccionar, habilita el campo Categoría |
| Categoría | select | ✓ | **Dependiente** de Dirección Municipal. Deshabilitado hasta que se elija dirección. Ver mapeo completo más abajo |
| Documento PDF | file | ✗ | Solo PDF, máximo 5MB. Validar tipo y tamaño antes de subir |
| Descripción | textarea | ✓ | 7 filas, `resize: vertical`. Placeholder: "Describa detalladamente el requerimiento..." |

**Info box**: encima del grid de la Tarjeta 2, mostrar un recuadro azul claro con el texto: *"Primero seleccione la dirección municipal correspondiente. Luego el sistema mostrará las categorías relacionadas."*

**Botón de envío**: ancho completo, azul (`#2563eb`), texto "Enviar requerimiento".

**Lógica de validación del formulario (frontend)**:
- Correo y confirmar correo deben coincidir — mostrar error inline, no alert.
- RUT: validar formato `XX.XXX.XXX-X` y dígito verificador con algoritmo módulo 11.
- Archivo PDF: validar que sea `application/pdf` y no supere 5MB antes de intentar el upload.
- Al enviar correctamente: mostrar pantalla de éxito con el número de seguimiento generado, no simplemente un `alert()`.

#### Direcciones Municipales y sus Categorías (mapeo completo y obligatorio)

```typescript
const DIRECCIONES_MUNICIPALES = {
  ADMINISTRACION: {
    label: "Administración Municipal",
    categorias: ["Consultas generales", "Reclamos de atención", "Felicitaciones", "Sugerencias"]
  },
  INSPECCION: {
    label: "Dirección de Inspección",
    categorias: ["Comercio ilegal", "Ruidos molestos", "Fiscalización", "Denuncias municipales"]
  },
  INNOVACION: {
    label: "Dirección de Innovación y Desarrollo Tecnológico",
    categorias: ["Problemas plataforma web", "Soporte tecnológico", "Trámites online"]
  },
  SECRETARIA: {
    label: "Secretaría Municipal",
    categorias: ["Solicitud de documentos", "Información municipal", "Consultas administrativas"]
  },
  JPL: {
    label: "Juzgado de Policía Local",
    categorias: ["Multas", "Partes", "Infracciones", "Citaciones"]
  },
  CONTROL: {
    label: "Dirección de Control",
    categorias: ["Reclamos administrativos", "Control interno", "Observaciones"]
  },
  FINANZAS: {
    label: "Dirección de Administración y Finanzas",
    categorias: ["Permiso de circulación", "Patentes comerciales", "Pagos municipales"]
  },
  SECPLAN: {
    label: "Dirección de Secretaría Comunal de Planificación",
    categorias: ["Pavimentación", "Infraestructura", "Proyectos comunales"]
  },
  DIDECO: {
    label: "Dirección de Desarrollo Comunitario",
    categorias: ["Ayuda social", "Subsidios", "Becas", "Adulto mayor", "Discapacidad"]
  },
  JURIDICA: {
    label: "Dirección de Asesoría Jurídica",
    categorias: ["Consultas legales", "Asesoría jurídica", "Denuncias formales"]
  },
  TRANSITO: {
    label: "Dirección de Tránsito",
    categorias: ["Semáforos", "Señalización", "Licencia de conducir", "Congestión vehicular"]
  },
  OBRAS: {
    label: "Dirección de Obras",
    categorias: ["Construcciones irregulares", "Veredas dañadas", "Permisos de obra"]
  },
  PERSONAS: {
    label: "Dirección de las Personas",
    categorias: ["Consultas laborales", "Funcionarios municipales"]
  },
  SEGURIDAD: {
    label: "Dirección de Seguridad Pública",
    categorias: ["Seguridad ciudadana", "Patrullaje", "Vehículos abandonados", "Emergencias"]
  },
  MEDIOAMBIENTE: {
    label: "Dirección de Medioambiente, Energía y Sustentabilidad",
    categorias: ["Áreas verdes", "Animales", "Reciclaje", "Contaminación"]
  },
  OPERACIONES: {
    label: "Dirección de Operaciones",
    categorias: ["Alumbrado público", "Basura", "Baches", "Retiro de escombros", "Agua y alcantarillado"]
  }
} as const;
```

Este objeto debe vivir en `src/lib/constants/direcciones.ts` y ser importado tanto en el frontend (para renderizar los selects) como en el backend (para validar que los valores recibidos son válidos).

#### Estética y diseño del formulario público
- Fondo de página: `#f1f5f9` (gris muy claro).
- Tarjetas blancas con `border-radius: 16px` y sombra suave `box-shadow: 0 4px 15px rgba(0,0,0,0.05)`.
- Inputs y selects con borde `#cbd5e1`, `border-radius: 10px`, focus en azul `#2563eb`.
- Tipografía limpia, labels en negrita 14px.
- Totalmente responsive: en móvil el grid pasa a 1 columna.
- Implementar con **Tailwind CSS + shadcn/ui**, replicando fielmente la estructura visual descrita.

#### Página de seguimiento de requerimiento
El vecino puede consultar el estado de su requerimiento ingresando:
- Número de seguimiento (ej: `REQ-2024-000123`)
- RUT de la persona

El sistema retorna un resumen del requerimiento con: estado actual (con badge de color), fecha de ingreso, dirección municipal asignada, categoría, descripción, y días hábiles restantes/vencidos.

### 1.2 Área privada (con login — Panel de Administración)
Panel de administración para los funcionarios municipales con los siguientes módulos:
- **Dashboard**: estadísticas en tiempo real — total de requerimientos recibidos, completados, en proceso, rechazados.
- **Gestión de requerimientos**: listado filtrable por dirección, categoría, estado, fecha. Cada requerimiento muestra todos sus datos y permite editar el estado y agregar notas internas.
- **Derivar requerimiento**: el admin busca el correo del encargado de la dirección correspondiente y le envía un correo de derivación vía Nodemailer. Al enviarse, el estado cambia automáticamente a "Derivado al área correspondiente".
- **Gestión de usuarios**: crear y ver usuarios del sistema.
- **Reportes**: generación de reportes de requerimientos filtrados por dirección, categoría, estado, rango de fechas (exportables a PDF o Excel).

---

## 2. ESTADOS DEL REQUERIMIENTO

Los requerimientos tendrán exactamente los siguientes estados (en este orden de flujo):

1. **Pendiente** — cuando el vecino envía el requerimiento y llega al panel.
2. **Derivado al área correspondiente** — cuando el admin envía el correo al director/encargado de la dirección.
3. **En proceso de solución** — cuando la dirección instruye que se está trabajando en ello.
4. **Requerimiento Completado** — cuando se solucionó; lo ideal es contactar al vecino.
5. **Requerimiento Rechazado** — cuando no se puede solucionar o depende de otra área ajena a la Municipalidad.

**Regla de tiempo**: los requerimientos tienen 20 días hábiles para ser respondidos. El sistema debe mostrar una alerta/aviso visible en cada requerimiento que esté próximo a vencer o que haya vencido, visible en el panel de administración.

---

## 3. FLUJO DE NOTIFICACIONES POR CORREO (Nodemailer)

Al ingresar un requerimiento nuevo:
- **Correo al vecino**: confirmación con todos los datos del requerimiento y el **número de seguimiento** generado automáticamente.
- **Correo al admin del sistema**: aviso de nuevo requerimiento con todos los datos y el número de seguimiento.

Al derivar un requerimiento:
- **Correo al encargado/director de la dirección**: con los datos del requerimiento para que lo gestione.

Todos los correos se envían via **Nodemailer con servidor SMTP** (credenciales serán provistas por el cliente). Las plantillas de correo deben ser HTML bien diseñadas, claras y con logo/nombre municipal.

---

## 4. ROLES Y PERMISOS (detallado)

El sistema tiene 4 roles con permisos diferenciados:

| Permiso | superadmin | admin | director | usuario-por-direccion |
|---|---|---|---|---|
| Ver todos los requerimientos | ✓ | ✓ | Solo su dirección | Solo su dirección |
| Editar estado de requerimientos | ✓ | ✓ | ✓ | ✓ |
| Derivar requerimiento (enviar correo) | ✓ | ✓ | ✗ | ✗ |
| Crear usuarios | ✓ | ✗ | ✗ | ✗ |
| Ver usuarios | ✓ | ✓ | ✗ | ✗ |
| Ver dashboard completo | ✓ | ✓ | Solo su dirección | Solo su dirección |
| Generar reportes | ✓ | ✓ | Solo su dirección | Solo su dirección |
| Eliminar requerimientos | ✓ | ✗ | ✗ | ✗ |

- **superadmin**: acceso total al sistema sin restricciones.
- **admin**: administra la plataforma, ve y edita todos los requerimientos, pero NO puede crear usuarios.
- **director**: ve y gestiona únicamente los requerimientos de su dirección asignada.
- **usuario-por-direccion**: mismo nivel de permisos que director, existe para diferenciar a funcionarios que no son directores pero pertenecen a una dirección.

Los roles se almacenan como **Firebase Custom Claims** (en el token JWT de Firebase Auth), no en Firestore, para que el backend los verifique directamente sin queries adicionales. Firestore almacena el perfil completo del usuario con su dirección asignada.

---

## 5. STACK TÉCNICO EXACTO

- **Framework**: Next.js 14+ con App Router (TypeScript strict mode, `strict: true` en tsconfig).
- **Base de datos**: Firebase Firestore (noSQL).
- **Autenticación**: Firebase Auth (email + contraseña).
- **Autorización**: Firebase Custom Claims + middleware de Next.js para protección de rutas.
- **Almacenamiento de archivos**: Cloudflare R2 (con presigned URLs generadas en el backend — el frontend nunca accede directamente a R2).
- **Correos**: Nodemailer con SMTP (credenciales en variables de entorno).
- **Validación de datos**: Zod — schemas definidos en `src/lib/validations/` y reutilizados en frontend y backend.
- **Estilos**: Tailwind CSS + shadcn/ui como librería de componentes base.
- **Estado del servidor**: React Query (TanStack Query) para fetching, caché e invalidación.
- **Estado global del cliente**: Zustand (solo para estado de UI global como sidebar, modales).
- **Logging**: Pino para logs estructurados en el servidor.
- **TypeScript**: strict mode, `noImplicitAny: true`, tipos compartidos entre front y back en `src/types/`.

---

## 6. ESTRUCTURA DE CARPETAS OBLIGATORIA

```
src/
├── app/
│   ├── (public)/                        # Rutas públicas (sin auth)
│   │   ├── page.tsx                     # Formulario de ingreso de requerimiento
│   │   └── seguimiento/
│   │       └── page.tsx                 # Página pública de consulta de estado
│   ├── (admin)/                         # Rutas protegidas (con auth)
│   │   ├── layout.tsx                   # Layout del panel con sidebar
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── requerimientos/
│   │   │   ├── page.tsx                 # Listado
│   │   │   └── [id]/
│   │   │       └── page.tsx             # Detalle y edición
│   │   ├── usuarios/
│   │   │   └── page.tsx
│   │   └── reportes/
│   │       └── page.tsx
│   ├── api/
│   │   ├── requerimientos/
│   │   │   ├── route.ts                 # GET (listado) / POST (crear)
│   │   │   └── [id]/
│   │   │       └── route.ts             # GET / PATCH / DELETE
│   │   ├── requerimientos/[id]/derivar/
│   │   │   └── route.ts                 # POST — deriva y envía correo
│   │   ├── seguimiento/
│   │   │   └── route.ts                 # GET público — consulta por N° seguimiento + RUT
│   │   ├── usuarios/
│   │   │   └── route.ts                 # GET / POST
│   │   ├── reportes/
│   │   │   └── route.ts                 # GET — genera reporte
│   │   └── upload/
│   │       └── route.ts                 # POST — genera presigned URL de R2
│   └── auth/
│       ├── login/
│       │   └── page.tsx
│       └── recuperar-contrasena/
│           └── page.tsx
│
├── components/
│   ├── ui/                              # Componentes base reutilizables (wraps de shadcn/ui)
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Textarea.tsx
│   │   ├── Badge.tsx                    # Para estados de requerimiento
│   │   ├── DataTable.tsx                # Tabla reutilizable con paginación y filtros
│   │   ├── Modal.tsx
│   │   ├── Tabs.tsx
│   │   ├── Card.tsx
│   │   ├── Alert.tsx                    # Para alertas de vencimiento
│   │   └── FileUpload.tsx               # Componente de subida de archivos a R2
│   ├── forms/
│   │   ├── RequerimientoForm.tsx        # Formulario público de ingreso
│   │   ├── SeguimientoForm.tsx          # Formulario de consulta pública
│   │   └── UsuarioForm.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── PublicLayout.tsx
│   └── features/
│       ├── requerimientos/
│       │   ├── RequerimientoCard.tsx
│       │   ├── RequerimientoStatusBadge.tsx
│       │   ├── RequerimientoFilters.tsx
│       │   ├── DerivacionModal.tsx
│       │   └── AlertaVencimiento.tsx
│       ├── dashboard/
│       │   └── StatsCard.tsx
│       └── reportes/
│           └── ReporteFilters.tsx
│
├── lib/
│   ├── firebase/
│   │   ├── admin.ts                     # Firebase Admin SDK (solo backend)
│   │   ├── client.ts                    # Firebase Client SDK (solo frontend)
│   │   └── firestore-collections.ts     # Nombres de colecciones como constantes
│   ├── r2/
│   │   └── r2-client.ts                 # Cliente de R2 con @aws-sdk/client-s3
│   ├── mail/
│   │   ├── mailer.ts                    # Instancia de Nodemailer
│   │   └── templates/
│   │       ├── confirmacion-vecino.ts
│   │       ├── aviso-admin.ts
│   │       └── derivacion-director.ts
│   ├── validations/
│   │   ├── requerimiento.schema.ts      # Zod schema compartido (incluye validación RUT módulo 11)
│   │   ├── usuario.schema.ts
│   │   └── seguimiento.schema.ts
│   └── utils/
│       ├── numero-seguimiento.ts        # Generador de N° de seguimiento único
│       ├── dias-habiles.ts              # Cálculo de días hábiles restantes
│       ├── rut.ts                       # Validador de RUT chileno (módulo 11)
│       └── response.ts                  # Helper para respuestas de API estandarizadas
│
├── constants/
│   └── direcciones.ts                   # DIRECCIONES_MUNICIPALES con labels y categorías
│
├── services/                            # Capa de servicios (lógica de negocio)
│   ├── requerimiento.service.ts
│   ├── usuario.service.ts
│   ├── notificacion.service.ts          # Toda la lógica de envío de correos
│   ├── r2.service.ts                    # Subida y gestión de archivos
│   └── reporte.service.ts
│
├── repositories/                        # Capa de acceso a datos (Firestore)
│   ├── requerimiento.repository.ts
│   └── usuario.repository.ts
│
├── hooks/                               # React hooks del cliente
│   ├── useAuth.ts
│   ├── useRequerimientos.ts
│   └── useUsuarios.ts
│
└── types/
    ├── requerimiento.types.ts
    ├── usuario.types.ts
    └── auth.types.ts
```

---

## 7. MODELO DE DATOS (Firestore)

### Colección: `requerimientos`
```typescript
interface Requerimiento {
  id: string;
  numeroSeguimiento: string;          // Ej: "REQ-2024-000123"
  // Datos del vecino
  vecino: {
    nombre: string;                   // Nombre
    primerApellido: string;
    segundoApellido?: string;         // Opcional
    rut: string;                      // Formato validado: 12.345.678-9
    telefono: string;
    email: string;
    region: string;                   // Una de las 16 regiones de Chile
    comuna: string;
    direccion: string;
    tipoInmueble: 'Casa' | 'Departamento' | 'Oficina';
  };
  // Datos del requerimiento
  tipoRequerimiento: 'Información' | 'Reclamo' | 'Sugerencia' | 'Felicitación' | 'Solicitud' | 'Denuncia';
  direccionMunicipal: keyof typeof DIRECCIONES_MUNICIPALES; // Ej: "OPERACIONES"
  direccionMunicipalLabel: string;    // Ej: "Dirección de Operaciones" (desnormalizado para reportes)
  categoria: string;                  // Valor del mapeo de categorías de esa dirección
  descripcion: string;
  documentos: {                       // Archivos subidos a R2
    nombre: string;                   // Nombre original sanitizado
    nombreR2: string;                 // UUID usado en R2
    url: string;                      // URL pública o firmada de R2
    tipo: string;                     // "application/pdf"
    tamanio: number;                  // En bytes, máximo 5MB
  }[];
  // Control de estado
  estado: 'pendiente' | 'derivado' | 'en_proceso' | 'completado' | 'rechazado';
  historialEstados: {
    estado: string;
    fecha: Timestamp;
    usuarioId?: string;
    nota?: string;
  }[];
  notas: {
    contenido: string;
    usuarioId: string;
    fecha: Timestamp;
  }[];
  // Control de tiempo
  fechaIngreso: Timestamp;
  fechaLimite: Timestamp;             // fechaIngreso + 20 días hábiles
  fechaResolucion?: Timestamp;
  // Metadata
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}
```

### Colección: `usuarios`
```typescript
interface Usuario {
  id: string;                         // Mismo UID que Firebase Auth
  nombre: string;
  email: string;
  rol: 'superadmin' | 'admin' | 'director' | 'usuario-por-direccion';
  direccionAsignada?: string;         // Solo para director y usuario-por-direccion
  activo: boolean;
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}
```

**Número de seguimiento**: generado con formato `REQ-{AÑO}-{SECUENCIAL_6_DIGITOS}`, usando un documento contador en Firestore con transacción atómica para evitar duplicados.

---

## 8. AUTENTICACIÓN Y SESIÓN (detallado)

- Firebase Auth gestiona login con email y contraseña.
- Al hacer login en el cliente, se obtiene el **Firebase ID Token**.
- El ID Token se envía al backend en una **cookie httpOnly** llamada `session`, con `Secure: true`, `SameSite: Strict`, duración de 1 hora (renovable).
- El backend usa `firebase-admin` para verificar la cookie en cada request protegido con `auth.verifySessionCookie()`.
- Los **Custom Claims** (`rol`, `direccionAsignada`) se setean en el token con `auth.setCustomUserClaims()` al crear el usuario. El frontend los lee desde el token decodificado.
- La **recuperación de contraseña** se maneja con Firebase Auth (`sendPasswordResetEmail`) pero el correo se envía mediante Nodemailer con plantilla HTML personalizada (no el correo por defecto de Firebase).
- El middleware de Next.js (`middleware.ts`) protege todas las rutas bajo `/(admin)` verificando la cookie de sesión antes de que llegue a cualquier página.

---

## 9. SEGURIDAD (multicapa — obligatorio implementar todo)

### 9.1 Firestore Security Rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Todo cerrado por defecto
    match /{document=**} {
      allow read, write: if false;
    }
    // Colección requerimientos: solo el backend (Admin SDK) accede
    // El frontend NUNCA accede directamente a Firestore
    match /requerimientos/{id} {
      allow read, write: if false;
    }
    match /usuarios/{id} {
      allow read, write: if false;
    }
  }
}
```
Todo el acceso a Firestore pasa por el backend con Admin SDK — el frontend no tiene acceso directo.

### 9.2 API Routes (backend)
- **Verificación de sesión**: cada route handler verifica la cookie de sesión con Firebase Admin antes de procesar.
- **Verificación de rol**: después de autenticar, se verifica que el rol del usuario tenga permiso para la operación.
- **Validación de input**: todos los bodies se validan con Zod antes de procesar. Si falla la validación, respuesta 400 con detalle del error.
- **Rate limiting**: implementar rate limiting por IP en las rutas públicas (formulario de ingreso y consulta de seguimiento) — máximo 10 requests/minuto por IP.
- **Sanitización**: todos los inputs de texto se sanitizan para prevenir XSS antes de guardarse en Firestore.
- **CORS**: configurado explícitamente, solo se aceptan requests del dominio propio.
- **Headers de seguridad** en `next.config.js`:
  - `Content-Security-Policy`
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy`
- **Variables de entorno**: nunca exponer variables privadas al cliente. Solo `NEXT_PUBLIC_*` puede estar en el cliente. Validar al arranque con Zod que todas las env vars requeridas existen.

### 9.3 Subida de archivos (R2)
- El cliente solicita una presigned URL al backend (`POST /api/upload`).
- El backend valida el tipo de archivo y tamaño antes de generar la URL:
  - **Formulario público de vecino**: solo PDF, máximo **5MB**.
  - **Uso interno (admin)**: PDF, JPG, PNG, DOCX, máximo **10MB**.
- La presigned URL expira en 5 minutos.
- El cliente sube directamente a R2 con la presigned URL — el backend nunca recibe el archivo binario.
- Los nombres de archivo se reemplazan por UUIDs para evitar path traversal y conflictos.

---

## 10. API ROUTES — CONTRATO COMPLETO

Todas las respuestas siguen el mismo formato estandarizado:
```typescript
// Éxito
{ success: true, data: T, message?: string }
// Error
{ success: false, error: string, details?: ZodIssue[] }
```

### Rutas públicas (sin autenticación)
| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/requerimientos` | Crear nuevo requerimiento (vecino) |
| `GET` | `/api/seguimiento?numero=REQ-2024-000123&rut=12.345.678-9` | Consultar estado público |

### Rutas privadas (requieren cookie de sesión)
| Método | Ruta | Roles permitidos | Descripción |
|---|---|---|---|
| `GET` | `/api/requerimientos` | Todos | Listado (filtrado por rol automáticamente) |
| `GET` | `/api/requerimientos/:id` | Todos | Detalle |
| `PATCH` | `/api/requerimientos/:id` | Todos | Actualizar estado/notas |
| `DELETE` | `/api/requerimientos/:id` | superadmin | Eliminar |
| `POST` | `/api/requerimientos/:id/derivar` | superadmin, admin | Derivar y enviar correo |
| `GET` | `/api/usuarios` | superadmin, admin | Listado de usuarios |
| `POST` | `/api/usuarios` | superadmin | Crear usuario |
| `GET` | `/api/dashboard/stats` | Todos | Estadísticas (filtradas por rol) |
| `GET` | `/api/reportes` | Todos | Generar reporte (filtrado por rol) |
| `POST` | `/api/upload` | Todos | Obtener presigned URL de R2 |
| `POST` | `/api/auth/session` | — | Crear cookie de sesión |
| `DELETE` | `/api/auth/session` | — | Eliminar cookie (logout) |

### Paginación en Firestore
Todas las listas usan cursor-based pagination de Firestore:
```
GET /api/requerimientos?limit=20&cursor=<lastDocId>&estado=pendiente&direccion=<dir>
```

---

## 11. ARQUITECTURA BACKEND — CAPAS Y RESPONSABILIDADES

```
Route Handler (app/api/...)
  ↓ Verifica sesión + rol (AuthGuard)
  ↓ Valida input (Zod)
Service (src/services/)
  ↓ Lógica de negocio, orquestación
Repository (src/repositories/)
  ↓ Solo acceso a Firestore, sin lógica
Firebase Admin SDK
```

- **Route Handlers**: solo reciben request, verifican auth/rol, validan con Zod, llaman al service, devuelven respuesta. Sin lógica de negocio.
- **Services**: toda la lógica de negocio. Orquestan repositories, envío de correos, subida de archivos. Sin código HTTP.
- **Repositories**: solo operaciones de Firestore (get, set, update, query). Sin lógica de negocio.
- **Mailer**: `NotificacionService` encapsula toda lógica de correos. Los services lo invocan pero no saben cómo funciona internamente.

---

## 12. FRONTEND — ARQUITECTURA Y COMPORTAMIENTO

- El frontend **nunca almacena datos sensibles** en `localStorage` ni `sessionStorage`. La sesión vive en una cookie httpOnly.
- El frontend **no renderiza nada** hasta que el backend valide y devuelva los datos.
- Todos los formularios usan **React Hook Form** + **Zod resolver** para validación del lado del cliente (validación previa, no reemplaza la del backend).
- **React Query** gestiona el fetching: caché, revalidación, estados de loading/error.
- Los **componentes UI base** (Button, Input, DataTable, Badge, Modal) son wrappers de shadcn/ui con las clases de Tailwind del design system municipal.
- **Manejo de errores**: cada página tiene un `error.tsx` de Next.js. Los errores de API muestran mensajes claros al usuario sin exponer detalles técnicos.
- **Loading states**: cada tabla y sección tiene su skeleton loader.
- El **DataTable** es un componente genérico que recibe columnas, datos, filtros y paginación — se reutiliza en requerimientos, usuarios y reportes.
- El **RequerimientoStatusBadge** muestra el estado con color correspondiente: Pendiente (amarillo), Derivado (azul), En proceso (naranja), Completado (verde), Rechazado (rojo).
- **AlertaVencimiento**: en el listado y detalle de requerimientos, si quedan ≤3 días hábiles o ya venció, se muestra una alerta visible.

### Comportamiento específico del formulario público

- El select de **Categoría** está deshabilitado (`disabled`) al cargar la página. Se habilita solo cuando el usuario elige una Dirección Municipal, y se repopula dinámicamente con las categorías correspondientes usando el objeto `DIRECCIONES_MUNICIPALES` desde `src/constants/direcciones.ts`.
- La validación de **RUT** usa el algoritmo módulo 11 implementado en `src/lib/utils/rut.ts`. Se valida en tiempo real al salir del campo (`onBlur`), mostrando el error inline bajo el input — nunca con `alert()`.
- La validación de **coincidencia de correos** se hace con Zod `.refine()` al nivel del schema completo del formulario, mostrando el error inline bajo el campo "Confirmar correo".
- El campo de **archivo PDF** valida tipo (`application/pdf`) y tamaño (≤5MB) antes de intentar cualquier upload. El error se muestra inline.
- Al enviar el formulario exitosamente, **no usar `alert()`**. En su lugar, reemplazar el formulario por una pantalla de éxito que muestre:
  - Ícono de check verde grande.
  - Mensaje: "¡Requerimiento ingresado exitosamente!"
  - El **número de seguimiento** en grande y destacado (ej: `REQ-2024-000123`).
  - Indicación de que recibirá un correo de confirmación en su email.
  - Botón "Ingresar otro requerimiento" que resetea la vista al formulario.
- El select de **Región** contiene las 16 regiones de Chile en orden geográfico norte-sur: Arica y Parinacota, Tarapacá, Antofagasta, Atacama, Coquimbo, Valparaíso, Región Metropolitana, O'Higgins, Maule, Ñuble, Biobío, La Araucanía, Los Ríos, Los Lagos, Aysén, Magallanes.

---

## 13. VARIABLES DE ENTORNO REQUERIDAS

```env
# Firebase Admin (solo backend)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Firebase Client (frontend)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=

# SMTP (Nodemailer)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=                             # "Municipalidad X <noreply@municipalidad.cl>"

# App
NEXTAUTH_SECRET=                       # Para firmar cookies de sesión
NEXT_PUBLIC_APP_URL=
```

Validar todas las variables al arranque con un archivo `src/lib/env.ts` usando Zod — si falta alguna, la app no arranca y muestra qué variable falta.

---

## 14. MANEJO DE ERRORES — ESTÁNDAR

### Backend
- Todos los errores pasan por un helper `createErrorResponse(status, message, details?)`.
- Errores de Zod: 400 con `details` del array de issues.
- No autenticado: 401.
- Sin permisos: 403.
- No encontrado: 404.
- Error interno: 500 con mensaje genérico (el detalle va al logger de Pino, nunca al cliente).

### Frontend
- `error.tsx` por cada segmento de ruta importante.
- Los errores de React Query se capturan y muestran en un componente `ErrorMessage` estandarizado.
- Nunca se muestran stack traces ni mensajes técnicos al usuario.

---

## 15. TYPESCRIPT — REGLAS ESTRICTAS

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

- Todos los tipos del dominio viven en `src/types/` y son importados tanto en frontend como backend.
- Prohibido usar `any`. Usar `unknown` cuando sea necesario y hacer type narrowing explícito.
- Todos los schemas de Zod exportan su tipo inferido: `export type RequerimientoInput = z.infer<typeof requerimientoSchema>`.

---

## 16. LOGGING

- Usar **Pino** para logs estructurados en el servidor.
- Niveles: `info` para operaciones normales, `warn` para situaciones inesperadas no críticas, `error` para errores con stack trace.
- Cada log incluye: `timestamp`, `level`, `route`, `userId` (si aplica), `message`, `data`.
- Los logs de errores 500 incluyen el stack trace completo.
- Nunca loggear datos sensibles (contraseñas, tokens, RUT completo).

---

## 17. LO QUE NO ENTRA EN ESTE PROMPT (se define después)

- Testing (unit, integration, e2e) — se agrega en una segunda iteración.
- Deploy y CI/CD — se define según la infraestructura del cliente.
- Internacionalización (i18n) — no aplica por ahora.
- Dark mode — no requerido por ahora.
- PWA / notificaciones push — no requerido por ahora.

---

## INSTRUCCIÓN FINAL AL AI

Construye el sistema completo respetando estrictamente toda la arquitectura, estructura de carpetas, modelos de datos, contratos de API, capas de seguridad y convenciones de TypeScript definidas en este prompt. Comienza por:

1. La estructura base del proyecto con `tsconfig.json`, `next.config.js` con headers de seguridad, y validación de variables de entorno en `src/lib/env.ts`.
2. Los tipos en `src/types/`.
3. Los schemas de Zod en `src/lib/validations/`.
4. La configuración de Firebase Admin y Client en `src/lib/firebase/`.
5. Los repositories.
6. Los services.
7. Las API routes.
8. Los componentes UI base.
9. Las páginas.

Ante cualquier ambigüedad, pregunta antes de asumir.
