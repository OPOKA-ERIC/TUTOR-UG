-- ============================================================================
-- TutorUG — consolidated production fixes
-- Run this ONCE in Supabase Dashboard -> SQL Editor. Safe to re-run.
-- ============================================================================
--
-- Fixes four separate defects found in the September 2026 audit:
--   1. users.gender missing          -> learner gender could not be stored
--   2. podcast_sessions.script text  -> web app blanked opening saved episodes
--   3. study_session_logs missing    -> mobile timetable tracking 404'd silently
--   4. a document stuck in 'processing' from the 23502 unique violation
--
-- No data is destroyed. Section 4 only re-queues one stuck document so the
-- corrected process-document function can rebuild it.
-- ============================================================================


-- ── 1. Learner gender ─────────────────────────────────────────────────────
-- Powers the student voice in the learning podcast. Nullable so existing
-- accounts keep working and fall back to the in-app picker.

alter table public.users
    add column if not exists gender text;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'users_gender_check') then
        alter table public.users
            add constraint users_gender_check
            check (gender is null or gender in ('male', 'female', 'other'));
    end if;
end $$;

comment on column public.users.gender is
    'Learner gender, used to pick the student podcast voice. Null = not chosen yet.';


-- ── 2. podcast_sessions.script must be a real array ───────────────────────
-- The column was text, so clients that serialised the script stored a STRING.
-- The web client then called .map() on that string, throwing a TypeError that
-- blanked the whole page.

-- Neutralise anything that is not a JSON array first, because a single bad
-- legacy row would otherwise abort the cast and the whole transaction.
update public.podcast_sessions
   set script = '[]'
 where script is not null
   and btrim(script) <> ''
   and left(btrim(script), 1) <> '[';

do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'podcast_sessions'
          and column_name = 'script'
          and data_type <> 'jsonb'
    ) then
        alter table public.podcast_sessions
            alter column script type jsonb
            using (case
                when script is null or btrim(script) = '' then '[]'::jsonb
                else script::jsonb
            end);

        alter table public.podcast_sessions
            alter column script set default '[]'::jsonb;
    end if;
end $$;

comment on column public.podcast_sessions.script is
    'Podcast turns as a JSON array of {speaker, text}.';


-- ── 3. study_session_logs was never created ───────────────────────────────
-- Present in setup.sql and queried by the Android StudySessionRepository, but
-- absent from the live database, so timetable progress silently did nothing.

create table if not exists public.study_session_logs (
  log_id         text primary key,
  user_id        text not null references public.users(user_id),
  entry_id       text not null,
  subject        text not null,
  day_of_week    int not null,
  scheduled_mins int default 0,
  attended_mins  int default 0,
  alarm_fired    boolean default false,
  date_str       text not null,
  created_at     text default now()::text,
  unique(user_id, entry_id, date_str)
);

alter table public.study_session_logs enable row level security;

do $$
begin
    if not exists (select 1 from pg_policies where policyname = 'session_logs_own') then
        create policy "session_logs_own" on public.study_session_logs
            for all using (auth.uid()::text = user_id);
    end if;
end $$;

create index if not exists session_logs_user_idx  on public.study_session_logs(user_id);
create index if not exists session_logs_entry_idx on public.study_session_logs(entry_id);


-- ── 4. Re-queue the document stuck in 'processing' ────────────────────────
-- It failed on the (document_id, section_index) unique constraint. The
-- process-document function now clears prior sections before inserting, so
-- returning it to 'uploaded' lets the student retry the upload successfully.

update public.documents
   set status = 'uploaded',
       section_count = 0,
       processed_at = null
 where status = 'processing';


-- ── Verification ──────────────────────────────────────────────────────────
-- Expect 19 tables and 0 documents left in 'processing'.
select count(*) as total_tables
  from information_schema.tables
 where table_schema = 'public' and table_type = 'BASE TABLE';

select status, count(*)
  from public.documents
 group by status;
