# ============================================================
# TATC — Teacher Online Attendance System
# Multi-stage build สำหรับ Docker / self-hosted deployment
#
# Stage 1 (deps):    ติดตั้ง production dependencies
# Stage 2 (builder): รัน next build (NEXT_PUBLIC_* baked in ที่นี่)
# Stage 3 (runner):  minimal runtime image
#
# Build args (ส่งจาก Jenkins build stage via --build-arg):
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   NEXT_PUBLIC_SCHOOL_LAT
#   NEXT_PUBLIC_SCHOOL_LNG
#   NEXT_PUBLIC_GEOFENCE_RADIUS
#   NEXT_PUBLIC_SCHOOL_TZ
#   NEXT_PUBLIC_CHECKIN_CUTOFF
#   NEXT_PUBLIC_CHECKOUT_AVAILABLE_AFTER
#
# Runtime env vars (inject ผ่าน Nomad env block — ไม่ bake):
#   SUPABASE_SERVICE_ROLE_KEY
#   LINE_CLIENT_ID
#   LINE_CLIENT_SECRET
#   NEXTAUTH_SECRET
#   NEXTAUTH_URL
# ============================================================

# ── Stage 1: Install dependencies ─────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production

# ── Stage 2: Build ─────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy all deps (dev + prod) for build
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* vars must exist at build time (baked into JS bundle)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SCHOOL_LAT=13.736717
ARG NEXT_PUBLIC_SCHOOL_LNG=100.523186
ARG NEXT_PUBLIC_GEOFENCE_RADIUS=300
ARG NEXT_PUBLIC_SCHOOL_TZ=Asia/Bangkok
ARG NEXT_PUBLIC_CHECKIN_CUTOFF=08:00
ARG NEXT_PUBLIC_CHECKOUT_AVAILABLE_AFTER=16:30

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SCHOOL_LAT=$NEXT_PUBLIC_SCHOOL_LAT \
    NEXT_PUBLIC_SCHOOL_LNG=$NEXT_PUBLIC_SCHOOL_LNG \
    NEXT_PUBLIC_GEOFENCE_RADIUS=$NEXT_PUBLIC_GEOFENCE_RADIUS \
    NEXT_PUBLIC_SCHOOL_TZ=$NEXT_PUBLIC_SCHOOL_TZ \
    NEXT_PUBLIC_CHECKIN_CUTOFF=$NEXT_PUBLIC_CHECKIN_CUTOFF \
    NEXT_PUBLIC_CHECKOUT_AVAILABLE_AFTER=$NEXT_PUBLIC_CHECKOUT_AVAILABLE_AFTER \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Stage 3: Runner ────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

# stdout/stderr logs — collected by Promtail / Filebeat on host
CMD ["node", "server.js"]
