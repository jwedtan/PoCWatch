"use server";

import { revalidatePath } from "next/cache";

import {
  createAsset as dbCreateAsset,
  deleteAsset as dbDeleteAsset,
  importAssetsFromJson,
  listAssets,
  updateAsset as dbUpdateAsset,
} from "@/lib/asset-db";
import type { Asset, AssetDraft } from "@/lib/assets";

function revalidateAssetViews() {
  revalidatePath("/");
  revalidatePath("/assets");
}

export async function createAssetAction(
  draft: AssetDraft,
): Promise<{ ok: true; asset: Asset } | { ok: false; error: string }> {
  try {
    const asset = dbCreateAsset(draft);
    revalidateAssetViews();
    return { ok: true, asset };
  } catch (error) {
    console.error("createAssetAction:", error);
    return { ok: false, error: "Could not save asset." };
  }
}

export async function updateAssetAction(
  id: string,
  draft: AssetDraft,
): Promise<{ ok: true; asset: Asset } | { ok: false; error: string }> {
  try {
    const updated = dbUpdateAsset(id, draft);
    if (!updated) {
      return { ok: false, error: "Asset not found." };
    }
    revalidateAssetViews();
    return { ok: true, asset: updated };
  } catch (error) {
    console.error("updateAssetAction:", error);
    return { ok: false, error: "Could not update asset." };
  }
}

export async function deleteAssetAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const removed = dbDeleteAsset(id);
    if (!removed) {
      return { ok: false, error: "Asset not found." };
    }
    revalidateAssetViews();
    return { ok: true };
  } catch (error) {
    console.error("deleteAssetAction:", error);
    return { ok: false, error: "Could not delete asset." };
  }
}

export async function importAssetsAction(
  payload: unknown,
  mode: "merge" | "replace",
): Promise<
  | { ok: true; added: number; skipped: number; assets: Asset[] }
  | { ok: false; error: string }
> {
  try {
    const result = importAssetsFromJson(payload, mode);
    const assets = listAssets();
    revalidateAssetViews();
    return { ok: true, added: result.added, skipped: result.skipped, assets };
  } catch (error) {
    console.error("importAssetsAction:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Import failed.",
    };
  }
}
