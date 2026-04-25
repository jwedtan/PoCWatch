"use server";

import { fetchCveById, type CveLookupResult } from "@/lib/cve";

export async function lookupCveById(cveId: string): Promise<CveLookupResult> {
  return fetchCveById(cveId);
}
