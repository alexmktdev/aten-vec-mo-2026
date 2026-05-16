/**
 * Generador de números de seguimiento con formato REQ-{AÑO}-{SECUENCIAL_6_DIGITOS}
 * Usa un documento contador en Firestore con transacción atómica.
 */

import { getFirestore, FieldValue } from "firebase-admin/firestore";

const COUNTER_COLLECTION = "contadores";
const COUNTER_DOC = "requerimientos";

/**
 * Genera un nuevo número de seguimiento atómico.
 * Formato: REQ-2024-000123
 */
export async function generateNumeroSeguimiento(): Promise<string> {
  const db = getFirestore();
  const counterRef = db.collection(COUNTER_COLLECTION).doc(COUNTER_DOC);

  const result = await db.runTransaction(async (transaction) => {
    const counterDoc = await transaction.get(counterRef);

    let currentCounter = 0;
    if (counterDoc.exists) {
      currentCounter = counterDoc.data()?.current || 0;
    }

    const nextCounter = currentCounter + 1;

    transaction.set(
      counterRef,
      {
        current: nextCounter,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return nextCounter;
  });

  const year = new Date().getFullYear();
  const paddedNumber = result.toString().padStart(6, "0");

  return `REQ-${year}-${paddedNumber}`;
}
