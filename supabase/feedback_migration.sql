-- ============================================================
-- TutorUG — feedback intake (safe to run multiple times)
-- ============================================================
-- Changes to public.reviews so the table can actually collect the
-- feedback the admin dashboard triages:
--
--   • rating  — now optional. It was NOT NULL CHECK (1..5), which
--               forced a student whose login is crashing to hand us a
--               one-star rating, or lose the report entirely. Bug
--               reports and praise now live in the same table.
--   • category— triage label (bug | feature request | complaint |
--               praise | other). Left null on insert: the student is
--               not asked to categorise their own report, the triage
--               pass sets this. See triage below.
--   • app_version / screen — free context that makes a bug report
--               actionable without asking the student to describe it.
--
-- No rows are modified. Existing rows get rating kept as-is and a
-- null category, which the triage pass backfills.
-- ============================================================

-- ── 1. Make the star rating optional ─────────────────────────
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reviews'
      and column_name = 'rating' and is_nullable = 'NO'
  ) then
    alter table public.reviews alter column rating drop not null;
  end if;
end $$;

-- ── 2. Triage columns ─────────────────────────────────────────
alter table public.reviews
  add column if not exists category text default null;
alter table public.reviews
  add column if not exists urgency text default null;
alter table public.reviews
  add column if not exists summary text default null;
alter table public.reviews
  add column if not exists triaged_at text default null;
alter table public.reviews
  add column if not exists app_version text default '';
alter table public.reviews
  add column if not exists screen text default '';

-- Constrain the labels the triage pass is allowed to write, so a bad
-- classifier response cannot pollute the admin dashboard's filters.
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'reviews_category_check'
  ) then
    alter table public.reviews
      add constraint reviews_category_check
      check (category is null or category in
        ('bug', 'feature request', 'complaint', 'praise', 'other'));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'reviews_urgency_check'
  ) then
    alter table public.reviews
      add constraint reviews_urgency_check
      check (urgency is null or urgency in ('low', 'medium', 'high'));
  end if;
end $$;

-- ── 3. Index for the dashboard's default view ────────────────
-- Untriaged rows first, newest first. Partial so it stays small
-- while the backlog is empty and only covers pending reports.
create index if not exists reviews_untriaged_idx
  on public.reviews (created_at desc)
  where category is null and status = 'pending';

-- ── 4. Rating sanity, now that it is nullable ────────────────
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'reviews_rating_check'
  ) then
    alter table public.reviews
      add constraint reviews_rating_check
      check (rating is null or rating between 1 and 5);
  end if;
end $$;

-- ── 5. Keep the reviewer's own copy readable ──────────────────
-- The student needs to see what they submitted. The intake screen
-- reads back their own rows, so this policy must exist before the
-- button is wired up.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'reviews' and policyname = 'reviews_read_own'
  ) then
    create policy "reviews_read_own" on public.reviews
      for select using (auth.uid()::text = user_id);
  end if;
end $$;
