#!/usr/bin/env node
/**
 * E2E contra las route handlers de Next: autenticación con Custom Token (Admin SDK)
 * + cookie de sesión, luego llamadas HTTP. Crea requerimientos de prueba en Firestore
 * (evita formulario público y reCAPTCHA).
 *
 * Variables (ver docs/e2e-requerimientos-flujos.md):
 *   E2E_BASE_URL — default NEXT_PUBLIC_APP_URL o http://localhost:3000
 *   NEXT_PUBLIC_FIREBASE_API_KEY
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (o FIREBASE_SERVICE_ACCOUNT_PATH)
 *   E2E_UID_ADMIN_MUNICIPAL, E2E_UID_ADMIN_TRANSPARENCIA,
 *   E2E_UID_DIRECTOR_OPERACIONES, E2E_UID_DIRECTOR_SECRETARIA
 *
 * Opciones: --cleanup  borra al final los docs creados (Firestore Admin)
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import fs from "node:fs";
import path from "node:path";

const COLLECTION_REQUERIMIENTOS = "requerimientos";

/** Debe coincidir con src/constants/direcciones-correos.ts */
const CORREO_OPERACIONES = "jpereira@molina.cl";
const CORREO_SECRETARIA = "alexanderzananiri17@gmail.com";

const LABEL_OPERACIONES = "Dirección de Operaciones";

const DO_CLEANUP = process.argv.includes("--cleanup");

function loadServiceAccount() {
  const p = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (p) {
    const resolved = path.resolve(process.cwd(), p);
    return JSON.parse(fs.readFileSync(resolved, "utf8"));
  }
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return {
      project_id: FIREBASE_PROJECT_ID,
      client_email: FIREBASE_CLIENT_EMAIL,
      private_key: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  }
  throw new Error(
    "Faltan FIREBASE_SERVICE_ACCOUNT_PATH o FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY"
  );
}

function initAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: cert(loadServiceAccount()) });
  }
  return { db: getFirestore(), auth: getAuth() };
}

function vecinoDummy(suffix) {
  return {
    nombre: "E2E",
    primerApellido: `Test ${suffix}`,
    segundoApellido: "",
    rut: "18217315-9",
    telefono: "+56987654321",
    email: "e2e-vecino-test@example.com",
    confirmarEmail: "e2e-vecino-test@example.com",
    region: "Región Metropolitana",
    comuna: "Molina",
    direccion: "Pasaje Automático 123",
    tipoInmueble: "Casa",
  };
}

function baseSeed({
  numeroSeguimiento,
  tipoRequerimiento,
  estado,
  direccionMunicipal,
  direccionMunicipalLabel,
  historialEstados,
}) {
  const now = Timestamp.now();
  const fechaLimite = Timestamp.fromMillis(now.toMillis() + 30 * 24 * 60 * 60 * 1000);
  return {
    numeroSeguimiento,
    vecino: vecinoDummy(numeroSeguimiento),
    tipoRequerimiento,
    direccionMunicipal,
    direccionMunicipalLabel,
    categoria: "",
    descripcion:
      "Texto automático E2E. Descripción suficientemente larga para validar el flujo sin depender del formulario público.",
    documentos: [],
    estado,
    historialEstados:
      historialEstados ?? [{ estado: "pendiente", fecha: now, nota: "E2E: ingreso simulado" }],
    notas: [],
    respuestasVecino: [],
    fechaIngreso: now,
    fechaLimite,
    creadoEn: FieldValue.serverTimestamp(),
    actualizadoEn: FieldValue.serverTimestamp(),
  };
}

async function seedRequerimiento(db, payload) {
  const ref = db.collection(COLLECTION_REQUERIMIENTOS).doc();
  await ref.set(payload);
  return ref.id;
}

function extractCookieSession(res) {
  const parsed = [];
  if (typeof res.headers.getSetCookie === "function") {
    parsed.push(...res.headers.getSetCookie());
  }
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
  if (!res.ok || !j.idToken) {
    throw new Error(`signInWithCustomToken falló: ${JSON.stringify(j)}`);
  }
  return j.idToken;
}

