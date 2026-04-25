# PoCWatch

A live triage dashboard for newly published CVEs, enriched with EPSS exploit-likelihood scores, NVD reference tags (Patch / Exploit / Vendor Advisory / etc.), affected products, and links to public proof-of-concept repositories on GitHub.

Built to answer the only question that matters during a vulnerability scramble: **which of yesterday's CVEs already have working exploits?**

---

## Features

- **Last 30 days from NVD** — pulls up to 200 recently published CVEs (filters out `Awaiting Analysis` / `Unknown` records) so the feed is signal, not noise.
- **EPSS scoring** — every CVE is annotated with FIRST.org's Exploit Prediction Scoring System probability and percentile.
- **PoC discovery** — searches GitHub for repositories mentioning each CVE ID and surfaces stars, last push date, and description.
- **Exploit-tagged references** — calls out NVD references tagged `Exploit`, `Vendor Advisory`, `Patch`, `Mitigation`, etc., so you can jump straight to the proof or the fix.
- **Affected products** — parses NVD CPE configurations and falls back to the CVE.org (MITRE) record when NVD's enrichment lags behind publication, so newly disclosed software (e.g. mailcow) shows up immediately.
- **Severity-prioritized tabs** — `Critical`, `High`, `With PoC / Exploit`, and `All`, with custom-tinted severity badges.
- **Tag filters** — multi-select chips with AND semantics across NVD reference tags.
- **On-demand lookup** — search any CVE by exact ID; if it isn't in the 30-day window it's fetched live from NVD and merged into the view.
- **Light / dark / system theme** — use the theme that suits your preference.
- **Collapsible cards** — each CVE is a one-line summary by default, expanding to the full detail view on click.

