import { adminAuth } from "@/lib/firebase/admin";
import { usuarioRepository } from "@/repositories/usuario.repository";
import { Usuario, UsuarioDTO, UsuarioCreateInput, RolUsuario, PaginatedUsuariosResponse } from "@/types/usuario.types";
import { UsuarioUpdateInput } from "@/lib/validations/usuario.schema";
import { getDireccionLabel } from "@/constants/direcciones";
import logger from "@/lib/logger";
import { Timestamp } from "firebase-admin/firestore";
import { invalidateCacheByPrefix } from "@/lib/server-cache";

type DateLike = Timestamp | Date | string | undefined;

function toUsuarioDTO(user: Usuario): UsuarioDTO {
  const formatTime = (time: DateLike) => {
    if (!time) return new Date().toISOString();
    if (typeof time === "string") return time;
    if (time instanceof Date) return time.toISOString();
    if (typeof time.toDate === "function") return time.toDate().toISOString();
    return new Date().toISOString();
  };

  const direcciones = user.direccionAsignadas && user.direccionAsignadas.length > 0
    ? user.direccionAsignadas
    : user.direccionAsignada
      ? [user.direccionAsignada]
      : [];

  return {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
    direccionAsignada: direcciones[0],
    direccionAsignadaLabel: direcciones[0] ? getDireccionLabel(direcciones[0]) : undefined,
    direccionAsignadas: direcciones,
    direccionAsignadasLabel: direcciones.map((d) => getDireccionLabel(d)),
    activo: user.activo,
    creadoEn: formatTime(user.creadoEn),
    actualizadoEn: formatTime(user.actualizadoEn),
  };
}

export class UsuarioConflictError extends Error {
  status = 409;
  details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "UsuarioConflictError";
    this.details = details;
  }
}

/**
 * Verifica que las direcciones asignadas a un director no tengan ya otro
 * director activo. Lanza UsuarioConflictError si hay conflicto.
 *
 * @param excludeUid Para edición: uid del usuario que se está actualizando.
 */
async function ensureSoloDirectorPorDireccion(
  rol: string,
  direcciones: string[],
  activo: boolean,
  excludeUid?: string
): Promise<void> {
  if (rol !== "director" || !activo || direcciones.length === 0) return;

  const existentes = await usuarioRepository.getDirectoresActivosByDirecciones(direcciones);
  const conflictos = existentes
    .filter((u) => u.id !== excludeUid)
    .flatMap((u) =>
      (u.direccionAsignadas ?? (u.direccionAsignada ? [u.direccionAsignada] : []))
        .filter((d) => direcciones.includes(d))
        .map((d) => ({ direccion: d, director: u.nombre, email: u.email }))
    );

  if (conflictos.length > 0) {
    const detalle = conflictos
      .map((c) => `${getDireccionLabel(c.direccion)} (ya asignada a ${c.director})`)
      .join(", ");
    throw new UsuarioConflictError(
      `Cada dirección puede tener un único director activo. Conflictos: ${detalle}`,
      conflictos
    );
  }
}

