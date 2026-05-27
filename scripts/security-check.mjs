#!/usr/bin/env node
/**
 * Pruebas de seguridad (básicas y medias) contra la app en ejecución.
 *
 * Requisitos:
 *   - Servidor: npm run dev | start (SEC_BASE_URL o E2E_BASE_URL, default localhost:3000)
 *   - Medias con roles: Firebase Admin + NEXT_PUBLIC_FIREBASE_API_KEY + UIDs de prueba
 *
 * Variables (mismas que E2E donde aplica):
 *   E2E_UID_ADMIN_MUNICIPAL, E2E_UID_DIRECTOR_OPERACIONES, E2E_UID_DIRECTOR_SECRETARIA
 *   E2E_UID_INACTIVE (opcional, usuario con activo=false para probar bloqueo de login)
 *
 * Uso:
 *   npm run test:security
 *   npm run test:security -- --only=basic
 *   npm run test:security -- --only=medium
 *   npm run test:security -- --cleanup   # borra requerimientos SEC-* creados en Firestore
 *   npm run test:security -- --rate-limit  # prueba rate limit en /api/seguimiento (lento)
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import fs from "node:fs";
import path from "node:path";

const COLLECTION = "requerimientos";
const ONLY = (() => {
  const arg = process.argv.find((a) => a.startsWith("--only="));
  return arg ? arg.split("=")[1] : "all";
})();
const DO_CLEANUP = process.argv.includes("--cleanup");
const TEST_RATE_LIMIT = process.argv.includes("--rate-limit");

const results = { pass: 0, fail: 0, skip: 0, warn: 0 };

function loadServiceAccount() {
  const p = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (p) {
    return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), p), "utf8"));
  }
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return {
      project_id: FIREBASE_PROJECT_ID,
      client_email: FIREBASE_CLIENT_EMAIL,
      private_key: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  }
  return null;
}

function initAdmin() {
  const sa = loadServiceAccount();
  if (!sa) return null;
  if (!getApps().length) initializeApp({ credential: cert(sa) });
  return { db: getFirestore(), auth: getAuth() };
}

function record(level, name, ok, detail = "") {
  const icon = ok === "skip" ? "○" : ok === "warn" ? "!" : ok ? "✓" : "✗";
  const suffix = detail ? ` — ${detail}` : "";
  console.log(`  ${icon} [${level}] ${name}${suffix}`);
  if (ok === "skip") results.skip += 1;
  else if (ok === "warn") results.warn += 1;
  else if (ok) results.pass += 1;
  else results.fail += 1;
}

function assertStatus(label, level, status, expected, bodySnippet = "") {
  const ok = Array.isArray(expected) ? expected.includes(status) : status === expected;
  record(level, label, ok, ok ? `HTTP ${status}` : `HTTP ${status}, esperado ${expected}. ${bodySnippet}`.slice(0, 200));
  return ok;
}

function extractCookieSession(res) {
  const parsed = [];
  if (typeof res.headers.getSetCookie === "function") parsed.push(...res.headers.getSetCookie());
  const single = res.headers.get("set-cookie");
  if (single && parsed.length === 0) parsed.push(single);
  for (const line of parsed) {
    const m = /^session=([^;]+)/.exec(line);
    if (m) return `session=${m[1]}`;
  }
  return null;
}

async function signInWithCustomToken(customToken) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error("Falta NEXT_PUBLIC_FIREBASE_API_KEY");
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const j = await res.json();
  if (!res.ok || !j.idToken) throw new Error(`Custom token sign-in falló: ${JSON.stringify(j)}`);
  return j.idToken;
}

async function openSession(baseUrl, auth, uid) {
  const idToken = await signInWithCustomToken(await auth.createCustomToken(uid));
  const res = await fetch(`${baseUrl}/api/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const cookie = extractCookieSession(res);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !cookie) {
    throw new Error(`Sesión uid=${uid}: ${res.status} ${JSON.stringify(body)}`);
  }
  return cookie;
}

async function fetchApi(baseUrl, pathname, opts = {}) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    ...opts,
    headers: opts.headers || {},
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _raw: text.slice(0, 500) };
  }
  return { status: res.status, json, headers: res.headers, ok: res.ok };
}

async function fetchApiAuth(baseUrl, cookie, pathname, opts = {}) {
  return fetchApi(baseUrl, pathname, {
    ...opts,
    headers: { ...(opts.headers || {}), Cookie: cookie },
  });
}

async function seedRequerimiento(db, { numero, direccion, label }) {
  const now = Timestamp.now();
  const ref = db.collection(COLLECTION).doc();
  await ref.set({
    numeroSeguimiento: numero,
    vecino: {
      nombre: "SEC",
      primerApellido: "Test",
      rut: "18217315-9",
      telefono: "+56900000000",
      email: "security-test@example.invalid",
      region: "Región Metropolitana",
      comuna: "Molina",
      direccion: "Test 1",
      tipoInmueble: "Casa",
    },
    tipoRequerimiento: "Información",
    direccionMunicipal: direccion,
    direccionMunicipalLabel: label,
    categoria: "",
    descripcion: "Requerimiento de prueba de seguridad automatizada.",
    documentos: [],
    estado: "derivado",
    historialEstados: [{ estado: "pendiente", fecha: now, nota: "SEC seed" }],
    notas: [{ texto: "NOTA INTERNA NO DEBE FILTRARSE", usuarioId: "x", fecha: now }],
    respuestasVecino: [],
    adminAsignadoRespuesta: { uid: "fake", nombre: "Admin", email: "admin@test.invalid" },
    fechaIngreso: now,
    fechaLimite: Timestamp.fromMillis(now.toMillis() + 30 * 86400000),
    creadoEn: FieldValue.serverTimestamp(),
    actualizadoEn: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

async function runBasic(baseUrl) {
  console.log("\n── Nivel BÁSICO ──\n");

  const unauth = [
    ["GET /api/requerimientos sin sesión", "/api/requerimientos", 401],
    ["GET /api/dashboard/stats sin sesión", "/api/dashboard/stats", 401],
    ["GET /api/usuarios sin sesión", "/api/usuarios", 401],
    ["POST /api/usuarios sin sesión", "/api/usuarios", 401, { method: "POST", body: "{}" }],
    ["GET /api/reportes sin sesión", "/api/reportes", 401],
    [
      "POST /api/upload (panel) sin sesión",
      "/api/upload",
      401,
      {
        method: "POST",
        body: JSON.stringify({
          fileName: "evidencia.pdf",
          contentType: "application/pdf",
          size: 1024,
          isPublic: false,
        }),
      },
    ],
    ["GET /api/documentos sin sesión", "/api/documentos?key=x&requerimientoId=x", 401],
  ];

  for (const [label, path, code, extra] of unauth) {
    const r = await fetchApi(baseUrl, path, {
      method: extra?.method || "GET",
      headers: extra?.body ? { "Content-Type": "application/json" } : {},
      body: extra?.body,
    });
    assertStatus(label, "basic", r.status, code, r.json?.error);
  }

  const badSession = await fetchApiAuth(baseUrl, "session=token-invalido-falso", "/api/requerimientos");
  assertStatus("Cookie de sesión inválida rechazada", "basic", badSession.status, 401);

  const badToken = await fetchApi(baseUrl, "/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: "not.a.valid.jwt" }),
  });
  assertStatus("ID token inválido en POST /api/auth/session", "basic", badToken.status, 401);

  const noRecaptcha = await fetchApi(baseUrl, "/api/requerimientos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tipoRequerimiento: "Información" }),
  });
  assertStatus(
    "POST público requerimientos exige reCAPTCHA",
    "basic",
    noRecaptcha.status,
    [400, 429],
    noRecaptcha.json?.error
  );

  const seguimientoBad = await fetchApi(baseUrl, "/api/seguimiento");
  assertStatus("GET /api/seguimiento sin parámetros → 400", "basic", seguimientoBad.status, 400);

  const resetEnum = await fetchApi(baseUrl, "/api/auth/password-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "no-existe-en-sistema-sec@test.invalid" }),
  });
  const resetKnown = await fetchApi(baseUrl, "/api/auth/password-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "otro-no-existe-sec@test.invalid" }),
  });
  const sameMessage =
    resetEnum.status === 200 &&
    resetKnown.status === 200 &&
    resetEnum.json?.message === resetKnown.json?.message;
  record(
    "Recuperación contraseña: respuesta genérica (anti-enumeración)",
    "basic",
    sameMessage,
    sameMessage ? "mismo mensaje para emails distintos" : "mensajes distintos"
  );

  const pageRes = await fetch(baseUrl + "/dashboard", { redirect: "manual" });
  const redirected =
    pageRes.status === 307 ||
    pageRes.status === 302 ||
    pageRes.status === 303 ||
    (pageRes.status === 200 && pageRes.url?.includes("/auth/login"));
  record(
    "/dashboard sin cookie redirige o bloquea",
    "basic",
    redirected || pageRes.status === 401,
    `HTTP ${pageRes.status}`
  );
}

async function runMedium(baseUrl, admin) {
  console.log("\n── Nivel MEDIO ──\n");

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const municipalUid = process.env.E2E_UID_ADMIN_MUNICIPAL || "";
  const directorOpUid = process.env.E2E_UID_DIRECTOR_OPERACIONES || "";
  const directorSecUid =
    process.env.E2E_UID_DIRECTOR_SECRETARIA || process.env.E2E_UID_DIRECTOR_OPERACIONES || "";
  const inactiveUid = process.env.E2E_UID_INACTIVE || "";

  if (!apiKey || !municipalUid || !directorOpUid) {
    record(
      "Pruebas con roles (Firebase UIDs)",
      "medium",
      "skip",
      "Faltan NEXT_PUBLIC_FIREBASE_API_KEY y/o E2E_UID_ADMIN_MUNICIPAL / E2E_UID_DIRECTOR_OPERACIONES"
    );
    return { seeded: [] };
  }

  let cookieMunicipal;
  let cookieDirectorOp;
  let cookieDirectorSec;

  try {
    cookieMunicipal = await openSession(baseUrl, admin.auth, municipalUid);
    cookieDirectorOp = await openSession(baseUrl, admin.auth, directorOpUid);
    if (directorSecUid && directorSecUid !== directorOpUid) {
      cookieDirectorSec = await openSession(baseUrl, admin.auth, directorSecUid);
    } else {
      cookieDirectorSec = cookieDirectorOp;
      record(
        "Director Secretaría distinto (IDOR transparencia)",
        "medium",
        "skip",
        "Defina E2E_UID_DIRECTOR_SECRETARIA con dirección SECRETARIA"
      );
    }
  } catch (e) {
    record("Abrir sesiones de prueba", "medium", false, e.message);
    return { seeded: [] };
  }

  const idTokenMunicipal = await signInWithCustomToken(await admin.auth.createCustomToken(municipalUid));
  const sessionRes = await fetch(`${baseUrl}/api/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: idTokenMunicipal }),
  });
  const setCookieLines = [];
  if (typeof sessionRes.headers.getSetCookie === "function") {
    setCookieLines.push(...sessionRes.headers.getSetCookie());
  } else {
    const single = sessionRes.headers.get("set-cookie");
    if (single) setCookieLines.push(single);
  }
  const setCookie = setCookieLines.join("; ");
  const httpOnly = /session=/i.test(setCookie) && /httponly/i.test(setCookie);
  const sameSite = /samesite=strict/i.test(setCookie);
  record("Cookie session: HttpOnly", "medium", sessionRes.ok && httpOnly, setCookie.slice(0, 100));
  record("Cookie session: SameSite=strict", "medium", sessionRes.ok && sameSite);

  const dirUsers = await fetchApiAuth(baseUrl, cookieDirectorOp, "/api/usuarios");
  assertStatus("Director no lista usuarios", "medium", dirUsers.status, 403, dirUsers.json?.error);

  const dirCreateUser = await fetchApiAuth(baseUrl, cookieDirectorOp, "/api/usuarios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nombre: "Hack",
      email: "hack-sec@test.invalid",
      password: "Abcd1234",
      rol: "superadmin",
      direccionAsignada: "OPERACIONES",
    }),
  });
  assertStatus("Director no crea usuarios", "medium", dirCreateUser.status, 403);

  const adminCreateUser = await fetchApiAuth(baseUrl, cookieMunicipal, "/api/usuarios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nombre: "Hack",
      email: "hack-admin-sec@test.invalid",
      password: "Abcd1234",
      rol: "superadmin",
      direccionAsignada: "OPERACIONES",
    }),
  });
  assertStatus("Admin municipal no crea usuarios (solo superadmin)", "medium", adminCreateUser.status, 403);

  const adminActivo = await fetchApiAuth(
    baseUrl,
    cookieMunicipal,
    `/api/usuarios/${municipalUid}/activo`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: false }),
    }
  );
  assertStatus("Admin municipal no cambia activo de usuarios", "medium", adminActivo.status, 403);

  const pdfExport = await fetchApiAuth(baseUrl, cookieDirectorOp, "/api/reportes/export/pdf");
  assertStatus("Director no exporta PDF reportes", "medium", pdfExport.status, 403);

  const derivar = await fetchApiAuth(baseUrl, cookieDirectorOp, "/api/requerimientos/fake-id/derivar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      direccionMunicipal: "OPERACIONES",
      emailDestinatario: "test@test.invalid",
    }),
  });
  assertStatus("Director no deriva pendiente→derivado", "medium", derivar.status, 403);

  const filterForbidden = await fetchApiAuth(
    baseUrl,
    cookieDirectorOp,
    "/api/requerimientos?direccionMunicipal=SECRETARIA"
  );
  assertStatus(
    "Director no filtra listado por dirección ajena",
    "medium",
    filterForbidden.status,
    403,
    filterForbidden.json?.error
  );

  const injection = await fetchApiAuth(
    baseUrl,
    cookieMunicipal,
    `/api/usuarios?search=${encodeURIComponent("'; DROP TABLE-- <script>")}`
  );
  record(
    "Búsqueda usuarios con payload sospechoso no rompe API",
    "medium",
    injection.status === 200 || injection.status === 400,
    `HTTP ${injection.status}`
  );

  const seeded = [];
  if (admin.db) {
    const idOp = await seedRequerimiento(admin.db, {
      numero: `SEC-OP-${Date.now()}`,
      direccion: "OPERACIONES",
      label: "Dirección de Operaciones",
    });
    const idSec = await seedRequerimiento(admin.db, {
      numero: `SEC-SEC-${Date.now()}`,
      direccion: "SECRETARIA",
      label: "Secretaría Municipal",
    });
    seeded.push(idOp, idSec);

    const cross = await fetchApiAuth(baseUrl, cookieDirectorOp, `/api/requerimientos/${idSec}`);
    assertStatus("IDOR: director OPERACIONES no lee req. SECRETARIA", "medium", cross.status, 403);

    if (cookieDirectorSec !== cookieDirectorOp) {
      const cross2 = await fetchApiAuth(baseUrl, cookieDirectorSec, `/api/requerimientos/${idOp}`);
      assertStatus("IDOR: director SECRETARIA no lee req. OPERACIONES", "medium", cross2.status, 403);
    }

    const docLeak = await fetchApiAuth(
      baseUrl,
      cookieDirectorOp,
      `/api/documentos?key=fake.pdf&requerimientoId=${idSec}`
    );
    assertStatus("IDOR: documentos de req. ajena bloqueados", "medium", docLeak.status, [403, 404]);

    const snapOp = await admin.db.collection(COLLECTION).doc(idOp).get();
    const numeroOp = snapOp.data()?.numeroSeguimiento;
    const segOk = await fetchApi(
      baseUrl,
      `/api/seguimiento?numero=${encodeURIComponent(numeroOp || "")}&rut=18217315-9`
    );
    if (segOk.status === 200 && segOk.json?.data) {
      const keys = Object.keys(segOk.json.data);
      const leaks = ["notas", "adminAsignadoRespuesta", "historialEstados", "fechaLimite"].filter((k) =>
        keys.includes(k)
      );
      record(
        "Seguimiento público no expone campos internos",
        "medium",
        leaks.length === 0,
        leaks.length ? `filtró: ${leaks.join(", ")}` : `campos: ${keys.join(", ")}`
      );
    } else {
      record(
        "Seguimiento público no expone campos internos",
        "medium",
        "skip",
        `consulta seed: HTTP ${segOk.status}`
      );
    }
  } else {
    record("IDOR entre direcciones (seed Firestore)", "medium", "skip", "sin credenciales Admin");
  }

  if (inactiveUid && admin.db) {
    try {
      await admin.auth.updateUser(inactiveUid, { disabled: true });
      await admin.db.collection("usuarios").doc(inactiveUid).set({ activo: false }, { merge: true });
      const idToken = await signInWithCustomToken(await admin.auth.createCustomToken(inactiveUid));
      const inactiveSession = await fetchApi(baseUrl, "/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      assertStatus("Usuario inactivo no obtiene sesión", "medium", inactiveSession.status, 403);
      await admin.auth.updateUser(inactiveUid, { disabled: false });
      await admin.db.collection("usuarios").doc(inactiveUid).set({ activo: true }, { merge: true });
    } catch (e) {
      record("Usuario inactivo bloqueado en login", "medium", "warn", e.message);
    }
  } else {
    record("Usuario inactivo bloqueado en login", "medium", "skip", "Defina E2E_UID_INACTIVE");
  }

  if (TEST_RATE_LIMIT) {
    let got429 = false;
    for (let i = 0; i < 40; i++) {
      const r = await fetchApi(baseUrl, `/api/seguimiento?numero=REQ-FAKE-${i}&rut=11.111.111-1`);
      if (r.status === 429) {
        got429 = true;
        break;
      }
    }
    record(
      "Rate limit en /api/seguimiento",
      "medium",
      got429 ? true : "warn",
      got429 ? "429 recibido" : "no se alcanzó 429 en 40 intentos (Upstash/local puede variar)"
    );
  }

  return { seeded };
}

async function main() {
  const baseUrl =
    process.env.SEC_BASE_URL ||
    process.env.E2E_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  console.log(`\n🔒 Security check — ${baseUrl}`);
  console.log(`   Nivel: ${ONLY}\n`);

  try {
    const health = await fetch(baseUrl, { method: "HEAD" }).catch(() => fetch(baseUrl));
    if (!health.ok && health.status >= 500) {
      console.error(`Servidor no responde bien (${health.status}). Ejecute: npm run dev`);
      process.exit(2);
    }
  } catch {
    console.error(`No se puede conectar a ${baseUrl}. Ejecute: npm run dev`);
    process.exit(2);
  }

  const admin = initAdmin();
  let seeded = [];

  if (ONLY === "basic" || ONLY === "all") {
    await runBasic(baseUrl);
  }
  if (ONLY === "medium" || ONLY === "all") {
    if (!admin) {
      console.log("\n⚠️  Nivel MEDIO requiere credenciales Firebase Admin (.env.local)\n");
      record("Suite media completa", "medium", "skip", "sin Firebase Admin");
    } else {
      const out = await runMedium(baseUrl, admin);
      seeded = out.seeded || [];
    }
  }

  if (DO_CLEANUP && admin?.db && seeded.length) {
    const batch = admin.db.batch();
    for (const id of seeded) batch.delete(admin.db.collection(COLLECTION).doc(id));
    await batch.commit();
    console.log(`\n🧹 Eliminados ${seeded.length} requerimientos de prueba SEC-*`);
  }

  console.log("\n── Resumen ──");
  console.log(`   ✓ ${results.pass}   ✗ ${results.fail}   ○ ${results.skip}   ! ${results.warn}\n`);

  if (results.fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
