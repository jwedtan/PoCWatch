import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import type { CpeType } from "@/lib/cve";
import {
  ASSET_CPE_TYPES,
  ASSET_ENVIRONMENTS,
  type Asset,
  type AssetDraft,
  type AssetEnvironment,
  normalizeToken,
  sanitizeImportedAsset,
} from "@/lib/assets";

const globalForSqlite = globalThis as unknown as {
  __pocwatchAssetDb?: Database.Database;
};

function dbFilePath(): string {
  const fromEnv = process.env.SQLITE_PATH?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.join(process.cwd(), fromEnv);
  }
  return path.join(process.cwd(), "data", "pocwatch.db");
}

export function getAssetDb(): Database.Database {
  if (globalForSqlite.__pocwatchAssetDb) {
    return globalForSqlite.__pocwatchAssetDb;
  }

  const file = dbFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      vendor TEXT NOT NULL,
      product TEXT NOT NULL,
      version TEXT NOT NULL DEFAULT '',
      cpe_type TEXT NOT NULL,
      environment TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets (created_at);
  `);

  globalForSqlite.__pocwatchAssetDb = db;
  return db;
}

function rowToAsset(row: {
  id: string;
  label: string;
  vendor: string;
  product: string;
  version: string;
  cpe_type: string;
  environment: string;
  notes: string;
  created_at: string;
}): Asset {
  const cpeType = ASSET_CPE_TYPES.includes(row.cpe_type as CpeType)
    ? (row.cpe_type as CpeType)
    : "application";
  const environment = ASSET_ENVIRONMENTS.includes(row.environment as AssetEnvironment)
    ? (row.environment as AssetEnvironment)
    : "prod";
  return {
    id: row.id,
    label: row.label,
    vendor: row.vendor,
    product: row.product,
    version: row.version,
    cpeType,
    environment,
    notes: row.notes || undefined,
    createdAt: row.created_at,
  };
}

export function listAssets(): Asset[] {
  const db = getAssetDb();
  const rows = db
    .prepare(
      `SELECT id, label, vendor, product, version, cpe_type, environment, notes, created_at
       FROM assets ORDER BY datetime(created_at) DESC`,
    )
    .all() as Array<{
      id: string;
      label: string;
      vendor: string;
      product: string;
      version: string;
      cpe_type: string;
      environment: string;
      notes: string;
      created_at: string;
    }>;
  return rows.map(rowToAsset);
}

export function createAsset(draft: AssetDraft): Asset {
  const db = getAssetDb();
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const label = draft.label.trim();
  const vendor = draft.vendor.trim();
  const product = draft.product.trim();
  const version = draft.version.trim();
  const notes = draft.notes?.trim() ?? "";

  db.prepare(
    `INSERT INTO assets (id, label, vendor, product, version, cpe_type, environment, notes, created_at)
     VALUES (@id, @label, @vendor, @product, @version, @cpe_type, @environment, @notes, @created_at)`,
  ).run({
    id,
    label,
    vendor,
    product,
    version,
    cpe_type: draft.cpeType,
    environment: draft.environment,
    notes,
    created_at: createdAt,
  });

  return {
    id,
    label,
    vendor,
    product,
    version,
    cpeType: draft.cpeType,
    environment: draft.environment,
    notes: notes || undefined,
    createdAt,
  };
}

export function updateAsset(id: string, draft: AssetDraft): Asset | null {
  const db = getAssetDb();
  const existing = db
    .prepare(`SELECT created_at FROM assets WHERE id = ?`)
    .get(id) as { created_at: string } | undefined;
  if (!existing) {
    return null;
  }

  const label = draft.label.trim();
  const vendor = draft.vendor.trim();
  const product = draft.product.trim();
  const version = draft.version.trim();
  const notes = draft.notes?.trim() ?? "";

  db.prepare(
    `UPDATE assets SET
       label = @label,
       vendor = @vendor,
       product = @product,
       version = @version,
       cpe_type = @cpe_type,
       environment = @environment,
       notes = @notes
     WHERE id = @id`,
  ).run({
    id,
    label,
    vendor,
    product,
    version,
    cpe_type: draft.cpeType,
    environment: draft.environment,
    notes,
  });

  return {
    id,
    label,
    vendor,
    product,
    version,
    cpeType: draft.cpeType,
    environment: draft.environment,
    notes: notes || undefined,
    createdAt: existing.created_at,
  };
}

export function deleteAsset(id: string): boolean {
  const db = getAssetDb();
  const result = db.prepare(`DELETE FROM assets WHERE id = ?`).run(id);
  return result.changes > 0;
}

export function replaceAllAssets(assets: Asset[]): void {
  const db = getAssetDb();
  const tx = db.transaction(() => {
    db.exec(`DELETE FROM assets`);
    const insert = db.prepare(
      `INSERT INTO assets (id, label, vendor, product, version, cpe_type, environment, notes, created_at)
       VALUES (@id, @label, @vendor, @product, @version, @cpe_type, @environment, @notes, @created_at)`,
    );
    for (const asset of assets) {
      insert.run({
        id: asset.id,
        label: asset.label,
        vendor: asset.vendor,
        product: asset.product,
        version: asset.version,
        cpe_type: asset.cpeType,
        environment: asset.environment,
        notes: asset.notes ?? "",
        created_at: asset.createdAt,
      });
    }
  });
  tx();
}

/** Cap JSON imports to limit abuse on exposed instances. */
export const MAX_ASSET_IMPORT_ENTRIES = 2_000;

export function importAssetsFromJson(
  payload: unknown,
  mode: "merge" | "replace",
): { added: number; skipped: number } {
  if (!Array.isArray(payload)) {
    throw new Error("Import file must contain a JSON array of assets.");
  }
  if (payload.length > MAX_ASSET_IMPORT_ENTRIES) {
    throw new Error(
      `Import exceeds the maximum of ${MAX_ASSET_IMPORT_ENTRIES} assets per file.`,
    );
  }

  const incoming = payload
    .map((entry) => sanitizeImportedAsset(entry))
    .filter((entry): entry is Asset => entry !== null);

  if (mode === "replace") {
    replaceAllAssets(incoming);
    return { added: incoming.length, skipped: payload.length - incoming.length };
  }

  const existing = listAssets();
  const fingerprint = (asset: Asset) =>
    `${normalizeToken(asset.vendor)}|${normalizeToken(asset.product)}|${normalizeToken(asset.version)}`;
  const seen = new Set(existing.map(fingerprint));
  let added = 0;
  const db = getAssetDb();
  const insert = db.prepare(
    `INSERT INTO assets (id, label, vendor, product, version, cpe_type, environment, notes, created_at)
     VALUES (@id, @label, @vendor, @product, @version, @cpe_type, @environment, @notes, @created_at)`,
  );

  const tx = db.transaction(() => {
    for (const asset of incoming) {
      const key = fingerprint(asset);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      insert.run({
        id: asset.id,
        label: asset.label,
        vendor: asset.vendor,
        product: asset.product,
        version: asset.version,
        cpe_type: asset.cpeType,
        environment: asset.environment,
        notes: asset.notes ?? "",
        created_at: asset.createdAt,
      });
      added += 1;
    }
  });
  tx();

  return { added, skipped: payload.length - added };
}
