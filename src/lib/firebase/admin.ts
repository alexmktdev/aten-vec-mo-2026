import { initializeApp, getApps, cert, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { setupFirestoreReadMeterIfEnabled } from "@/lib/firebase/firestore-read-meter";

function getFirebaseAdminApp() {
  const existing = getApps();
  if (existing.length > 0) {
    return existing[0];
  }

  // Only validate env vars when actually initializing (not at build time)
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction) {
      throw new Error("Missing required Firebase Admin environment variables in production runtime");
    }
    console.warn("Missing Firebase Admin environment variables - using development demo config");
    return initializeApp({ projectId: "demo-project" });
  }

  try {
    const serviceAccount: ServiceAccount = {
      projectId,
      clientEmail,
      privateKey,
    };

    return initializeApp({
      credential: cert(serviceAccount),
    });
  } catch (error) {
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction) {
      throw new Error(`Failed to initialize Firebase Admin in production: ${String(error)}`);
    }
    console.warn("Failed to initialize Firebase Admin credentials - using development demo config");
    return initializeApp({ projectId: projectId || "demo-project" });
  }
}

export const adminApp = getFirebaseAdminApp();
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
setupFirestoreReadMeterIfEnabled(adminDb);