async function openSession(baseUrl, auth, uid) {
  const custom = await auth.createCustomToken(uid);
  const idToken = await signInWithCustomToken(custom);
  const res = await fetch(`${baseUrl}/api/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const cookie = extractCookieSession(res);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !cookie) {
    throw new Error(`No se pudo abrir sesión: ${res.status} ${JSON.stringify(body)}`);
  }
  return cookie;
}

async function apiJson(baseUrl, cookie, pathname, opts = {}) {
  const headers = {
    ...(opts.headers || {}),
    Cookie: cookie,
  };
  if (opts.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const res = await fetch(`${baseUrl}${pathname}`, { ...opts, headers });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Respuesta no JSON ${pathname}: ${res.status} ${text.slice(0, 400)}`);
  }
  return { ok: res.ok, status: res.status, json };
}

function assertSuccess(label, result) {
  const { ok, status, json } = result;
  if (!ok || !json.success) {
    console.error(JSON.stringify(json, null, 2));
    throw new Error(`[FAIL] ${label} HTTP ${status}: ${json.error || "success=false"}`);
  }
}

function assertEstado(payload, esperado, label) {
  if (payload.estado !== esperado) {
    throw new Error(`${label}: estado esperado ${esperado}, actual ${payload.estado}`);
  }
}

async function getRequerimiento(baseUrl, cookie, id) {
  const r = await apiJson(baseUrl, cookie, `/api/requerimientos/${id}`);
  assertSuccess(`GET /api/requerimientos/${id}`, r);
  return r.json.data;
}

