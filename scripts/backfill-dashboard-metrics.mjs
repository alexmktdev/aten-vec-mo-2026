import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fs from "node:fs";
import path from "node:path";

let serviceAccount;
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (serviceAccountPath) {
  const resolved = path.resolve(process.cwd(), serviceAccountPath);
  serviceAccount = JSON.parse(fs.readFileSync(resolved, "utf8"));
} else if (
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
) {
  serviceAccount = {
    project_id: process.env.FIREBASE_PROJECT_ID,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  };
} else {
  console.error("Faltan credenciales Firebase. Define FIREBASE_SERVICE_ACCOUNT_PATH o PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY.");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();
const requerimientosRef = db.collection("requerimientos");
const metricsRef = db.collection("dashboard_metrics").doc("global");

function monthKey(dateLike) {
  const d = new Date(dateLike);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function keyFromLabel(label) {
  return Buffer.from(label || "sin_etiqueta").toString("base64url");
}

async function deleteSubcollection(subName) {
  const col = metricsRef.collection(subName);
  let deleted = 0;
  while (true) {
    const snap = await col.limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < 400) break;
  }
  if (deleted > 0) console.log(`  ${subName}: ${deleted} doc(s) eliminado(s)`);
}

async function main() {
  console.log("Iniciando backfill dashboard_metrics...");
  console.log("Limpiando métricas anteriores...");
  await deleteSubcollection("by_direction");
  await deleteSubcollection("by_category");
  await deleteSubcollection("by_month");

  const snap = await requerimientosRef.get();
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const estados = {
    pendiente: 0,
    derivado: 0,
    en_proceso: 0,
    en_espera_1: 0,
    en_espera_2: 0,
    derivado_respuesta_final: 0,
    completado: 0,
    rechazado: 0,
  };
  const dirs = new Map();
  const cats = new Map();
  const months = new Map();

  for (const row of docs) {
    const estado = row.estado || "pendiente";
    if (estado in estados) estados[estado] += 1;
    const dir = row.direccionMunicipalLabel || "Sin dirección";
    const cat = row.categoria || "Sin categoría";
    const month = monthKey(row.fechaIngreso?.toDate ? row.fechaIngreso.toDate() : row.fechaIngreso);

    if (!dirs.has(dir)) dirs.set(dir, { total: 0, resolved: 0 });
    dirs.get(dir).total += 1;
    if (estado === "completado") dirs.get(dir).resolved += 1;

    cats.set(cat, (cats.get(cat) || 0) + 1);
    months.set(month, (months.get(month) || 0) + 1);
  }

  const batch = db.batch();
  batch.set(metricsRef, {
    total: docs.length,
    estado: estados,
    updatedAt: FieldValue.serverTimestamp(),
  });

  for (const [label, data] of dirs.entries()) {
    batch.set(metricsRef.collection("by_direction").doc(keyFromLabel(label)), {
      label,
      total: data.total,
      resolved: data.resolved,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  for (const [label, total] of cats.entries()) {
    batch.set(metricsRef.collection("by_category").doc(keyFromLabel(label)), {
      label,
      total,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  for (const [month, total] of months.entries()) {
    batch.set(metricsRef.collection("by_month").doc(month), {
      month,
      total,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  if (docs.length === 0) {
    console.log("Sin requerimientos: métricas en cero.");
  }
  console.log(`Backfill completado. Documentos procesados: ${docs.length}`);
}

main().catch((e) => {
  console.error("Error en backfill:", e);
  process.exit(1);
});
