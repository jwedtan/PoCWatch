import { CveDashboard } from "@/components/cve-dashboard";
import { listAssets } from "@/lib/asset-db";
import { getDashboardData } from "@/lib/cve";

// Asset list comes from SQLite and must update after Server Actions + refresh.
export const dynamic = "force-dynamic";

export default async function Home() {
  const cves = await getDashboardData();
  const assets = listAssets();
  return <CveDashboard cves={cves} assets={assets} />;
}
