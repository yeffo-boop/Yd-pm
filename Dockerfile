# syntax=docker/dockerfile:1

# Multi-stage build (ADR 0007). Uses node:22-slim (Debian, glibc) rather
# than an Alpine base: argon2's native binding ships prebuilt binaries for
# common glibc targets, and Alpine's musl libc is a common source of
# native-module build/runtime friction that isn't worth fighting for the
# image-size savings at this project's scale.
ARG NODE_VERSION=22.22.2

# --- deps: install once, reused by both the build and dev-tooling steps ---
FROM node:${NODE_VERSION}-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- builder: compiles the Next.js production build and Prisma client ---
FROM node:${NODE_VERSION}-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# --- runner: minimal production image, non-root ---
FROM node:${NODE_VERSION}-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Next.js "standalone" output (next.config.ts) traces exactly the runtime
# files needed, including the generated Prisma client — no full
# node_modules copy required here.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]

# --- worker: background job process (ADR 0004, 0007) ---
# Runs worker.ts directly via tsx rather than a compiled bundle, so it
# needs the full `builder` stage's node_modules and TypeScript source, not
# the trimmed standalone `runner` image above — the two processes share a
# Dockerfile but not a final image.
FROM node:${NODE_VERSION}-slim AS worker
WORKDIR /app
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs worker
COPY --from=builder --chown=worker:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=worker:nodejs /app/worker.ts ./worker.ts
COPY --from=builder --chown=worker:nodejs /app/src ./src
COPY --from=builder --chown=worker:nodejs /app/package.json ./package.json
COPY --from=builder --chown=worker:nodejs /app/tsconfig.json ./tsconfig.json
USER worker
ENV NODE_ENV=production
CMD ["npx", "tsx", "worker.ts"]
