# syntax=docker/dockerfile:1.7

# ---------- deps ----------
# Install all dependencies (including dev deps needed to build Next.js).
FROM node:20-alpine AS deps
WORKDIR /app

# libc6-compat is recommended by the Next.js team for some Alpine builds.
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci

# ---------- builder ----------
# Build the Next.js app using Webpack (Turbopack native binaries are flaky on
# some platforms; the npm script already pins --webpack).
FROM node:20-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ---------- runner ----------
# Minimal runtime image using Next.js' standalone output.
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

# Copy the standalone server bundle, static assets, and public directory.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

# Lightweight healthcheck — the home page renders a 200 even when upstream
# APIs are rate-limited, so it's a reliable readiness signal.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]
