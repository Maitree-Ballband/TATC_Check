-- Migration: 003_add_missing_columns
-- Adds columns and enum value required by current application code
-- but absent from the initial 001_init migration.
-- Safe to run on an existing database (all operations are idempotent).

-- ── users: missing columns ────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS national_id  char(13),
  ADD COLUMN IF NOT EXISTS employee_id  text,
  ADD COLUMN IF NOT EXISTS is_pending   boolean NOT NULL DEFAULT true;

-- ── user_role enum: add executive value ───────────────────────────────────────
-- ALTER TYPE ... ADD VALUE is irreversible but safe to run once.
-- Guard: only add if the value does not already exist.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'executive'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'executive';
  END IF;
END$$;

-- ── attendance_records: missing columns ───────────────────────────────────────

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS selfie_url  text,
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();

-- ── updated_at trigger (idempotent) ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_attendance_updated_at'
  ) THEN
    CREATE TRIGGER trg_attendance_updated_at
      BEFORE UPDATE ON public.attendance_records
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

-- ── Indexes (idempotent) ──────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_line_user_id
  ON public.users (line_user_id);

CREATE INDEX IF NOT EXISTS idx_users_role_active
  ON public.users (role, is_active);

CREATE INDEX IF NOT EXISTS idx_attendance_user_date
  ON public.attendance_records (user_id, date);

CREATE INDEX IF NOT EXISTS idx_attendance_date
  ON public.attendance_records (date);