async function run() {
  const baseUrl =
    process.env.E2E_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const municipalUid = process.env.E2E_UID_ADMIN_MUNICIPAL || "";
  const transpUid = process.env.E2E_UID_ADMIN_TRANSPARENCIA || "";
  const directorOpUid = process.env.E2E_UID_DIRECTOR_OPERACIONES || "";
  const directorSecUid =
    process.env.E2E_UID_DIRECTOR_SECRETARIA || process.env.E2E_UID_DIRECTOR_OPERACIONES || "";

  const missing = [];
  if (!municipalUid) missing.push("E2E_UID_ADMIN_MUNICIPAL");
  if (!transpUid) missing.push("E2E_UID_ADMIN_TRANSPARENCIA");
  if (!directorOpUid) missing.push("E2E_UID_DIRECTOR_OPERACIONES");
  if (!directorSecUid) missing.push("E2E_UID_DIRECTOR_SECRETARIA (o mismo que OPERACIONES)");
  if (missing.length) {
    console.error(`Faltan variables de entorno: ${missing.join(", ")}`);
    process.exit(1);
  }

  const { db, auth } = initAdmin();
  const createdIds = [];

  const cookieAdminMun = await openSession(baseUrl, auth, municipalUid);
  const cookieAdminTrans = await openSession(baseUrl, auth, transpUid);
  const cookieDirOp = await openSession(baseUrl, auth, directorOpUid);
  const cookieDirSec = await openSession(baseUrl, auth, directorSecUid);

  console.log(`\n▶ Base: ${baseUrl}\n`);

  // --- Flujo 1: Información (respuesta vía admin municipal) ---
  {
    const num = `E2E-INF-${Date.now()}`;
    const id = await seedRequerimiento(
      db,
      baseSeed({
        numeroSeguimiento: num,
        tipoRequerimiento: "Información",
        estado: "pendiente",
        direccionMunicipal: "",
        direccionMunicipalLabel: "",
      })
    );
    createdIds.push(id);
    console.log(`[INF] Creado ${id} (${num}) pendiente`);

    const derivar = await apiJson(baseUrl, cookieAdminMun, `/api/requerimientos/${id}/derivar`, {
      method: "POST",
      body: JSON.stringify({
        direccionMunicipal: "OPERACIONES",
        emailDestinatario: CORREO_OPERACIONES.toLowerCase(),
      }),
    });
    assertSuccess("INF derivar OPERACIONES", derivar);

    let rDeriv = await getRequerimiento(baseUrl, cookieDirOp, id);
    assertEstado(rDeriv, "derivado", "INF después de derivar");

    const toProc = await apiJson(baseUrl, cookieDirOp, `/api/requerimientos/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ estado: "en_proceso", nota: "E2E INF en proceso" }),
    });
    assertSuccess("INF → en_proceso", toProc);

    const adminsResp = await apiJson(
      baseUrl,
      cookieDirOp,
      `/api/usuarios/admins?tipo=${encodeURIComponent("Información")}`
    );
    assertSuccess("GET admins Municipal", adminsResp);
    const admins = adminsResp.json.data || [];
    if (!admins.length) throw new Error("No hay admins municipales para derivar respuesta final");
    const assignedUid = admins[0].uid;

    const derivFin = await apiJson(
      baseUrl,
      cookieDirOp,
      `/api/requerimientos/${id}/derivar-respuesta-final`,
      {
        method: "POST",
        body: JSON.stringify({ adminUid: assignedUid, nota: "E2E delegación final" }),
      }
    );
    assertSuccess("INF derivar-respuesta-final", derivFin);

    const assignedCookie =
      assignedUid === municipalUid
        ? cookieAdminMun
        : assignedUid === transpUid
          ? cookieAdminTrans
          : await openSession(baseUrl, auth, assignedUid);

    const r2 = await getRequerimiento(baseUrl, assignedCookie, id);
    assertEstado(r2, "derivado_respuesta_final", "INF derivado_respuesta_final");

    const mensajeVecino =
      "Estimado vecino,\nEste es el cierre automático E2E del flujo Información (>20 caracteres).";
    const resp = await apiJson(baseUrl, assignedCookie, `/api/requerimientos/${id}/respuesta`, {
      method: "POST",
      body: JSON.stringify({
        emailDestino: r2.vecino.email,
        asunto: "Respuesta automática E2E Información",
        mensaje: mensajeVecino,
        cierre: "completado",
      }),
    });
    assertSuccess("INF respuesta vecino", resp);

    const r3 = await getRequerimiento(baseUrl, assignedCookie, id);
    assertEstado(r3, "completado", "INF cerrado");
    if ((r3.respuestasVecino?.length || 0) < 1) throw new Error("INF: sin respuesta en registro");

    console.log("[INF] ✅ Flujo Información OK\n");
  }

  // --- Flujo 2: Solicitud Vecinal (completado → respuesta automática) ---
  {
    const num = `E2E-VEC-${Date.now()}`;
    const now = Timestamp.now();
    const id = await seedRequerimiento(
      db,
      baseSeed({
        numeroSeguimiento: num,
        tipoRequerimiento: "Solicitud Vecinal",
        estado: "en_proceso",
        direccionMunicipal: "OPERACIONES",
        direccionMunicipalLabel: LABEL_OPERACIONES,
        historialEstados: [
          { estado: "pendiente", fecha: now, nota: "E2E" },
          { estado: "derivado", fecha: now, nota: "Derivado OPERACIONES" },
          { estado: "en_proceso", fecha: now, nota: "E2E en proceso vecinal" },
        ],
      })
    );
    createdIds.push(id);
    console.log(`[VEC] Creado ${id} (${num}) en_proceso OPERACIONES`);

    const r0 = await getRequerimiento(baseUrl, cookieDirOp, id);
    assertEstado(r0, "en_proceso", "VEC inicio");

    const upd = await apiJson(baseUrl, cookieDirOp, `/api/requerimientos/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ estado: "completado", nota: "E2E cierre vecinal completado" }),
    });
    assertSuccess("VEC marcar completado", upd);

    const r1 = await getRequerimiento(baseUrl, cookieDirOp, id);
    assertEstado(r1, "completado", "VEC completado");

    const resp = await apiJson(baseUrl, cookieDirOp, `/api/requerimientos/${id}/respuesta-automatica`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    assertSuccess("VEC respuesta automática", resp);

    const r2 = await getRequerimiento(baseUrl, cookieDirOp, id);
    if ((r2.respuestasVecino?.length || 0) < 1) throw new Error("VEC: sin respuesta en registro");
    console.log("[VEC] ✅ Flujo Solicitud Vecinal OK\n");
  }

  // --- Flujo 3: Transparencia (Secretaría + admin transparencia) ---
  {
    const num = `E2E-TRN-${Date.now()}`;
    const id = await seedRequerimiento(
      db,
      baseSeed({
        numeroSeguimiento: num,
        tipoRequerimiento: "Solicitud de transparencia",
        estado: "pendiente",
        direccionMunicipal: "",
        direccionMunicipalLabel: "",
      })
    );
    createdIds.push(id);
    console.log(`[TRN] Creado ${id} (${num}) pendiente`);

    const derivar = await apiJson(baseUrl, cookieAdminTrans, `/api/requerimientos/${id}/derivar`, {
      method: "POST",
      body: JSON.stringify({
        direccionMunicipal: "SECRETARIA",
        emailDestinatario: CORREO_SECRETARIA.toLowerCase(),
      }),
    });
    assertSuccess("TRN derivar SECRETARIA", derivar);

    let ryDeriv = await getRequerimiento(baseUrl, cookieDirSec, id);
    assertEstado(ryDeriv, "derivado", "TRN post-derivación");

    const patch = await apiJson(baseUrl, cookieDirSec, `/api/requerimientos/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ estado: "en_proceso", nota: "E2E TRN en proceso" }),
    });
    assertSuccess("TRN → en_proceso", patch);

    const adminsTr = await apiJson(
      baseUrl,
      cookieDirSec,
      `/api/usuarios/admins?tipo=${encodeURIComponent("Solicitud de transparencia")}`
    );
    assertSuccess("GET admins Transparencia", adminsTr);
    const listAdm = adminsTr.json.data || [];
    if (!listAdm.length) throw new Error("No hay admins de transparencia");
    const adminTrUid = listAdm[0].uid;

    const df = await apiJson(
      baseUrl,
      cookieDirSec,
      `/api/requerimientos/${id}/derivar-respuesta-final`,
      {
        method: "POST",
        body: JSON.stringify({ adminUid: adminTrUid, nota: "E2E final transparencia" }),
      }
    );
    assertSuccess("TRN derivar-respuesta-final", df);

    const cookieResponder =
      adminTrUid === transpUid ? cookieAdminTrans : await openSession(baseUrl, auth, adminTrUid);

    const ry = await getRequerimiento(baseUrl, cookieResponder, id);
    assertEstado(ry, "derivado_respuesta_final", "TRN derivado_respuesta_final");

    const mensaje =
      "Estimado vecino,\nCierre automático E2E transparencia por admin (>20 caracteres obligatorio).";
    const respuesta = await apiJson(baseUrl, cookieResponder, `/api/requerimientos/${id}/respuesta`, {
      method: "POST",
      body: JSON.stringify({
        emailDestino: ry.vecino.email,
        asunto: "Respuesta automática E2E Transparencia",
        mensaje,
        cierre: "completado",
      }),
    });
    assertSuccess("TRN respuesta", respuesta);

    const rz = await getRequerimiento(baseUrl, cookieResponder, id);
    assertEstado(rz, "completado", "TRN cerrado");
    console.log("[TRN] ✅ Flujo Solicitud de transparencia OK\n");
  }

  console.log("══════════════════════════════════════════════════════");
  console.log("Todos los flujos E2E terminaron bien.");
  console.log(`Documentos E2E: ${createdIds.length} (${createdIds.join(", ")})`);
  console.log("══════════════════════════════════════════════════════");

  if (DO_CLEANUP) {
    console.log("\nLimpiando documentos …");
    for (const docId of createdIds) {
      await db.collection(COLLECTION_REQUERIMIENTOS).doc(docId).delete();
      console.log(`  borrado ${docId}`);
    }
    console.log("(Métricas del dashboard pueden quedar desalineadas un momento; ejecuta backfill si aplica)\n");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