---

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router, Server Components, Server Actions) on Webpack
- [React 19](https://react.dev/) + [TypeScript 5](https://www.typescriptlang.org/)
- [Tailwind CSS 4](https://tailwindcss.com/) + [Shadcn UI](https://ui.shadcn.com/)
- [lucide-react](https://lucide.dev/) icons
- [next-themes](https://github.com/pacocoursey/next-themes) for theme switching
- [Docker](https://www.docker.com/) multi-stage build using Next.js' `output: "standalone"` mode

### Data sources

| Source | Used for |
| --- | --- |
| [NVD 2.0 API](https://nvd.nist.gov/developers/vulnerabilities) | CVE metadata, CVSS, CWE, CPE, references |
| [CVE.org (MITRE) API](https://cveawg.mitre.org/api/) | Affected-product fallback when NVD CPE data is absent |
| [FIRST.org EPSS API](https://www.first.org/epss/api) | Exploit-prediction probability + percentile |
| [GitHub Search API](https://docs.github.com/en/rest/search/search) | Public PoC repository discovery |

---

## Prerequisites

- **Docker** (recommended) — [Docker Desktop](https://www.docker.com/products/docker-desktop/) on Windows/macOS, or Docker Engine + Compose on Linux
- **Or** Node.js 20+ if you'd rather run from source for development
- (Optional) A GitHub personal access token to lift PoC-search rate limits from 10 to 30 req/min

---

## Quick start (Docker)

The fastest way to run PoCWatch — no Node toolchain required.

### 1. Clone and configure

```bash
git clone https://github.com/<your-username>/pocwatch.git
cd pocwatch
cp .env.example .env
```

Edit `.env` and fill in any tokens you have. Both values are optional — the app works without them, just slower (rate-limited):

```bash
GITHUB_TOKEN=ghp_your_personal_access_token
NVD_API_KEY=
```

A classic GitHub PAT with no scopes (or just `public_repo`) is enough.

### 2. Build and start

```bash
docker compose up -d
```

First build takes 2–4 minutes (npm install + `next build`). Subsequent restarts are instant.

### 3. Open the dashboard

Browse to [http://localhost:3000](http://localhost:3000).

### Day-to-day commands

```bash
docker compose logs -f          # tail logs
docker compose restart          # restart after .env changes
docker compose up -d --build    # rebuild after code changes
docker compose down             # stop and remove the container
```

The container runs as a non-root user, restarts automatically on failure (`restart: unless-stopped`), and exposes a `wget`-based healthcheck against the home page so it's safe to put behind Caddy / Traefik / nginx for TLS.

### Multi-arch builds

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t pocwatch .
```

Works on x86 servers, Raspberry Pi, and Apple Silicon homelabs.

### Without Compose

If you'd rather not use Compose:

```bash
docker build -t pocwatch .
docker run --rm -p 3000:3000 \
  -e GITHUB_TOKEN=ghp_your_personal_access_token \
  --name pocwatch \
  pocwatch
```

---

## Local development (npm)

For contributors who want hot-reload and fast edit cycles. Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). File saves trigger fast refresh.

### Other scripts

```bash
npm run build    # production build (Webpack — see note below)
npm run start    # serve the build output
npm run lint     # ESLint
```

> The build script pins Webpack (`next build --webpack`) because Turbopack's native binary doesn't ship for some Windows configurations.

---

## Project layout

```
src/
  app/
    actions.ts          # Server Actions (lookupCveById)
    globals.css         # Tailwind + theme tokens (teal / mist palette)
    icon.svg            # Favicon (binoculars on teal tile)
    layout.tsx          # Root layout, ThemeProvider, metadata
    page.tsx            # Server component, fetches dashboard data
  components/
    cve-dashboard.tsx   # Main client UI (search, tabs, cards, filters)
    theme-provider.tsx  # next-themes wrapper
    theme-toggle.tsx    # Light/dark/system menu
    ui/                 # Shadcn primitives
  lib/
    cve.ts              # All data fetching, parsing, and enrichment
    utils.ts            # cn() helper
Dockerfile              # Multi-stage build → standalone Next.js runtime
docker-compose.yml      # One-command deploy with healthcheck + restart policy
.dockerignore           # Keeps node_modules / .next / .env out of the build context
.env.example            # Template for .env (Docker) and .env.local (npm dev)
next.config.ts          # output: "standalone", devIndicators disabled
```

---

## How enrichment works

For each `getDashboardData()` call:

1. Pull the last 30 days of CVEs from NVD (up to 200), filtering out records still awaiting analysis.
2. Fetch EPSS scores for the entire batch in a single request.
3. For every CVE, in parallel (with a small concurrency limiter to avoid 429s):
   - Search GitHub for `CVE-YYYY-NNNN` repositories.
   - If NVD returned no `affected` configurations, fall back to the CVE.org record to recover the vendor / product / version range.
4. Merge everything into a `CveRecord` and sort by published date.

On-demand lookups (`lookupCveById`) re-use `buildCveRecord` so an explicitly searched CVE always shows full PoC + EPSS enrichment, even if it's older than 30 days or still in `Awaiting Analysis`.

---

## Troubleshooting

### `error during connect: open //./pipe/dockerDesktopLinuxEngine`

Docker Desktop isn't running. Launch it from the Start menu and wait for the tray whale icon to stop animating, then re-run `docker compose up -d`. Verify with `docker version` — both a `Client:` and a `Server:` block should appear.

### `Invalid interpolation format` from `docker compose`

Compose env-var defaults use `${VAR:-default}` (dash before the value), not `${VAR:default}`. See `docker-compose.yml` for the correct shape.

### Dashboard shows "No CVEs match your filters"

You're being rate-limited by NVD (HTTP 429). Wait 30 seconds, or request an [NVD API key](https://nvd.nist.gov/developers/request-an-api-key) and set `NVD_API_KEY` in `.env`, then `docker compose restart`.

### GitHub PoC links are missing

Same cause — the unauthenticated GitHub Search API is capped at 10 req/min. Add a `GITHUB_TOKEN` to `.env` and `docker compose restart`.

### Port 3000 is already in use

Either stop the conflicting process or remap the port in `docker-compose.yml`:

```yaml
ports:
  - "8080:3000"   # host:container
```

Then browse to `http://localhost:8080`.

---

## Notes & limitations

- **NVD rate limits** are aggressive for unauthenticated clients. The app degrades gracefully (returns an empty list) rather than throwing.
- **GitHub unauthenticated** is capped at 10 search requests / minute. The dashboard fetches PoCs for every visible CVE, so a `GITHUB_TOKEN` is strongly recommended.
- **PoC quality is not vetted.** A repository mentioning a CVE ID is not necessarily a working exploit — treat results as starting points for triage, not as ground truth.
- **In-memory cache** is lost on container restart. The Next.js fetch cache uses a 1-hour `revalidate`, so a cold start will re-hit all upstream APIs once.

---

## License

MIT — for personal / research use. The data fetched belongs to its respective sources (NIST, MITRE, FIRST.org, GitHub).
