-- ============================================================
-- TutorUG — Security Hardening Migration
-- Run this in the Supabase SQL Editor (safe to run repeatedly).
--
-- Adds:
--   1. Safe `profiles` view + own/admin RPC accessors, and
--      column-level SELECT revocation on raw user PII (email,
--      school, combination, course, profession). NOBODY can read
--      another user's email through the `users` table anymore.
--   2. `rate_limits` table + `consume_rate_limit()` used by
--      Edge Function OTP/reset flows (brute-force protection).
--   3. Data retention job (pg_cron) that purges transient and
--      aged-out analytics data on a schedule.
--   4. `documents.consent_processing` column for the upload
--      consent flow.
-- ============================================================

-- ── 1. SAFE PUBLIC PROFILES + PII PROTECTION ───────────────────────────
-- Remove the overly-permissive public read on the raw users table.
drop policy if exists "users_public_read" on public.users;

-- A view that exposes ONLY safe profile columns. Because it is owned by
-- postgres (superuser, BYPASSRLS) it returns all users, but note that it
-- contains no email or institution data — safe to read for membership UIs.
create or replace view public.profiles
with (security_invoker = false) as
select p.user_id, p.name, p.avatar_url, p.district, p.region, p.education_level
from public.users p;

grant select on public.profiles to anon, authenticated;

-- Own-profile accessor: returns the full row (incl. email, school, ...)
-- for the signed-in user only. Security definer bypasses column revokes.
create or replace function public.get_own_profile()
returns setof public.users
language sql security definer set search_path = public
as $$
  select * from public.users where user_id::text = auth.uid()::text;
$$;

revoke all on function public.get_own_profile() from public;
grant execute on function public.get_own_profile() to authenticated;

-- Admin accessors: only admins get to see full user rows (incl. email).
create or replace function public.admin_list_users()
returns setof public.users
language sql security definer set search_path = public
as $$
  select * from public.users
  where public.is_admin()
  order by created_at desc;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

create or replace function public.admin_find_user(p_email text)
returns setof public.users
language sql security definer set search_path = public
as $$
  select * from public.users
  where public.is_admin()
    and email ilike p_email
  limit 1;
$$;

revoke all on function public.admin_find_user(text) from public;
grant execute on function public.admin_find_user(text) to authenticated;

-- Revoke direct column-level SELECT on sensitive PII from the anon and
-- authenticated roles. Own profile and admin reads are now served through
-- the security-definer functions above, so nothing else in the app needs
-- these columns directly.
revoke select (email, school, combination, course, profession)
  on public.users from anon, authenticated;

-- ── 2. RATE LIMITING STORE + FUNCTION ──────────────────────────────────
create table if not exists public.rate_limits (
  key text primary key,
  count int not null default 1,
  reset_at timestamptz not null default now()
);

alter table public.rate_limits enable row level security;
-- Direct table access is only via the security-definer function below;
-- RLS with no policies keeps clients out of the raw rows.

create or replace function public.consume_rate_limit(rk text, lim int, win_seconds int)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare c int;
begin
  insert into public.rate_limits (key, count, reset_at)
  values (rk, 1, clock_timestamp() + make_interval(secs => win_seconds))
  on conflict (key) do update
    set count = case
          when public.rate_limits.reset_at < clock_timestamp() then 1
          else public.rate_limits.count + 1
        end,
        reset_at = case
          when public.rate_limits.reset_at < clock_timestamp()
            then clock_timestamp() + make_interval(secs => win_seconds)
          else public.rate_limits.reset_at
        end
  returning public.rate_limits.count into c;

  if c is null then
    select count into c from public.rate_limits where key = rk;
  end if;

  return c <= lim;
end;
$$;

revoke all on function public.consume_rate_limit(text, int, int) from public;
grant execute on function public.consume_rate_limit(text, int, int) to anon, authenticated, service_role;

-- ── 3. DATA RETENTION (pg_cron) ────────────────────────────────────────
-- pg_cron powers the scheduled clean-up job below. Enable it if missing.
create extension if not exists pg_cron;
comment on extension pg_cron is 'Scheduled jobs for data retention';

do $$ begin
  if to_regclass('cron.job') is not null then
    begin
      perform cron.unschedule('tutorug-retention');
    exception when others then null;  -- job doesn't exist yet → nothing to do
    end;
  end if;
end $$;

select cron.schedule(
  'tutorug-retention',
  '0 3 * * *',  -- daily at 03:00 UTC
  $$
  begin
    -- Expired password reset codes older than a week.
    delete from public.password_reset_otps
      where expires_at < (now() - interval '7 days');

    -- Rate-limit counters older than a day.
    delete from public.rate_limits
      where reset_at < (now() - interval '1 day');

    -- Usage/attendance analytics older than 24 months.
    delete from public.study_session_logs
      where created_at::timestamptz < (now() - interval '24 months');

    -- Generated podcast scripts older than 24 months.
    delete from public.podcast_sessions
      where created_at::timestamptz < (now() - interval '24 months');

    -- Finished/cancelled meetings older than 12 months.
    delete from public.meetings
      where status in ('complete', 'cancelled')
        and scheduled_at::timestamptz < (now() - interval '12 months');

    -- Flagged moderation messages older than 12 months.
    delete from public.room_messages
      where flagged = true
        and created_at::timestamptz < (now() - interval '12 months');
  end;
  $$
);

-- ── 4. DOCUMENT PROCESSING CONSENT ─────────────────────────────────────
alter table public.documents
  add column if not exists consent_processing boolean not null default false;