import type { Asset } from "@/lib/assets";
import { normalizeToken } from "@/lib/assets";
import type { AffectedProduct, CveRecord, SeverityLevel } from "@/lib/cve";

export type MatchConfidence = "exact" | "likely" | "possible";

export type AssetMatch = {
  asset: Asset;
  product: AffectedProduct;
  confidence: MatchConfidence;
  reason: string;
};

type ParsedRange = {
  startIncluding?: string;
  startExcluding?: string;
  endIncluding?: string;
  endExcluding?: string;
  exactVersion?: string;
  allVersions: boolean;
};

// Compares two dotted version strings numerically when possible, falling back
// to a case-insensitive string compare for non-numeric segments.
function compareVersions(a: string, b: string): number {
  const aParts = a.split(/[.\-+]/);
  const bParts = b.split(/[.\-+]/);
  const length = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < length; i += 1) {
    const left = aParts[i] ?? "0";
    const right = bParts[i] ?? "0";
    const leftNum = Number.parseInt(left, 10);
    const rightNum = Number.parseInt(right, 10);
    const leftIsNum = !Number.isNaN(leftNum) && /^\d+/.test(left);
    const rightIsNum = !Number.isNaN(rightNum) && /^\d+/.test(right);
    if (leftIsNum && rightIsNum) {
      if (leftNum !== rightNum) {
        return leftNum < rightNum ? -1 : 1;
      }
      continue;
    }
    if (left === right) {
      continue;
    }
    return left < right ? -1 : 1;
  }
  return 0;
}

// Parse a `versionRange` string emitted by `lib/cve.ts` back into structured
// bounds. The format is one of:
//   - "all versions"
//   - "<exact-version>"
//   - ">= X" / "<= Y" / "> X" / "< Y" (comma- or semicolon-separated)
//   - cve.org variant uses "; " between OR groups; we take the loosest bound
function parseVersionRange(range: string): ParsedRange {
  const trimmed = range.trim();
  if (!trimmed || trimmed === "all versions") {
    return { allVersions: true };
  }

  if (!/[<>=]/.test(trimmed)) {
    return { allVersions: false, exactVersion: trimmed };
  }

  const parsed: ParsedRange = { allVersions: false };
  const segments = trimmed.split(/[,;]/);
  for (const rawSegment of segments) {
    const segment = rawSegment.trim();
    if (!segment) {
      continue;
    }
    const greaterEqual = segment.match(/^>=\s*(.+)$/);
    if (greaterEqual) {
      parsed.startIncluding = greaterEqual[1].trim();
      continue;
    }
    const greater = segment.match(/^>\s*(.+)$/);
    if (greater) {
      parsed.startExcluding = greater[1].trim();
      continue;
    }
    const lessEqual = segment.match(/^<=\s*(.+)$/);
    if (lessEqual) {
      parsed.endIncluding = lessEqual[1].trim();
      continue;
    }
    const less = segment.match(/^<\s*(.+)$/);
    if (less) {
      parsed.endExcluding = less[1].trim();
      continue;
    }
  }
  return parsed;
}

function versionInRange(version: string, range: ParsedRange): boolean {
  if (range.allVersions) {
    return true;
  }
  if (range.exactVersion) {
    return compareVersions(version, range.exactVersion) === 0;
  }
  if (range.startIncluding && compareVersions(version, range.startIncluding) < 0) {
    return false;
  }
  if (range.startExcluding && compareVersions(version, range.startExcluding) <= 0) {
    return false;
  }
  if (range.endIncluding && compareVersions(version, range.endIncluding) > 0) {
    return false;
  }
  if (range.endExcluding && compareVersions(version, range.endExcluding) >= 0) {
    return false;
  }
  return true;
}

function describeRange(range: ParsedRange): string {
  if (range.allVersions) {
    return "all versions";
  }
  if (range.exactVersion) {
    return range.exactVersion;
  }
  const parts: string[] = [];
  if (range.startIncluding) parts.push(`>= ${range.startIncluding}`);
  if (range.startExcluding) parts.push(`> ${range.startExcluding}`);
  if (range.endIncluding) parts.push(`<= ${range.endIncluding}`);
  if (range.endExcluding) parts.push(`< ${range.endExcluding}`);
  return parts.join(", ");
}

function tokensMatch(assetToken: string, cveToken: string): boolean {
  if (!assetToken || !cveToken) {
    return false;
  }
  if (assetToken === cveToken) {
    return true;
  }
  if (assetToken.includes(cveToken) || cveToken.includes(assetToken)) {
    return true;
  }
  const assetParts = new Set(assetToken.split(" ").filter(Boolean));
  const cveParts = new Set(cveToken.split(" ").filter(Boolean));
  if (assetParts.size === 0 || cveParts.size === 0) {
    return false;
  }
  for (const part of assetParts) {
    if (part.length >= 3 && cveParts.has(part)) {
      return true;
    }
  }
  return false;
}

