import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/firestore-collections";
import { ROLES_ADMINS_PLATAFORMA, RolUsuario, Usuario } from "@/types/usuario.types";
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
   * Devuelve los directores activos que tienen alguna de las direcciones
   * indicadas asignadas (campo escalar o campo array). Útil para validar que
   * cada dirección tenga un único director activo.
   */
  async getDirectoresActivosByDirecciones(direcciones: string[]): Promise<Usuario[]> {
    const unique = Array.from(new Set(direcciones.filter(Boolean)));
    if (unique.length === 0) return [];

    const queries = unique.map((dir) =>
      collection()
        .where("rol", "==", "director")
        .where("activo", "==", true)
        .where("direccionAsignadas", "array-contains", dir)
        .get()
    );

    const snapshots = await Promise.all(queries);
    const map = new Map<string, Usuario>();
    snapshots.forEach((snap) => {
      snap.docs.forEach((doc) => {
        if (!map.has(doc.id)) {
          map.set(doc.id, { id: doc.id, ...doc.data() } as Usuario);
        }
      });
    });
    return Array.from(map.values());
  },

  /**
   * Get platform admin users (for new requerimiento notifications).
   * Incluye admin (legacy), admin-municipal y admin-transparencia.
   */
  async getAdmins(): Promise<Usuario[]> {
    const snapshot = await collection()
      .where("rol", "in", ROLES_ADMINS_PLATAFORMA as readonly string[])
      .where("activo", "==", true)
      .get();

    return snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as Usuario
    );
  },

  /**
   * Devuelve los admins activos cuyo rol está incluido en `roles`. Usado por
   * el modal «Derivar para respuesta final» para mostrar solo los admins del
   * tipo correspondiente al requerimiento.
   */
  async getAdminsByRoles(roles: RolUsuario[]): Promise<Usuario[]> {
    const unique = Array.from(new Set(roles));
    if (unique.length === 0) return [];

    const snapshot = await collection()
      .where("rol", "in", unique as readonly string[])
      .where("activo", "==", true)
      .get();

    return snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as Usuario
    );
  },
};
