export type SeverityLevel = "Critical" | "High" | "Medium" | "Low" | "Unknown";

export type CpeType = "application" | "os" | "hardware" | "unknown";

export type AffectedProduct = {
  vendor: string;
  product: string;
  versionRange: string;
  cpeType: CpeType;
  cpe: string;
};

export type CveReference = {
  url: string;
  source: string;
  tags: string[];
};

export type CvssDetails = {
  version: string;
  vectorString?: string;
  baseScore: number | null;
  baseSeverity?: string;
  attackVector?: string;
  attackComplexity?: string;
  privilegesRequired?: string;
  userInteraction?: string;
  scope?: string;
  confidentialityImpact?: string;
  integrityImpact?: string;
  availabilityImpact?: string;
  exploitabilityScore?: number;
  impactScore?: number;
};

export type PocReference = {
  name: string;
  url: string;
  description: string | null;
  stars: number;
  forks: number;
  updatedAt: string;
  language: string | null;
  archived: boolean;
};

export type EpssInfo = {
  score: number;
  percentile: number;
};

export type CveRecord = {
  id: string;
  title: string;
  publishedAt: string;
  lastModifiedAt: string;
  source: string;
  status: string;
  cvssScore: number | null;
  severity: SeverityLevel;
  cvss: CvssDetails | null;
  cwe: string[];
  affected: AffectedProduct[];
  references: CveReference[];
  hasOfficialExploitLink: boolean;
  hasVendorPatch: boolean;
  epss: EpssInfo | null;
  pocs: PocReference[];
};

type NvdCvssData = {
  version?: string;
  vectorString?: string;
  baseScore?: number;
  baseSeverity?: string;
  attackVector?: string;
  attackComplexity?: string;
  privilegesRequired?: string;
  userInteraction?: string;
  scope?: string;
  confidentialityImpact?: string;
  integrityImpact?: string;
  availabilityImpact?: string;
};

type NvdMetric = {
  cvssData?: NvdCvssData;
  exploitabilityScore?: number;
  impactScore?: number;
};

type NvdCpeMatch = {
  vulnerable?: boolean;
  criteria?: string;
  versionStartIncluding?: string;
  versionStartExcluding?: string;
  versionEndIncluding?: string;
  versionEndExcluding?: string;
};

type NvdNode = {
  operator?: string;
  negate?: boolean;
  cpeMatch?: NvdCpeMatch[];
};

type NvdConfiguration = {
  nodes?: NvdNode[];
};

type NvdWeakness = {
  source?: string;
  type?: string;
  description?: Array<{ lang?: string; value?: string }>;
};

type NvdReference = {
  url?: string;
  source?: string;
  tags?: string[];
};

type NvdCve = {
  id?: string;
  sourceIdentifier?: string;
  published?: string;
  lastModified?: string;
  vulnStatus?: string;
  descriptions?: Array<{ lang?: string; value?: string }>;
  metrics?: {
    cvssMetricV31?: NvdMetric[];
    cvssMetricV30?: NvdMetric[];
    cvssMetricV2?: NvdMetric[];
  };
  weaknesses?: NvdWeakness[];
  configurations?: NvdConfiguration[];
  references?: NvdReference[];
};

type NvdApiResponse = {
  vulnerabilities?: Array<{
    cve?: NvdCve;
  }>;
};

type GitHubRepo = {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  language: string | null;
  archived: boolean;
};

type GitHubSearchResponse = {
  items?: GitHubRepo[];
};

type EpssDataPoint = {
  cve: string;
  epss: string;
  percentile: string;
};

type EpssResponse = {
  data?: EpssDataPoint[];
};

type CveOrgVersion = {
  version?: string;
  status?: string;
  lessThan?: string;
  lessThanOrEqual?: string;
  versionType?: string;
};

type CveOrgAffected = {
  vendor?: string;
  product?: string;
  packageName?: string;
  defaultStatus?: string;
  versions?: CveOrgVersion[];
  cpes?: string[];
};

type CveOrgResponse = {
  containers?: {
    cna?: {
      affected?: CveOrgAffected[];
    };
  };
};

function toSeverity(score: number | null): SeverityLevel {
  if (score === null) {
    return "Unknown";
  }
  if (score >= 9.0) {
    return "Critical";
  }
  if (score >= 7.0) {
    return "High";
  }
  if (score >= 4.0) {
    return "Medium";
  }
  return "Low";
}

function pickPrimaryMetric(cve: NvdCve): NvdMetric | null {
  const metrics =
    cve.metrics?.cvssMetricV31 ??
    cve.metrics?.cvssMetricV30 ??
    cve.metrics?.cvssMetricV2 ??
    [];

  return metrics[0] ?? null;
}

