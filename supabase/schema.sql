-- ============================================================
-- TOAS — Teacher Online Attendance System
-- Database schema  (PostgreSQL / Supabase)
--
-- Run once to initialise a fresh database.
-- Compatible with Supabase, Neon, Railway, or any hosted
-- PostgreSQL instance ≥ 14.
-- ============================================================

-- ── Tables ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id  text        UNIQUE NOT NULL,
  full_name_th  text        NOT NULL DEFAULT '',
  national_id   char(13),
  employee_id   text,
  department    text,
  role          text        NOT NULL DEFAULT 'teacher'
                            CHECK (role IN ('teacher', 'admin', 'executive')),
  is_active     boolean     NOT NULL DEFAULT false,
  is_pending    boolean     NOT NULL DEFAULT true,
  avatar_url    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date          date        NOT NULL,
  check_in_at   timestamptz,
  check_out_at  timestamptz,
  location_mode text        NOT NULL DEFAULT 'campus'
                            CHECK (location_mode IN ('campus', 'wfh')),
  -- Coordinates are set only for campus check-ins; NULL for WFH
  check_in_lat  float8,
  check_in_lng  float8,
  -- Only 'present' or 'late' are ever stored.
  -- 'absent' is a computed display state (no record exists for that day).
  status        text        NOT NULL DEFAULT 'present'
                            CHECK (status IN ('present', 'late')),
  selfie_url    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),  -- refreshed by trigger on every UPDATE

  UNIQUE (user_id, date)   -- prevents duplicate check-ins; required for ON CONFLICT upserts
);

-- Auto-refresh updated_at whenever a row is updated (e.g. check-out written)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_attendance_updated_at
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Indexes ───────────────────────────────────────────────────
-- Critical for 300-user peak-load performance.

-- Auth flow: look up user on every login
CREATE INDEX IF NOT EXISTS idx_users_line_user_id
  ON public.users (line_user_id);

-- Admin dashboard / presence: fetch all active teachers
CREATE INDEX IF NOT EXISTS idx_users_role_active
  ON public.users (role, is_active);

-- Check-in / check-out: find today's record for a user  ← hot path
CREATE INDEX IF NOT EXISTS idx_attendance_user_date
  ON public.attendance_records (user_id, date);

-- Admin dashboard + report: all records for a given date range
CREATE INDEX IF NOT EXISTS idx_attendance_date
  ON public.attendance_records (date);

-- ── Row Level Security ────────────────────────────────────────
-- All server-side queries use SUPABASE_SERVICE_ROLE_KEY which
-- bypasses RLS automatically.  These policies are a
-- defence-in-depth measure: they block direct anonymous access
-- if someone obtains the anon key.

ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Deny all anonymous access (no direct client-side DB calls)
CREATE POLICY "deny_anon_users"
  ON public.users FOR ALL TO anon USING (false);

CREATE POLICY "deny_anon_attendance"
  ON public.attendance_records FOR ALL TO anon USING (false);
