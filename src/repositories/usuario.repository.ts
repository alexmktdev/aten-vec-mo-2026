import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/firestore-collections";
import { Usuario } from "@/types/usuario.types";
import { FieldValue } from "firebase-admin/firestore";

const collection = () => adminDb.collection(COLLECTIONS.USUARIOS);

async function executePageQuery(
  query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData>,
  page: number,
  limit: number
): Promise<FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>> {
  const skip = (page - 1) * limit;
  return query.offset(skip).limit(limit).get();
}

export const usuarioRepository = {
  /**
   * Create a new usuario document in Firestore
   */
  async create(uid: string, data: Omit<Usuario, "id" | "creadoEn" | "actualizadoEn">): Promise<void> {
    await collection().doc(uid).set({
      ...data,
      activo: true,
      creadoEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp(),
    });
  },

  /**
   * Get a usuario by ID (Firebase UID)
   */
  async getById(uid: string): Promise<Usuario | null> {
    const doc = await collection().doc(uid).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Usuario;
  },

  /**
   * Get a usuario by email
   */
  async getByEmail(email: string): Promise<Usuario | null> {
    const snapshot = await collection()
      .where("email", "==", email)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Usuario;
  },

  /**
   * List all usuarios
   */
  async list(): Promise<Usuario[]> {
    const snapshot = await collection()
      .select("nombre", "email", "rol", "direccionAsignada", "direccionAsignadas", "activo", "creadoEn", "actualizadoEn")
      .orderBy("creadoEn", "desc")
      .get();
    return snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as Usuario
    );
  },

  async listPage(page: number, limit: number): Promise<{ data: Usuario[]; total: number }> {
    const baseQuery = collection()
      .select("nombre", "email", "rol", "direccionAsignada", "direccionAsignadas", "activo", "creadoEn", "actualizadoEn")
      .orderBy("creadoEn", "desc");

    const [countSnapshot, pageSnapshot] = await Promise.all([
      baseQuery.count().get(),
      executePageQuery(baseQuery, page, limit),
    ]);

    return {
      data: pageSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Usuario),
      total: Number(countSnapshot.data().count || 0),
    };
  },

  /**
   * Update a usuario
   */
  async update(uid: string, data: Partial<Usuario>): Promise<void> {
    await collection().doc(uid).update({
      ...data,
      actualizadoEn: FieldValue.serverTimestamp(),
    });
  },

  /**
   * Delete a usuario document permanently
   */
  async delete(uid: string): Promise<void> {
    await collection().doc(uid).delete();
  },

  /**
   * Get usuarios by assigned direction
   */
  async getByDireccion(direccion: string): Promise<Usuario[]> {
    const snapshot = await collection()
      .where("direccionAsignada", "==", direccion)
      .where("activo", "==", true)
      .get();

    return snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as Usuario
    );
  },

  /**
   * Get platform admin users (for new requerimiento notifications)
   * Only role "admin" should receive this email.
   */
  async getAdmins(): Promise<Usuario[]> {
    const snapshot = await collection()
      .where("rol", "==", "admin")
      .where("activo", "==", true)
      .get();

    return snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as Usuario
    );
  },
};
