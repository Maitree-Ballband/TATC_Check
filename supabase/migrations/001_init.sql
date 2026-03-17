-- =============================================================
-- TOAS — Teacher Online Attendance System
-- Migration: 001_init
-- Run: supabase db push  OR paste into Supabase SQL editor
-- =============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Enum types ───────────────────────────────────────────────
create type user_role        as enum ('teacher', 'admin');
create type location_mode    as enum ('campus', 'wfh');
create type attendance_status as enum ('present', 'late', 'absent');

-- ── users ────────────────────────────────────────────────────
create table public.users (
  id             uuid         primary key default uuid_generate_v4(),
  line_user_id   varchar(50)  not null unique,
  full_name_th   varchar(200) not null,
  department     varchar(100),
  role           user_role    not null default 'teacher',
  is_active      boolean      not null default true,
  avatar_url     text,
  created_at     timestamptz  not null default now()
);

comment on table public.users is 'Registered LINE accounts (whitelist). Admin must insert rows before teachers can log in.';

-- ── attendance_records ────────────────────────────────────────
create table public.attendance_records (
  id             uuid             primary key default uuid_generate_v4(),
  user_id        uuid             not null references public.users(id) on delete cascade,
  date           date             not null,
  check_in_at    timestamptz,
  check_out_at   timestamptz,
  location_mode  location_mode    not null default 'campus',
  check_in_lat   decimal(10,7),
  check_in_lng   decimal(10,7),
  status         attendance_status not null default 'absent',
  created_at     timestamptz      not null default now(),

  unique (user_id, date)
);

create index idx_attendance_date    on public.attendance_records(date);
create index idx_attendance_user    on public.attendance_records(user_id);
create index idx_attendance_status  on public.attendance_records(status);

-- ── Row Level Security ────────────────────────────────────────
alter table public.users              enable row level security;
alter table public.attendance_records enable row level security;

-- Teachers: read own user row
create policy "teacher_read_own_user" on public.users
  for select using (
    line_user_id = (select line_user_id from public.users where id = auth.uid())
  );

-- Teachers: read & write own attendance
create policy "teacher_read_own_att" on public.attendance_records
  for select using (user_id = auth.uid());

create policy "teacher_insert_own_att" on public.attendance_records
  for insert with check (user_id = auth.uid());

create policy "teacher_update_own_att" on public.attendance_records
  for update using (user_id = auth.uid());

-- Admins: full access (service role bypasses RLS — used in API routes)
-- These policies are for any future direct-DB admin tooling
create policy "admin_all_users" on public.users
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "admin_all_attendance" on public.attendance_records
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- ── Seed: example admin account ──────────────────────────────
-- Replace line_user_id with your actual LINE User ID
-- insert into public.users (line_user_id, full_name_th, role)
-- values ('Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'ผู้ดูแลระบบ', 'admin');

-- ── Auto-mark absent (run as cron at 17:00 each weekday) ─────
-- Supabase Edge Function or pg_cron handles this.
-- SQL for the batch job:
-- insert into public.attendance_records (user_id, date, status, location_mode)
-- select u.id, current_date, 'absent', 'campus'
-- from public.users u
-- where u.is_active = true
--   and u.role = 'teacher'
--   and not exists (
--     select 1 from public.attendance_records ar
--     where ar.user_id = u.id and ar.date = current_date
--   )
-- on conflict (user_id, date) do nothing;