function toCvssDetails(cve: NvdCve): CvssDetails | null {
  const metric = pickPrimaryMetric(cve);
  if (!metric?.cvssData) {
    return null;
  }

  const data = metric.cvssData;
  return {
    version: data.version ?? "unknown",
    vectorString: data.vectorString,
    baseScore: typeof data.baseScore === "number" ? data.baseScore : null,
    baseSeverity: data.baseSeverity,
    attackVector: data.attackVector,
    attackComplexity: data.attackComplexity,
    privilegesRequired: data.privilegesRequired,
    userInteraction: data.userInteraction,
    scope: data.scope,
    confidentialityImpact: data.confidentialityImpact,
    integrityImpact: data.integrityImpact,
    availabilityImpact: data.availabilityImpact,
    exploitabilityScore: metric.exploitabilityScore,
    impactScore: metric.impactScore,
  };
}

function pickDescription(cve: NvdCve): string {
  const english = cve.descriptions?.find((description) => description.lang === "en")?.value;
  return english?.trim() || "No description provided.";
}

function extractCwes(cve: NvdCve): string[] {
  const unique = new Set<string>();
  for (const weakness of cve.weaknesses ?? []) {
    for (const entry of weakness.description ?? []) {
      const value = entry.value?.trim();
      if (value && value.startsWith("CWE-")) {
        unique.add(value);
      }
    }
  }
  return Array.from(unique);
}

function cpeTypeFromChar(part: string): CpeType {
  if (part === "a") {
    return "application";
  }
  if (part === "o") {
    return "os";
  }
  if (part === "h") {
    return "hardware";
  }
  return "unknown";
}

function humanizeToken(token: string | undefined): string {
  if (!token || token === "*" || token === "-") {
    return "";
  }
  return token.replace(/_/g, " ");
}

function formatVersionRange(match: NvdCpeMatch, version: string): string {
  const startIncluding = match.versionStartIncluding;
  const startExcluding = match.versionStartExcluding;
  const endIncluding = match.versionEndIncluding;
  const endExcluding = match.versionEndExcluding;

  if (!startIncluding && !startExcluding && !endIncluding && !endExcluding) {
    if (!version || version === "*" || version === "-") {
      return "all versions";
    }
    return version;
  }

  const parts: string[] = [];
  if (startIncluding) {
    parts.push(`>= ${startIncluding}`);
  } else if (startExcluding) {
    parts.push(`> ${startExcluding}`);
  }
  if (endIncluding) {
    parts.push(`<= ${endIncluding}`);
  } else if (endExcluding) {
    parts.push(`< ${endExcluding}`);
  }
  return parts.join(", ") || version || "all versions";
}

function extractAffectedProducts(cve: NvdCve): AffectedProduct[] {
  const results = new Map<string, AffectedProduct>();

  for (const configuration of cve.configurations ?? []) {
    for (const node of configuration.nodes ?? []) {
      for (const match of node.cpeMatch ?? []) {
        if (!match.criteria || match.vulnerable === false) {
          continue;
        }

        const segments = match.criteria.split(":");
        if (segments.length < 6 || segments[0] !== "cpe") {
          continue;
        }

        const cpeType = cpeTypeFromChar(segments[2]);
        const vendor = humanizeToken(segments[3]);
        const product = humanizeToken(segments[4]);
        const version = segments[5] ?? "*";

        if (!vendor || !product) {
          continue;
        }

        const versionRange = formatVersionRange(match, version);
        const key = `${vendor}|${product}|${versionRange}|${cpeType}`;

        if (!results.has(key)) {
          results.set(key, {
            vendor,
            product,
            versionRange,
            cpeType,
            cpe: match.criteria,
          });
        }
      }
    }
  }

  return Array.from(results.values());
}

function formatCveOrgVersionRange(versions: CveOrgVersion[] | undefined): string {
  if (!versions || versions.length === 0) {
    return "all versions";
  }

  const parts: string[] = [];
  for (const entry of versions) {
    if (entry.status && entry.status !== "affected") {
      continue;
    }

    const raw = entry.version?.trim();
    const lessThan = entry.lessThan?.trim();
    const lessThanOrEqual = entry.lessThanOrEqual?.trim();

    if (lessThan) {
      const base = raw && raw !== "0" && raw !== "*" ? `>= ${raw}, ` : "";
      parts.push(`${base}< ${lessThan}`);
      continue;
    }
    if (lessThanOrEqual) {
      const base = raw && raw !== "0" && raw !== "*" ? `>= ${raw}, ` : "";
      parts.push(`${base}<= ${lessThanOrEqual}`);
      continue;
    }
    if (raw) {
      parts.push(raw);
    }
  }

  const unique = Array.from(new Set(parts));
  return unique.length > 0 ? unique.join("; ") : "all versions";
}

