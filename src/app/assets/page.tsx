import { AssetManager } from "@/components/asset-manager";
import { SiteHeader } from "@/components/site-header";
import { listAssets } from "@/lib/asset-db";
import { getDashboardData } from "@/lib/cve";

// SQLite-backed inventory must not be baked into the static RSC shell (build-time
// snapshot); otherwise `router.refresh()` after mutations still shows stale rows.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Assets — PoCWatch",
  description:
    "Manage your software inventory so PoCWatch can prioritize CVEs that hit your stack.",
};

export default async function AssetsPage() {
  // Reuses the cached dashboard build (15 min TTL) so the asset page can
  // surface a live "Matching CVEs" stat without paying for a second fetch.
  const cves = await getDashboardData();
  const assets = listAssets();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-10">
      <SiteHeader />
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Asset inventory</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell PoCWatch what you run. The dashboard will surface a{" "}
          <span className="font-medium">My assets</span> tab and a match badge on
          every CVE that hits your stack.
        </p>
      </div>
      <AssetManager assets={assets} cves={cves} />
    </main>
  );
}
