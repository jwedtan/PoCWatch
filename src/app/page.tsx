import { CveDashboard } from "@/components/cve-dashboard";
import { getDashboardData } from "@/lib/cve";

export default async function Home() {
  const cves = await getDashboardData();
  return <CveDashboard cves={cves} />;
}