function extractAffectedFromCveOrg(payload: CveOrgResponse): AffectedProduct[] {
  const results = new Map<string, AffectedProduct>();

  for (const entry of payload.containers?.cna?.affected ?? []) {
    const vendorRaw = entry.vendor?.trim();
    const productRaw = entry.product?.trim() || entry.packageName?.trim();
    if (!productRaw || productRaw.toLowerCase() === "n/a") {
      continue;
    }

    const vendor =
      vendorRaw && vendorRaw.toLowerCase() !== "n/a" ? vendorRaw : productRaw;
    const product = productRaw;
    const versionRange = formatCveOrgVersionRange(entry.versions);
    const cpe = entry.cpes?.[0] ?? "";
    const key = `${vendor.toLowerCase()}|${product.toLowerCase()}|${versionRange}`;

    if (!results.has(key)) {
      results.set(key, {
        vendor,
        product,
        versionRange,
        cpeType: "unknown",
        cpe,
      });
    }
  }

  return Array.from(results.values());
}

async function fetchCveOrgAffected(cveId: string): Promise<AffectedProduct[]> {
  const endpoint = `https://cveawg.mitre.org/api/cve/${encodeURIComponent(cveId)}`;

  try {
    const response = await fetch(endpoint, {
      headers: { "User-Agent": "pocwatch" },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as CveOrgResponse;
    return extractAffectedFromCveOrg(payload);
  } catch (error) {
    console.warn(`CVE.org lookup failed for ${cveId}:`, error);
    return [];
  }
}

function extractReferences(cve: NvdCve): CveReference[] {
  return (cve.references ?? [])
    .filter((reference): reference is NvdReference & { url: string } => Boolean(reference.url))
    .map((reference) => ({
      url: reference.url,
      source: reference.source ?? "",
      tags: reference.tags ?? [],
    }));
}

async function fetchEpssScores(cveIds: string[]): Promise<Map<string, EpssInfo>> {
  if (cveIds.length === 0) {
    return new Map();
  }

  const endpoint = `https://api.first.org/data/v1/epss?cve=${encodeURIComponent(cveIds.join(","))}`;

  try {
    const response = await fetch(endpoint, {
      headers: { "User-Agent": "pocwatch" },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      console.warn(`EPSS API returned ${response.status}`);
      return new Map();
    }

    const payload = (await response.json()) as EpssResponse;
    const map = new Map<string, EpssInfo>();
    for (const entry of payload.data ?? []) {
      const score = Number.parseFloat(entry.epss);
      const percentile = Number.parseFloat(entry.percentile);
      if (!Number.isNaN(score) && !Number.isNaN(percentile)) {
        map.set(entry.cve, { score, percentile });
      }
    }
    return map;
  } catch (error) {
    console.error("EPSS fetch failed:", error);
    return new Map();
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const idx = cursor;
      cursor += 1;
      if (idx >= items.length) {
        return;
      }
      results[idx] = await mapper(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

function buildCveRecord(cve: NvdCve | undefined): CveRecord | null {
  if (!cve?.id) {
    return null;
  }

  const cvss = toCvssDetails(cve);
  const score = cvss?.baseScore ?? null;
  const references = extractReferences(cve);
  const hasOfficialExploitLink = references.some((reference) =>
    reference.tags.some((tag) => tag.toLowerCase() === "exploit"),
  );
  const hasVendorPatch = references.some((reference) =>
    reference.tags.some((tag) => {
      const lowered = tag.toLowerCase();
      return lowered === "patch" || lowered === "vendor advisory";
    }),
  );

  return {
    id: cve.id,
    title: pickDescription(cve),
    publishedAt: cve.published ?? new Date(0).toISOString(),
    lastModifiedAt: cve.lastModified ?? cve.published ?? new Date(0).toISOString(),
    source: cve.sourceIdentifier ?? "NVD",
    status: cve.vulnStatus ?? "Unknown",
    cvssScore: score,
    severity: toSeverity(score),
    cvss,
    cwe: extractCwes(cve),
    affected: extractAffectedProducts(cve),
    references,
    hasOfficialExploitLink,
    hasVendorPatch,
    epss: null,
    pocs: [],
  };
}

async function fetchRecentCves(limit = 200): Promise<CveRecord[]> {
  const now = new Date();
  // 30-day lookback; NVD allows up to 120 consecutive days per request.
  const lookback = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30);
  const params = new URLSearchParams({
    pubStartDate: lookback.toISOString(),
    pubEndDate: now.toISOString(),
    resultsPerPage: String(limit),
    startIndex: "0",
  });

  const endpoint = `https://services.nvd.nist.gov/rest/json/cves/2.0?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: { "User-Agent": "pocwatch" },
      next: { revalidate: 900 },
    });
  } catch (error) {
    console.error("NVD request failed:", error);
    return [];
  }

  if (!response.ok) {
    console.warn(`NVD API returned ${response.status}; returning empty CVE list.`);
    return [];
  }

  const payload = (await response.json()) as NvdApiResponse;
  const vulnerabilities = payload.vulnerabilities ?? [];

  return vulnerabilities
    .map(({ cve }) => buildCveRecord(cve))
    .filter((entry): entry is CveRecord => Boolean(entry))
    .filter((entry) => {
      // Skip CVEs that NVD has not meaningfully processed yet. These statuses
      // rarely carry useful analysis data (CVSS, CPEs, CWEs) and add noise.
      const normalized = entry.status.toLowerCase();
      return normalized !== "awaiting analysis" && normalized !== "unknown";
    })
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt));
}

export const CVE_ID_PATTERN = /^CVE-\d{4}-\d{4,7}$/i;

export type CveLookupResult =
  | { ok: true; cve: CveRecord }
  | { ok: false; error: string };

export async function fetchCveById(rawId: string): Promise<CveLookupResult> {
  const cveId = rawId.trim().toUpperCase();
  if (!CVE_ID_PATTERN.test(cveId)) {
    return { ok: false, error: "Invalid CVE ID format. Expected e.g. CVE-2017-8928." };
  }

  const params = new URLSearchParams({ cveId });
  const endpoint = `https://services.nvd.nist.gov/rest/json/cves/2.0?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: { "User-Agent": "pocwatch" },
      next: { revalidate: 3600 },
    });
  } catch (error) {
    console.error(`NVD lookup failed for ${cveId}:`, error);
    return { ok: false, error: "NVD request failed. Try again in a moment." };
  }

  if (response.status === 404) {
    return { ok: false, error: `${cveId} not found in NVD.` };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: `NVD returned ${response.status}. The API may be rate limiting; try again shortly.`,
    };
  }

  const payload = (await response.json()) as NvdApiResponse;
  const record = buildCveRecord(payload.vulnerabilities?.[0]?.cve);

  if (!record) {
    return { ok: false, error: `${cveId} not found in NVD.` };
  }

  // Enrich a single record with EPSS, GitHub PoCs, and CVE.org fallback in
  // parallel. Failures degrade gracefully (each fetcher returns empty data).
  const [epssMap, pocs, fallbackAffected] = await Promise.all([
    fetchEpssScores([record.id]),
    fetchPocsForCve(record.id),
    record.affected.length > 0
      ? Promise.resolve(record.affected)
      : fetchCveOrgAffected(record.id),
  ]);

  return {
    ok: true,
    cve: {
      ...record,
      affected: fallbackAffected,
      pocs,
      epss: epssMap.get(record.id) ?? null,
    },
  };
}

async function fetchPocsForCve(cveId: string): Promise<PocReference[]> {
  const query = encodeURIComponent(`"${cveId}" poc in:name,description,readme`);
  const endpoint = `https://api.github.com/search/repositories?q=${query}&sort=updated&order=desc&per_page=3`;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "pocwatch",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers,
      next: { revalidate: 3600 },
    });
  } catch (error) {
    console.error(`GitHub PoC lookup failed for ${cveId}:`, error);
    return [];
  }

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as GitHubSearchResponse;
  return (payload.items ?? []).map((repo) => ({
    name: repo.full_name,
    url: repo.html_url,
    description: repo.description,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    updatedAt: repo.updated_at,
    language: repo.language,
    archived: repo.archived,
  }));
}

export async function getDashboardData(): Promise<CveRecord[]> {
  const cves = await fetchRecentCves(200);
  if (cves.length === 0) {
    return [];
  }

  const epssMap = await fetchEpssScores(cves.map((cve) => cve.id));

  // Concurrency is kept modest so we stay well under GitHub's search rate
  // limit (30 req/min authenticated, 10 req/min unauthenticated) and avoid
  // hammering cve.org with a burst of 200 parallel requests.
  const concurrency = process.env.GITHUB_TOKEN ? 8 : 3;

  const enriched = await mapWithConcurrency(cves, concurrency, async (cve) => {
    const [pocs, affected] = await Promise.all([
      fetchPocsForCve(cve.id),
      // NVD often publishes CVEs before its analysts add CPE configurations,
      // so fall back to the CNA-authored record on cve.org to surface
      // affected products immediately after publication.
      cve.affected.length > 0
        ? Promise.resolve(cve.affected)
        : fetchCveOrgAffected(cve.id),
    ]);

    return {
      ...cve,
      affected,
      pocs,
      epss: epssMap.get(cve.id) ?? null,
    };
  });

  return enriched;
}
