type MeterEntry = {
  reads: number;
  ops: number;
};

type MeterState = {
  startedAt: number;
  totalReads: number;
  totalOps: number;
  byCallsite: Map<string, MeterEntry>;
  intervalId?: ReturnType<typeof setInterval>;
  patched?: boolean;
};

declare global {
  var __firestoreReadMeterState__: MeterState | undefined;
}

function getState(): MeterState {
  if (!globalThis.__firestoreReadMeterState__) {
    globalThis.__firestoreReadMeterState__ = {
      startedAt: Date.now(),
      totalReads: 0,
      totalOps: 0,
      byCallsite: new Map<string, MeterEntry>(),
    };
  }
  return globalThis.__firestoreReadMeterState__;
}

function toCallsiteLabel(): string {
  const stack = new Error().stack || "";
  const lines = stack.split("\n").map((l) => l.trim());
  const appLine = lines.find((l) => l.includes("/src/"));
  if (!appLine) return "unknown";
  return appLine.replace(/^at\s+/, "");
}

function registerRead(reads: number): void {
  const state = getState();
  const callsite = toCallsiteLabel();
  state.totalReads += Math.max(0, reads);
  state.totalOps += 1;
  const prev = state.byCallsite.get(callsite) || { reads: 0, ops: 0 };
  prev.reads += Math.max(0, reads);
  prev.ops += 1;
  state.byCallsite.set(callsite, prev);
}

function estimateReadsFromQuerySnapshotLike(snap: unknown): number {
  if (!snap || typeof snap !== "object") return 1;
  const anySnap = snap as { size?: number; data?: () => { count?: number } };

  // QuerySnapshot normal
  if (typeof anySnap.size === "number") {
    return Math.max(1, anySnap.size);
  }

  // AggregateQuerySnapshot (count)
  if (typeof anySnap.data === "function") {
    try {
      const data = anySnap.data();
      const count = Number(data?.count ?? 0);
      // Firestore aggregation billing: proportional to index entries scanned,
      // commonly approximated as 1 read per 1000, with minimum 1.
      return Math.max(1, Math.ceil(count / 1000));
    } catch {
      return 1;
    }
  }

  return 1;
}

function printTopSummary(): void {
  const state = getState();
  const secs = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
  const entries = Array.from(state.byCallsite.entries())
    .sort((a, b) => b[1].reads - a[1].reads)
    .slice(0, 12);

  console.log(
    `\n[FirestoreReadMeter] ${new Date().toISOString()} | totalReads=${state.totalReads} totalOps=${state.totalOps} uptime=${secs}s`
  );
  for (const [label, e] of entries) {
    console.log(`  - reads=${e.reads} ops=${e.ops} | ${label}`);
  }
}

/**
 * Activa un medidor de lecturas Firestore en runtime Node (dev local).
 * Se habilita con FIRESTORE_READ_METER=1.
 */
export function setupFirestoreReadMeterIfEnabled(db: FirebaseFirestore.Firestore): void {
  const enabled = process.env.FIRESTORE_READ_METER === "1";
  if (!enabled) return;

  const state = getState();
  if (state.patched) return;
  state.patched = true;

  const queryProto = Object.getPrototypeOf(db.collection("_meter_probe_"));
  const docProto = Object.getPrototypeOf(db.collection("_meter_probe_").doc("_doc"));

  const originalQueryGet = queryProto.get;
  queryProto.get = async function patchedQueryGet(this: FirebaseFirestore.Query) {
    const snap = await originalQueryGet.call(this);
    registerRead(estimateReadsFromQuerySnapshotLike(snap));
    return snap;
  };

  const originalDocGet = docProto.get;
  docProto.get = async function patchedDocGet(this: FirebaseFirestore.DocumentReference) {
    const snap = await originalDocGet.call(this);
    // Intentar leer un doc (exista o no) consume lectura facturable.
    registerRead(1);
    return snap;
  };

  if (!state.intervalId) {
    state.intervalId = setInterval(printTopSummary, 1_000);
  }

  console.log("[FirestoreReadMeter] enabled (FIRESTORE_READ_METER=1). Summary every 1s.");
}