function matchAssetToProduct(
  asset: Asset,
  product: AffectedProduct,
): AssetMatch | null {
  const assetVendor = normalizeToken(asset.vendor);
  const assetProduct = normalizeToken(asset.product);
  const cveVendor = normalizeToken(product.vendor);
  const cveProduct = normalizeToken(product.product);

  const vendorHit = tokensMatch(assetVendor, cveVendor);
  const productHit = tokensMatch(assetProduct, cveProduct);

  if (!vendorHit && !productHit) {
    return null;
  }

  const vendorExact = vendorHit && assetVendor === cveVendor;
  const productExact = productHit && assetProduct === cveProduct;

  const range = parseVersionRange(product.versionRange);
  const assetVersion = asset.version.trim();
  let versionMatches = true;
  let versionReason = "version unspecified";

  if (assetVersion) {
    versionMatches = versionInRange(assetVersion, range);
    if (range.allVersions) {
      versionReason = "all versions affected";
    } else if (range.exactVersion) {
      versionReason =
        compareVersions(assetVersion, range.exactVersion) === 0
          ? `version ${assetVersion} matches`
          : `version ${assetVersion} differs from ${range.exactVersion}`;
    } else {
      const rangeDesc = describeRange(range) || product.versionRange;
      versionReason = versionMatches
        ? `version ${assetVersion} falls in ${rangeDesc}`
        : `version ${assetVersion} outside ${rangeDesc}`;
    }
  } else if (range.allVersions) {
    versionReason = "all versions affected";
  } else {
    versionReason = `range ${describeRange(range) || product.versionRange}`;
  }

  if (!versionMatches) {
    return null;
  }

  let confidence: MatchConfidence;
  if (vendorExact && productExact) {
    confidence = assetVersion && !range.allVersions ? "exact" : "likely";
  } else if (productHit && vendorHit) {
    confidence = "likely";
  } else {
    confidence = "possible";
  }

  const parts: string[] = [];
  if (vendorExact && productExact) {
    parts.push(`vendor & product match`);
  } else {
    parts.push(
      `${vendorHit ? "vendor" : ""}${vendorHit && productHit ? " & " : ""}${productHit ? "product" : ""} match`,
    );
  }
  parts.push(versionReason);

  return {
    asset,
    product,
    confidence,
    reason: parts.filter(Boolean).join(" • "),
  };
}

export function matchCveToAssets(cve: CveRecord, assets: Asset[]): AssetMatch[] {
  if (assets.length === 0 || cve.affected.length === 0) {
    return [];
  }

  // Deduplicate matches per (asset, vendor, product) — keeping the highest
  // confidence variant — so an asset doesn't show up multiple times when NVD
  // records many version ranges for the same product.
  const best = new Map<string, AssetMatch>();
  for (const asset of assets) {
    for (const product of cve.affected) {
      const match = matchAssetToProduct(asset, product);
      if (!match) {
        continue;
      }
      const key = `${asset.id}|${normalizeToken(product.vendor)}|${normalizeToken(product.product)}`;
      const existing = best.get(key);
      if (!existing || rankConfidence(match.confidence) > rankConfidence(existing.confidence)) {
        best.set(key, match);
      }
    }
  }
  return Array.from(best.values()).sort(
    (a, b) => rankConfidence(b.confidence) - rankConfidence(a.confidence),
  );
}

export function rankConfidence(confidence: MatchConfidence): number {
  switch (confidence) {
    case "exact":
      return 3;
    case "likely":
      return 2;
    case "possible":
      return 1;
  }
}

function severityWeight(severity: SeverityLevel): number {
  switch (severity) {
    case "Critical":
      return 40;
    case "High":
      return 25;
    case "Medium":
      return 10;
    case "Low":
      return 5;
    default:
      return 0;
  }
}

// Combined "should I look at this CVE first?" heuristic. Asset match is the
// dominant factor (up to 100) so any matched CVE outranks any unmatched one,
// then severity / EPSS / exploit availability break ties.
export function relevanceScore(cve: CveRecord, matches: AssetMatch[]): number {
  let score = 0;
  if (matches.length > 0) {
    const top = matches[0];
    if (top.confidence === "exact") score += 100;
    else if (top.confidence === "likely") score += 70;
    else score += 40;
    score += Math.min(matches.length - 1, 4) * 5;
  }
  score += severityWeight(cve.severity);
  if (cve.epss) {
    score += cve.epss.score * 30;
  }
  if (cve.pocs.length > 0) {
    score += 15;
  }
  if (cve.hasOfficialExploitLink) {
    score += 15;
  }
  return score;
}
