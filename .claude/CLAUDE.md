# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TATC** — Teacher Online Attendance System (ระบบเช็คการเข้า-ออกครูออนไลน์)

A Next.js 14 App Router application for teacher attendance tracking with LINE Login, GPS geofencing, and PostgreSQL as the database backend.

## Common Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run db:types     # Regenerate TypeScript types from Supabase schema → src/types/database.ts
npm run seed:whitelist  # Import staff CSV into staff_whitelist table (Node.js 20.6+ required)
```

## Architecture

### Database Layer

**The app migrated away from the Supabase client to direct PostgreSQL** via `pg` pool.

- `src/lib/postgres.ts` — singleton `Pool` connecting via `DATABASE_URL`. Only imported by `db.ts`.
- `src/lib/db.ts` — **all database access goes through this module only**. To migrate the DB backend, change only this file while keeping function signatures identical.
- `src/lib/supabase.ts` — intentionally empty (left as stub after migration).

### Auth Flow

- NextAuth v4 with LINE Login OAuth 2.0 (`src/lib/auth.ts`).
- On first login, a `pending` user record is auto-created (`is_pending = true`, `is_active = false`).
- Pending users are redirected to `/auth/pending`. An admin must activate them.
- JWT token carries: `userId`, `role`, `nameTh`, `dept`, `isPending`. Token self-heals if pending status changes without re-login.
- Session type augmentation lives in `src/types/next-auth.d.ts`.

### Middleware & Role Guards

`src/middleware.ts` uses `withAuth` from NextAuth:

| Path pattern | Allowed roles |
|---|---|
| `/admin/*`, `/report/*` | `admin` only |
| `/dashboard/*`, `/presence/*` | `admin`, `executive` |
| `/checkin/*` | any authenticated user |

Root `/` redirects: `admin` → `/dashboard`, others → `/checkin`.

### Attendance Business Logic (`src/lib/attendance.ts`)

All time logic runs in school local timezone (`NEXT_PUBLIC_SCHOOL_TZ`, default `Asia/Bangkok`).

- **`resolveStatus(date)`** — returns `present` or `late` vs. `NEXT_PUBLIC_CHECKIN_CUTOFF` (default `08:00`).
- **`isPastAbsentCutoff()`** — after `NEXT_PUBLIC_ABSENT_CUTOFF` (default `12:00`), check-in requires a late reason.
- **`isPastHardAbsentCutoff()`** — after `NEXT_PUBLIC_CHECKOUT_AVAILABLE_AFTER` (default `16:30`), check-in is blocked.
- **`isWithinGeofence(lat, lng)`** — Haversine distance check against school coordinates + radius.
- **`'absent'` is never written to DB** — it is a computed display state only. DB stores only `present` | `late`.

### API Routes

```
/api/auth/[...nextauth]          LINE OAuth handler
/api/attendance/checkin          POST — record check-in (geofence or WFH)
/api/attendance/checkout         POST — record check-out
/api/attendance/today            GET  — current user's today status
/api/attendance/history          GET  — personal history
/api/admin/attendance            GET  — all teachers today (admin)
/api/admin/export                GET  — export XLSX (admin)
/api/admin/export-presence       GET  — export presence board
/api/admin/export-raw            GET  — raw attendance export
/api/admin/export-report         GET  — monthly report export
/api/admin/import                POST — bulk import attendance
/api/admin/users                 CRUD user management
/api/admin/checkin               Admin-initiated check-in override
```

### Types

`src/types/index.ts` is the canonical type source aligned with the DB schema.

Key constraints:
- `AttendanceStatus` = `'present' | 'late' | 'absent'` (UI/API only; `absent` not stored)
- `StoredAttendanceStatus` = `'present' | 'late'` (DB values only)
- `LocationMode` = `'campus' | 'wfh'`

### Deployment

- `output: 'standalone'` in `next.config.js` — supports Docker and self-hosted via `Dockerfile`.
- Environment variables follow the schema in README.md. Local file: `.env.local`.
- `DATABASE_URL` is the primary DB connection (postgres pool). Supabase client vars are legacy and no longer used for DB queries.

## Code Map

See [.claude/CODE_MAP.md](.claude/CODE_MAP.md) for a file-by-file reference.

## Environment Variables

| Key | Purpose |
|-----|---------|
| `DATABASE_URL` | Direct PostgreSQL connection string (primary) |
| `LINE_CLIENT_ID` / `LINE_CLIENT_SECRET` | LINE Login OAuth |
| `NEXTAUTH_SECRET` / `NEXTAUTH_URL` | NextAuth config |
| `NEXT_PUBLIC_SCHOOL_LAT/LNG` | Geofence center |
| `NEXT_PUBLIC_GEOFENCE_RADIUS` | Geofence radius in metres |
| `NEXT_PUBLIC_CHECKIN_CUTOFF` | Late threshold (HH:mm, default `08:00`) |
| `NEXT_PUBLIC_ABSENT_CUTOFF` | Reason required after (default `12:00`) |
| `NEXT_PUBLIC_CHECKOUT_AVAILABLE_AFTER` | Hard cutoff for check-in (default `16:30`) |
| `NEXT_PUBLIC_SCHOOL_TZ` | School timezone (default `Asia/Bangkok`) |
