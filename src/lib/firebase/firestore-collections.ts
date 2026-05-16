/**
 * Firestore collection names as constants.
 * Centralized to avoid typos and enable easy refactoring.
 */

export const COLLECTIONS = {
  REQUERIMIENTOS: "requerimientos",
  USUARIOS: "usuarios",
  CONTADORES: "contadores",
  DASHBOARD_METRICS: "dashboard_metrics",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
