-- ============================================================
-- TutorUG — Super Admin + Reviews Migration
-- Run this in Supabase SQL Editor (safe to run multiple times)
--
-- Adds:
--   • users.role column               ('student' | 'admin')
--   • public.reviews table            (app ratings + feedback)
--   • auth.is_admin() helper function
--   • RLS so admins can read across tables while students stay isolated
-- ============================================================

-- ── 1. ROLE COLUMN ON USERS ────────────────────────────────
alter table public.users
  add column if not exists role text not null default 'student';

create index if not exists users_role_idx on public.users(role);

-- ── 2. AUTH HELPER: is current user an admin? ──────────────
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.users
    where user_id::text = auth.uid()::text
      and role = 'admin'
  );
$$;

-- ── 3. REVIEWS TABLE ───────────────────────────────────────
create table if not exists public.reviews (
    review_id   uuid        primary key default gen_random_uuid(),
    user_id     text        not null,   -- matches users.user_id (text in prod schema)
    rating      int         not null check (rating between 1 and 5),
    title       text        not null default '',
    comment     text        not null default '',
    status      text        not null default 'pending'
                            check (status in ('pending', 'approved', 'hidden')),
    created_at  timestamptz not null default now()
);

alter table public.reviews enable row level security;

-- index for admin listing (newest first)
create index if not exists reviews_created_idx on public.reviews(created_at desc);
create index if not exists reviews_status_idx  on public.reviews(status);
create index if not exists reviews_user_idx    on public.reviews(user_id);

-- ── 4. RLS POLICIES ────────────────────────────────────────
-- helpers to drop+recreate policies idempotently
do $$ begin
  drop policy if exists reviews_insert_own on public.reviews;
  drop policy if exists reviews_read_own    on public.reviews;
  drop policy if exists reviews_admin_all   on public.reviews;
  drop policy if exists users_admin_read    on public.users;
  drop policy if exists users_admin_update  on public.users;
  if to_regclass('public.chat_sessions') is not null then
    execute 'drop policy if exists "chat_sessions_admin_read" on public.chat_sessions';
  end if;
  if to_regclass('public.chat_messages') is not null then
    execute 'drop policy if exists "chat_messages_admin_read" on public.chat_messages';
  end if;
  if to_regclass('public.documents') is not null then
    execute 'drop policy if exists "documents_admin_read" on public.documents';
  end if;
  if to_regclass('public.document_sections') is not null then
    execute 'drop policy if exists "doc_sections_admin_read" on public.document_sections';
  end if;
  if to_regclass('public.quiz_results') is not null then
    execute 'drop policy if exists "quiz_results_admin_read" on public.quiz_results';
  end if;
  if to_regclass('public.user_settings') is not null then
    execute 'drop policy if exists "user_settings_admin_read" on public.user_settings';
  end if;
  if to_regclass('public.room_messages') is not null then
    execute 'drop policy if exists "room_messages_admin_mod" on public.room_messages';
  end if;
end $$;

-- REVIEWS: any signed-in user can insert their own review
create policy "reviews_insert_own" on public.reviews
  for insert with check (auth.uid()::text = user_id::text);

-- REVIEWS: users can read their own reviews (so they see "your review")
create policy "reviews_read_own" on public.reviews
  for select using (auth.uid()::text = user_id::text);

-- REVIEWS: admins manage everything
create policy "reviews_admin_all" on public.reviews
  for all using (public.is_admin());

-- ── 5. ADMIN READ-ACROSS TABLES ────────────────────────────
-- Admins can read every users' row. Students keep their own isolation.
create policy "users_admin_read" on public.users
  for select using (public.is_admin() or auth.uid()::text = user_id::text);

create policy "users_admin_update" on public.users
  for update using (public.is_admin())
  with check (public.is_admin());

-- Other tables only get admin policies if the table exists in this deployment
do $$ begin
  if to_regclass('public.chat_sessions') is not null then
    execute 'create policy "chat_sessions_admin_read" on public.chat_sessions
              for select using (public.is_admin() or auth.uid()::text = user_id::text)';
  end if;
  if to_regclass('public.chat_messages') is not null then
    execute 'create policy "chat_messages_admin_read" on public.chat_messages
              for select using (public.is_admin() or auth.uid()::text = user_id::text)';
  end if;
  if to_regclass('public.documents') is not null then
    execute 'create policy "documents_admin_read" on public.documents
              for select using (public.is_admin() or auth.uid()::text = user_id::text)';
  end if;
  if to_regclass('public.document_sections') is not null then
    execute 'create policy "doc_sections_admin_read" on public.document_sections
              for select using (public.is_admin() or auth.uid()::text = user_id::text)';
  end if;
  if to_regclass('public.quiz_results') is not null then
    execute 'create policy "quiz_results_admin_read" on public.quiz_results
              for select using (public.is_admin() or auth.uid()::text = user_id::text)';
  end if;
  if to_regclass('public.user_settings') is not null then
    execute 'create policy "user_settings_admin_read" on public.user_settings
              for select using (public.is_admin() or auth.uid()::text = user_id::text)';
  end if;
end $$;

-- ── 5b. MODERATION: admins can delete flagged room messages ──
do $$ begin
  if to_regclass('public.room_messages') is not null then
    execute 'create policy "room_messages_admin_mod" on public.room_messages
              for delete using (public.is_admin())';
  end if;
end $$;

-- ── 6. SEED INITIAL SUPER ADMIN ────────────────────────────
-- IMPORTANT: after creating your own Supabase auth account, run:
--   update public.users set role = 'admin' where email = 'YOUR_EMAIL';
-- The first admin must be set manually via the SQL editor since it
-- is a privileged action. Once one admin exists, that admin can
-- promote others from the dashboard.
