/**
 * Limpia datos operativos de Firestore (y opcionalmente archivos en R2) dejando solo usuarios.
 *
 * Elimina:
 *   - requerimientos (todos)
 *   - password_reset_tokens
 *   - dashboard_metrics (global + subcolecciones)
 *   - contadores/requerimientos → reinicia en 0
 *
 * NO elimina:
 *   - usuarios (Firestore)
 *   - usuarios en Firebase Auth
 *
 * Uso:
 *   node --env-file=.env.local scripts/reset-operational-data.mjs --dry
 *   node --env-file=.env.local scripts/reset-operational-data.mjs --confirm
 *   node --env-file=.env.local scripts/reset-operational-data.mjs --confirm --skip-r2
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import fs from "node:fs";
import path from "node:path";

const DRY_RUN = process.argv.includes("--dry");
const CONFIRM = process.argv.includes("--confirm");
const SKIP_R2 = process.argv.includes("--skip-r2");

const BATCH_SIZE = 400;

function loadFirebase() {
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
    console.error(
      "Faltan credenciales Firebase (FIREBASE_SERVICE_ACCOUNT_PATH o PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY)."
    );
    process.exit(1);
  }

  if (!getApps().length) {
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

async function deleteQueryBatch(db, query, label) {
  let total = 0;
  while (true) {
    const snapshot = await query.get();
    if (snapshot.empty) break;
    total += snapshot.size;

    if (!DRY_RUN) {
      const batch = db.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    if (snapshot.size < BATCH_SIZE) break;
  }
  console.log(`  ${label}: ${total} documento(s)${DRY_RUN ? " (simulado)" : " eliminado(s)"}`);
  return total;
}

async function deleteCollection(db, collectionId, label = collectionId) {
  const collRef = db.collection(collectionId);
  return deleteQueryBatch(db, collRef.limit(BATCH_SIZE), label);
}

async function deleteSubcollection(db, parentPath, subName) {
  const ref = db.collection(parentPath).doc("global").collection(subName);
  const label = `${parentPath}/global/${subName}`;
  return deleteQueryBatch(db, ref.limit(BATCH_SIZE), label);
}

async function resetCounter(db) {
  const ref = db.collection("contadores").doc("requerimientos");
  if (DRY_RUN) {
    const snap = await ref.get();
    const current = snap.exists ? snap.data()?.current ?? 0 : 0;
    console.log(`  contadores/requerimientos: reiniciar ${current} → 0 (simulado)`);
    return;
  }
  await ref.set({ current: 0, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  console.log("  contadores/requerimientos: reiniciado a 0");
}

async function deleteDashboardMetrics(db) {
  await deleteSubcollection(db, "dashboard_metrics", "by_direction");
  await deleteSubcollection(db, "dashboard_metrics", "by_category");
  await deleteSubcollection(db, "dashboard_metrics", "by_month");
  const globalRef = db.collection("dashboard_metrics").doc("global");
  if (DRY_RUN) {
    const snap = await globalRef.get();
    console.log(`  dashboard_metrics/global: ${snap.exists ? 1 : 0} documento(s) (simulado)`);
    return;
  }
  if ((await globalRef.get()).exists) {
    await globalRef.delete();
    console.log("  dashboard_metrics/global: eliminado");
  }
}

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }
  return {
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
    bucket,
  };
}

async function deleteR2Prefix(client, bucket, prefix) {
  let continuationToken;
  let deleted = 0;
  do {
    const list = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    const keys = (list.Contents || []).map((o) => o.Key).filter(Boolean);
    if (keys.length > 0 && !DRY_RUN) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        })
      );
    }
    deleted += keys.length;
    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);

  console.log(`  R2 ${prefix}*: ${deleted} objeto(s)${DRY_RUN ? " (simulado)" : " eliminado(s)"}`);
}

async function countUsuarios(db) {
  const snap = await db.collection("usuarios").get();
  console.log(`  usuarios (se conservan): ${snap.size}`);
  return snap.size;
}

async function main() {
  if (!DRY_RUN && !CONFIRM) {
    console.error("Debe usar --dry (simular) o --confirm (ejecutar borrado real).");
    process.exit(1);
  }

  const db = loadFirebase();

  console.log(DRY_RUN ? "\n=== SIMULACIÓN (sin borrar) ===\n" : "\n=== LIMPIEZA OPERATIVA ===\n");

  await countUsuarios(db);
  console.log("\nFirestore:");
  await deleteCollection(db, "requerimientos");
  await deleteCollection(db, "password_reset_tokens");
  await deleteDashboardMetrics(db);
  await resetCounter(db);

  if (!SKIP_R2) {
    const r2 = getR2Client();
    if (!r2) {
      console.log("\nR2: omitido (faltan variables R2 en .env.local)");
    } else {
      console.log("\nR2:");
      await deleteR2Prefix(r2.client, r2.bucket, "requerimientos/");
      await deleteR2Prefix(r2.client, r2.bucket, "fichas/");
    }
  } else {
    console.log("\nR2: omitido (--skip-r2)");
  }

  console.log(
    DRY_RUN
      ? "\nListo (simulación). Ejecute con --confirm para aplicar.\n"
      : "\nListo. Usuarios intactos. Puede ejecutar backfill:dashboard-metrics cuando haya requerimientos nuevos.\n"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
