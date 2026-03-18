-- Staff whitelist — previously stored as data/Listname.csv (gitignored)
-- Moved to Supabase so it is available on all deployments (Vercel, etc.)
-- PII is protected: RLS enabled with no anon/authenticated policies
-- (only service_role key, used server-side, can access this table)
--
-- NOTE: national_id is NOT unique alone — the same ID can appear with different
-- names (data quality issue in source CSV). The combination (national_id, full_name_th)
-- must be unique. national_id can also be non-numeric (e.g. EM5569324, passport numbers).

CREATE TABLE IF NOT EXISTS staff_whitelist (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  national_id  text   NOT NULL,
  full_name_th text   NOT NULL,
  UNIQUE (national_id, full_name_th)
);

ALTER TABLE staff_whitelist ENABLE ROW LEVEL SECURITY;

-- Index for name search (used by /api/auth/suggest)
CREATE INDEX IF NOT EXISTS idx_whitelist_name ON staff_whitelist (full_name_th);
CREATE INDEX IF NOT EXISTS idx_whitelist_id   ON staff_whitelist (national_id);
