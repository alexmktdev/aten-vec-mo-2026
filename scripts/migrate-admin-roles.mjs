/**
 * Migración de roles de admin a los nuevos admin-municipal / admin-transparencia.
 *
 * Cambia el rol de los usuarios indicados tanto en Firestore (colección
 * `usuarios`) como en los Custom Claims de Firebase Auth. Si encuentra otros
 * usuarios con rol "admin" sin asignar, los lista para que el usuario decida
 * manualmente — no toca a nadie que no esté declarado en MIGRATIONS.
 *
 * Uso:
 *   FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccount.json node scripts/migrate-admin-roles.mjs
 *   # o exporta FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.
 *   # Agrega --dry para ver qué haría sin escribir nada.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS = [
  { email: "alruizpoblete94@gmail.com", nuevoRol: "admin-municipal" },
  { email: "alruiz13zananiri@gmail.com", nuevoRol: "admin-transparencia" },
];

const DRY_RUN = process.argv.includes("--dry");

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
    "Faltan credenciales Firebase. Define FIREBASE_SERVICE_ACCOUNT_PATH o PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY."
  );
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();
const auth = getAuth();
const usuariosRef = db.collection("usuarios");

async function migrarUsuarioPorEmail(email, nuevoRol) {
  const snap = await usuariosRef.where("email", "==", email).limit(1).get();
  if (snap.empty) {
    console.warn(`[skip] No se encontró usuario con email ${email}`);
    return;
  }
  const doc = snap.docs[0];
  const data = doc.data();
  const rolActual = data?.rol;
  if (rolActual === nuevoRol) {
    console.log(`[ok]   ${email} ya tiene rol ${nuevoRol}, no se modifica`);
    return;
  }

  console.log(`[plan] ${email}: ${rolActual} → ${nuevoRol} (uid=${doc.id})`);
  if (DRY_RUN) return;

  await usuariosRef.doc(doc.id).update({
    rol: nuevoRol,
    actualizadoEn: new Date(),
  });

  try {
    const userRecord = await auth.getUser(doc.id);
    const currentClaims = userRecord.customClaims || {};
    await auth.setCustomUserClaims(doc.id, { ...currentClaims, rol: nuevoRol });
  } catch (err) {
    console.error(
      `[warn] No se pudieron actualizar los Custom Claims de ${email}: ${err?.message || err}`
    );
  }
  console.log(`[done] ${email} actualizado a ${nuevoRol}`);
}

async function listarAdminsResiduales() {
  const snap = await usuariosRef.where("rol", "==", "admin").get();
  if (snap.empty) {
    console.log("\nNo quedan usuarios con rol legacy 'admin'.");
    return;
  }
  console.log("\nUsuarios que aún están con rol legacy 'admin' (revisar manualmente):");
  snap.docs.forEach((doc) => {
    const data = doc.data();
    console.log(`  - ${data?.email || "(sin email)"} (uid=${doc.id}, activo=${data?.activo})`);
  });
}

async function main() {
  console.log(DRY_RUN ? "Modo --dry: no se realizarán escrituras." : "Aplicando migración...");
  for (const { email, nuevoRol } of MIGRATIONS) {
    await migrarUsuarioPorEmail(email, nuevoRol);
  }
  await listarAdminsResiduales();
  console.log("\nListo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
