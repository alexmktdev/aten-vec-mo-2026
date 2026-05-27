# Prueba automática de flujos de requerimientos (E2E)

El script `scripts/e2e-requerimientos-flows.mjs` recorre los flujos principales contra tu instancia **en ejecución** (`next dev` o `next start`) usando la misma capa HTTP que el panel.

## Requisitos

1. **Servidor local** (o URL de staging) accesible:
   - `E2E_BASE_URL` o `NEXT_PUBLIC_APP_URL` (por defecto `http://localhost:3000`).
2. **Credenciales Firebase Admin** (igual que otros scripts):
   - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, o `FIREBASE_SERVICE_ACCOUNT_PATH`.
3. **API key del cliente** (Identity Toolkit, para canjear el custom token):
   - `NEXT_PUBLIC_FIREBASE_API_KEY`.
4. **UIDs de usuarios reales** en Firebase Auth con roles y direcciones correctas:
   - `E2E_UID_ADMIN_MUNICIPAL` — rol `admin-municipal` (o `admin` legacy).
   - `E2E_UID_ADMIN_TRANSPARENCIA` — rol `admin-transparencia`.
   - `E2E_UID_DIRECTOR_OPERACIONES` — `director` con dirección **OPERACIONES** (o la que uses en el script).
   - `E2E_UID_DIRECTOR_SECRETARIA` — `director` con **SECRETARIA** (transparencia).

Los UID los ves en Firebase Console → Authentication → Usuario → UID.

## Qué flujos ejecuta

| # | Tipo | Pasos resumidos |
|---|------|-----------------|
| 1 | Información | Pendiente → admin municipal deriva a OPERACIONES → director **en proceso** → deriva respuesta final → admin municipal responde y cierra. **Reclamo / Sugerencia / Felicitación** siguen la misma lógica en el código; puedes duplicar el bloque INF cambiando el tipo. |
| 2 | Solicitud Vecinal | Semilla ya en proceso en OPERACIONES → director responde al vecino directo. |
| 3 | Solicitud de transparencia | Pendiente → admin deriva solo a SECRETARIA → director en proceso → deriva respuesta final a admin transparencia → admin envía respuesta. |

Los requerimientos de prueba tienen número `E2E-...`.

## Ejecución

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run test:e2e-requerimientos
```

Opciones:

- `--cleanup` — después de ejecutar los flujos, **borra desde Firestore** los documentos creados en esa corrida (no pasa por la API).

## Correos de derivación

El script usa los mismos correos configurados que el backend (`CORREOS_DIRECCION` en código). Si en tu entorno cambian, puede fallar el `POST …/derivar` con «El correo debe coincidir…».

## Límites

- Envía correos reales si SMTP está configurado (igual que en producción/staging).
- No sustituye pruebas manuales del formulario público (reCAPTCHA).
- Rate limit del `POST` público de creación **no** aplica porque la creación de prueba es directa en Firestore.
