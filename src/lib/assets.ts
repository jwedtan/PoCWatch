import type { CpeType } from "@/lib/cve";

export type AssetEnvironment = "prod" | "staging" | "dev" | "other";

export type Asset = {
  id: string;
  label: string;
  vendor: string;
  product: string;
  version: string;
  cpeType: CpeType;
  environment: AssetEnvironment;
  notes?: string;
  createdAt: string;
};

export type AssetDraft = Omit<Asset, "id" | "createdAt">;

export const ASSET_ENVIRONMENTS: AssetEnvironment[] = [
  "prod",
  "staging",
  "dev",
  "other",
];

export const ASSET_CPE_TYPES: CpeType[] = [
  "application",
  "os",
  "hardware",
  "unknown",
];

function newAssetId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `asset_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// Normalize a token for matching: lowercase, trim, collapse separators, drop
// punctuation. Used on both asset vendor/product and the CVE's affected
// vendor/product so "Apache HTTP Server" and "apache_http_server" align.
export function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_\-./\\]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function emptyAssetDraft(): AssetDraft {
  return {
    label: "",
    vendor: "",
    product: "",
    version: "",
    cpeType: "application",
    environment: "prod",
    notes: "",
  };
}

export function validateDraft(draft: AssetDraft): string | null {
  if (!draft.vendor.trim()) {
    return "Vendor is required.";
  }
  if (!draft.product.trim()) {
    return "Product is required.";
  }
  return null;
}

/** Parse a single JSON object into an Asset (used by SQLite import). */
export function sanitizeImportedAsset(input: unknown): Asset | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const record = input as Record<string, unknown>;
  const vendor = typeof record.vendor === "string" ? record.vendor.trim() : "";
  const product = typeof record.product === "string" ? record.product.trim() : "";
  if (!vendor || !product) {
    return null;
  }
  const cpeType = ASSET_CPE_TYPES.includes(record.cpeType as CpeType)
    ? (record.cpeType as CpeType)
    : "application";
  const environment = ASSET_ENVIRONMENTS.includes(
    record.environment as AssetEnvironment,
  )
    ? (record.environment as AssetEnvironment)
    : "prod";
  return {
    id: typeof record.id === "string" && record.id ? record.id : newAssetId(),
    label: typeof record.label === "string" ? record.label.trim() : "",
    vendor,
    product,
    version: typeof record.version === "string" ? record.version.trim() : "",
    cpeType,
    environment,
    notes: typeof record.notes === "string" ? record.notes : "",
    createdAt:
      typeof record.createdAt === "string" && record.createdAt
        ? record.createdAt
        : new Date().toISOString(),
  };
}

export function exportAssetsBlob(assets: Asset[]): Blob {
  return new Blob([JSON.stringify(assets, null, 2)], {
    type: "application/json",
  });
}
