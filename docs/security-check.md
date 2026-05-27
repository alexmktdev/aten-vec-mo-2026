# Pruebas de seguridad automatizadas

Script: `scripts/security-check.mjs`  
Comando: `npm run test:security`

Ejecuta comprobaciones **básicas** (sin credenciales) y **medias** (con Firebase Admin y usuarios de prueba), contra la app en ejecución (`next dev` o `next start`).

> No sustituye un pentest profesional. Sirve como regresión rápida de controles ya implementados.

## Requisitos

1. Servidor local o staging accesible:
   - `SEC_BASE_URL`, `E2E_BASE_URL` o `NEXT_PUBLIC_APP_URL` (default `http://localhost:3000`)
2. **Nivel básico:** solo el servidor.
3. **Nivel medio:** además:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - Credenciales Firebase Admin (igual que otros scripts)
   - `E2E_UID_ADMIN_MUNICIPAL`
   - `E2E_UID_DIRECTOR_OPERACIONES` (director con dirección **OPERACIONES**)
   - `E2E_UID_DIRECTOR_SECRETARIA` (director solo **SECRETARIA**, recomendado para IDOR)
   - `E2E_UID_INACTIVE` (opcional: usuario que dejará `activo=false` temporalmente)

## Ejecución

```bash
# Terminal 1
npm run dev

# Terminal 2 — todo
npm run test:security

# Solo básico (CI rápido, sin Firebase)
npm run test:security -- --only=basic

# Solo medio
npm run test:security -- --only=medium

# Borrar requerimientos SEC-* creados en Firestore
npm run test:security -- --cleanup

# Probar rate limit en seguimiento (~40 requests)
npm run test:security -- --rate-limit
```

Código de salida: `0` si todo pasa, `1` si hay fallos, `2` si el servidor no responde.

## Qué valida

### Básico

| Prueba | Esperado |
|--------|----------|
| APIs admin sin cookie | 401 |
| Cookie `session` inválida | 401 |
| ID token inválido en sesión | 401 |
| POST público crear requerimiento sin reCAPTCHA | 400 (o 429 si rate limit) |
| Seguimiento sin parámetros | 400 |
| Recuperación contraseña | Mismo mensaje para emails inexistentes |
| `/dashboard` sin sesión | Redirección a login |

### Medio

| Prueba | Esperado |
|--------|----------|
| Atributos cookie de sesión | HttpOnly, SameSite=strict |
| Director → listar/crear usuarios | 403 |
| Admin municipal → crear usuario / cambiar activo | 403 |
| Director → export PDF reportes | 403 |
| Director → derivar pendiente | 403 |
| Director → filtrar por dirección ajena | 403 |
| IDOR entre direcciones (seed Firestore) | 403 al leer req. ajena |
| Documentos de req. ajena | 403/404 |
| Seguimiento público | Sin notas, admin asignado, historial, plazo |
| Usuario inactivo (`E2E_UID_INACTIVE`) | 403 al crear sesión |
| Rate limit (`--rate-limit`) | 429 tras muchas consultas |

## Límites

- No prueba reCAPTCHA real ni formulario público completo.
- No escanea dependencias (usar `npm audit` aparte).
- Rate limit depende de Upstash o bucket en memoria del proceso Node.
- Las pruebas IDOR crean documentos `SEC-*` en Firestore si no usa `--cleanup`.
