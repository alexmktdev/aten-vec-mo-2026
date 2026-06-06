# Rate limiting con Upstash Redis

El proyecto usa **@upstash/ratelimit** con **ventana deslizante** por IP. En producción (Vercel serverless) el límite es **global** entre todas las instancias. Sin Upstash, el fallback es un bucket en memoria del proceso (solo útil en local).

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | URL REST de la base Redis en [Upstash Console](https://console.upstash.com/) |
| `UPSTASH_REDIS_REST_TOKEN` | Token REST de la misma base |

Agréguelas en **Vercel → Project → Settings → Environment Variables** (Production y Preview) y en `.env.local` para desarrollo.

## Crear la base en Upstash

1. Entra a https://console.upstash.com/
2. **Create Database** → elige región cercana a su deploy (ej. `us-east-1` si Vercel usa `iad1`)
3. En la pestaña **REST API**, copia **UPSTASH_REDIS_REST_URL** y **UPSTASH_REDIS_REST_TOKEN**
4. Pégalas en Vercel y redeploy

## Límites actuales (por IP / minuto)

| Ruta | Prefijo | Máx. req/min |
|------|---------|--------------|
| `GET /api/seguimiento` | `seguimiento` | 30 |
| `POST /api/requerimientos` (público) | `requerimientos-create` | 15 |
| `POST /api/upload` | `upload` | 20 |
| `GET /api/documentos` | `documentos` | 30 |
| `POST /api/auth/session` | `auth-session` | 20 |
| `POST /api/auth/password-reset` | `password-reset` | 5 |
| `POST /api/auth/password-reset/confirm` | `password-reset-confirm` | 5 |

Los presets están en `src/lib/rate-limit.ts` → `RATE_LIMIT_PRESETS`.

## Respuesta al exceder el límite

- HTTP **429**
- Header **Retry-After** (segundos)
- Headers **X-RateLimit-Limit** y **X-RateLimit-Remaining**

## Verificación

```bash
npm run dev
# Con Upstash configurado en .env.local:
npm run test:security -- --rate-limit
```

Sin `--rate-limit`, el script de seguridad no prueba el 429.

## Integración Vercel + Upstash

En el marketplace de Vercel puede vincular Upstash Redis al proyecto; Vercel inyecta automáticamente las variables `UPSTASH_REDIS_REST_*`.
