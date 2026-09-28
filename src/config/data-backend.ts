export type NexusDataMode =
  | "firestore"
  | "shadow-sql"
  | "sql-read"
  | "sql";

export interface NexusDataModeInfo {
  mode: NexusDataMode;
  primaryRead: "firestore" | "sql";
  primaryWrite: "firestore" | "sql";
  shadowWrite: "none" | "sql" | "firestore";
  description: string;
}

const MODES: Record<NexusDataMode, NexusDataModeInfo> = {
  firestore: {
    mode: "firestore",
    primaryRead: "firestore",
    primaryWrite: "firestore",
    shadowWrite: "none",
    description: "Producción actual. PostgreSQL no participa en datos de usuario.",
  },
  "shadow-sql": {
    mode: "shadow-sql",
    primaryRead: "firestore",
    primaryWrite: "firestore",
    shadowWrite: "sql",
    description:
      "Firestore sigue siendo autoridad; las escrituras se replican a PostgreSQL para validar la migración.",
  },
  "sql-read": {
    mode: "sql-read",
    primaryRead: "sql",
    primaryWrite: "firestore",
    shadowWrite: "sql",
    description:
      "Lecturas de prueba desde PostgreSQL con Firestore aún como respaldo de escritura.",
  },
  sql: {
    mode: "sql",
    primaryRead: "sql",
    primaryWrite: "sql",
    shadowWrite: "firestore",
    description:
      "PostgreSQL es la fuente principal; Firestore se conserva temporalmente como rollback.",
  },
};

export function parseNexusDataMode(
  value = process.env.NEXT_PUBLIC_NEXUS_DATA_MODE,
): NexusDataMode {
  return value === "shadow-sql" || value === "sql-read" || value === "sql"
    ? value
    : "firestore";
}

export function nexusDataModeInfo(
  value?: string,
): NexusDataModeInfo {
  return MODES[parseNexusDataMode(value)];
}

export function canUseSqlReads(value?: string) {
  const mode = parseNexusDataMode(value);
  return mode === "sql-read" || mode === "sql";
}

export function shouldShadowSqlWrites(value?: string) {
  const mode = parseNexusDataMode(value);
  return mode === "shadow-sql" || mode === "sql-read";
}