export const usuarioService = {
  /**
   * Create a new user — Firebase Auth + Firestore + Custom Claims
   */
  async create(input: UsuarioCreateInput): Promise<UsuarioDTO> {
    const direccionesInput = input.direccionAsignadas && input.direccionAsignadas.length > 0
      ? input.direccionAsignadas
      : input.direccionAsignada
        ? [input.direccionAsignada]
        : [];

    await ensureSoloDirectorPorDireccion(input.rol, direccionesInput, true);

    // 1. Create Firebase Auth user
    const authUser = await adminAuth.createUser({
      email: input.email,
      password: input.password,
      displayName: input.nombre,
    });

    // 2. Set Custom Claims
    const direcciones = input.direccionAsignadas && input.direccionAsignadas.length > 0
      ? input.direccionAsignadas
      : input.direccionAsignada
        ? [input.direccionAsignada]
        : [];
    const claims: Record<string, unknown> = { rol: input.rol };
    if (direcciones.length > 0) {
      claims.direccionAsignada = direcciones[0];
      claims.direccionAsignadas = direcciones;
    }
    await adminAuth.setCustomUserClaims(authUser.uid, claims);

    // 3. Create Firestore document
    await usuarioRepository.create(authUser.uid, {
      nombre: input.nombre,
      email: input.email,
      rol: input.rol,
      direccionAsignada: direcciones[0],
      direccionAsignadas: direcciones,
      activo: true,
    });

    logger.info({ uid: authUser.uid, email: input.email, rol: input.rol }, "User created");
    invalidateCacheByPrefix("usuarios:list:");

    const user = await usuarioRepository.getById(authUser.uid);
    return toUsuarioDTO(user!);
  },

  /**
   * Get user by ID
   */
  async getById(uid: string): Promise<UsuarioDTO | null> {
    const user = await usuarioRepository.getById(uid);
    if (!user) return null;
    return toUsuarioDTO(user);
  },

  /**
   * List all users
   */
  async list(): Promise<UsuarioDTO[]> {
    const users = await usuarioRepository.list();
    return users.map(toUsuarioDTO);
  },

  async listPaginated({
    page,
    limit,
    search,
  }: {
    page: number;
    limit: number;
    search?: string;
  }): Promise<PaginatedUsuariosResponse> {
    const normalizedSearch = search?.trim().toLowerCase() || "";

    if (normalizedSearch) {
      const users = (await usuarioRepository.list()).map(toUsuarioDTO);
      const filtered = users.filter((user) => {
        const text = [
          user.nombre,
          user.email,
          user.rol,
          user.direccionAsignadaLabel || "",
          ...(user.direccionAsignadasLabel || []),
        ]
          .join(" ")
          .toLowerCase();
        return text.includes(normalizedSearch);
      });

      const start = (page - 1) * limit;
      return {
        data: filtered.slice(start, start + limit),
        total: filtered.length,
      };
    }

    const result = await usuarioRepository.listPage(page, limit);
    return {
      data: result.data.map(toUsuarioDTO),
      total: result.total,
    };
  },

  /**
   * Get user by email (for derivation)
   */
  async getByEmail(email: string): Promise<UsuarioDTO | null> {
    const user = await usuarioRepository.getByEmail(email);
    if (!user) return null;
    return toUsuarioDTO(user);
  },

  /**
   * Get users assigned to a specific direction
   */
  async getByDireccion(direccion: string): Promise<UsuarioDTO[]> {
    const users = await usuarioRepository.getByDireccion(direccion);
    return users.map(toUsuarioDTO);
  },

  async update(uid: string, input: UsuarioUpdateInput): Promise<UsuarioDTO | null> {
    const existing = await usuarioRepository.getById(uid);
    if (!existing) return null;

    const direcciones = input.direccionAsignadas && input.direccionAsignadas.length > 0
      ? input.direccionAsignadas
      : input.direccionAsignada
        ? [input.direccionAsignada]
        : [];

    await ensureSoloDirectorPorDireccion(
      input.rol,
      direcciones,
      existing.activo !== false,
      uid
    );
    const claims: Record<string, unknown> = { rol: input.rol };
    if (direcciones.length > 0) {
      claims.direccionAsignada = direcciones[0];
      claims.direccionAsignadas = direcciones;
    }
    await adminAuth.setCustomUserClaims(uid, claims);

    const authUpdates: { displayName?: string; email?: string; password?: string } = {
      displayName: input.nombre,
      email: input.email,
      password: input.password,
    };
    await adminAuth.updateUser(uid, authUpdates);

    await usuarioRepository.update(uid, {
      nombre: input.nombre,
      email: input.email,
      rol: input.rol as RolUsuario,
      direccionAsignada: direcciones[0],
      direccionAsignadas: direcciones,
    });

    const updated = await usuarioRepository.getById(uid);
    logger.info({ uid, rol: input.rol }, "User updated");
    invalidateCacheByPrefix("usuarios:list:");
    return updated ? toUsuarioDTO(updated) : null;
  },

  async delete(uid: string): Promise<void> {
    await adminAuth.deleteUser(uid);
    await usuarioRepository.delete(uid);
    logger.info({ uid }, "User deleted permanently");
    invalidateCacheByPrefix("usuarios:list:");
  },
};
