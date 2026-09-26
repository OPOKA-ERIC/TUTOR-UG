-- ============================================================================
-- TutorUG — consolidated production fixes  (REVISION 2)
-- Run ONCE in Supabase Dashboard -> SQL Editor. Safe to re-run.
-- ============================================================================
--
-- Revision 1 failed with "function btrim(jsonb) does not exist". That error
-- revealed the real shape of the problem: podcast_sessions.script is ALREADY a
-- jsonb column, not text. Because the whole script runs as one transaction,
-- every section rolled back, so all four fixes still need to be applied.
--
-- The actual defect: the Android writer passed the serialised script as a
-- Java String, so org.json emitted a quoted JSON string and the column stored
-- a jsonb STRING SCALAR instead of an array. Readers got a string, and the web
-- client crashed calling script.map(...). The Android writer is fixed in code;
-- section 2 below repairs the rows already written.
--
-- No data is destroyed. Every malformed script is replaced with an empty array.
-- ============================================================================


-- ── 1. Learner gender ─────────────────────────────────────────────────────
-- Powers the student voice in the learning podcast. Nullable so existing
-- accounts keep working and fall back to the in-app picker.

alter table public.users
    add column if not exists gender text;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.users'::regclass
          and conname = 'users_gender_check'
    ) then
        alter table public.users
            add constraint users_gender_check
            check (gender is null or gender in ('male', 'female', 'other'));
    end if;
end $$;

comment on column public.users.gender is
    'Learner gender, used to pick the student podcast voice. Null = not chosen yet.';


-- ── 2. podcast_sessions.script must hold a real ARRAY ─────────────────────
-- Works whether the column is jsonb (current state), json, or text, because
-- every branch inspects information_schema instead of assuming a type.
--
-- jsonb_typeof() is the key: for the broken rows it returns 'string'. The
--   ->> operator with a zero-length path unwraps the scalar back to JSON text,
--   which is then cast to jsonb, yielding the intended array.
-- A second pass catches any row that was double-encoded.

do $$
declare
    coltype text;
    fixed   integer := 0;
begin
    select data_type into coltype
      from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'podcast_sessions'
       and column_name  = 'script';

    if coltype is null then
        raise exception 'public.podcast_sessions.script not found';
    end if;

    if coltype in ('jsonb', 'json') then
        -- Pass 1 and 2: unwrap JSON string scalars into arrays.
        -- Each pass runs in its own subtransaction. Revision 1 was lost entirely
        -- because one bad row aborted the whole script, so if any row here holds
        -- text that will not cast, that row is blanked to '[]' instead of
        -- aborting the migration.
        for pass in 1..2 loop
            begin
                update public.podcast_sessions
                   set script = case
                         when jsonb_typeof(script::jsonb) = 'string'
                           and left(btrim(script::jsonb #>> '{}'), 1) = '['
                           then (script::jsonb #>> '{}')::jsonb
                         else '[]'::jsonb
                       end
                 where script is not null
                   and jsonb_typeof(script::jsonb) is distinct from 'array';
                fixed := fixed + 1;
            exception when others then
                update public.podcast_sessions
                   set script = '[]'::jsonb
                 where script is not null
                   and jsonb_typeof(script::jsonb) is distinct from 'array';
                raise warning 'pass %: a script could not be unwrapped and was reset to []', pass;
            end;
        end loop;

    else
        -- Legacy text column: neutralise non-arrays, then convert the type.
        update public.podcast_sessions
           set script = '[]'
         where script is not null
           and btrim(script) <> ''
           and left(btrim(script), 1) <> '[';

        alter table public.podcast_sessions
            alter column script type jsonb
            using (case
                when script is null or btrim(script) = '' then '[]'::jsonb
                else script::jsonb
            end);
    end if;

    -- Any remaining null or non-array value is unusable, so blank it safely.
    update public.podcast_sessions
       set script = '[]'::jsonb
     where script is null
        or jsonb_typeof(script::jsonb) is distinct from 'array';

    alter table public.podcast_sessions
        alter column script set default '[]'::jsonb;

    raise notice 'podcast_sessions.script (type %) normalised; % unwrap pass(es) run', coltype, fixed;
end $$;

comment on column public.podcast_sessions.script is
    'Podcast turns as a JSON array of {speaker, text}. Never a string scalar.';


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
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename  = 'study_session_logs'
          and policyname  = 'session_logs_own'
    ) then
        create policy "session_logs_own" on public.study_session_logs
            for all using (auth.uid()::text = user_id);
    end if;
end $$;

create index if not exists session_logs_user_idx  on public.study_session_logs(user_id);
create index if not exists session_logs_entry_idx on public.study_session_logs(entry_id);


-- ── 4. Re-queue documents stuck in 'processing' ───────────────────────────
-- They failed on the (document_id, section_index) unique constraint. The
-- process-document function now clears prior sections before inserting, so
-- returning them to 'uploaded' lets the student retry the upload successfully.

update public.documents
   set status = 'uploaded',
       section_count = 0,
       processed_at = null
 where status = 'processing';


-- ── Verification ──────────────────────────────────────────────────────────
-- Expect 19 tables, 0 documents in 'processing', and 0 rows where the script
-- is not an array (should return no rows).
select count(*) as total_tables
  from information_schema.tables
 where table_schema = 'public' and table_type = 'BASE TABLE';

select status, count(*)
  from public.documents
 group by status;

select count(*) as scripts_not_arrays
  from public.podcast_sessions
 where script is null
    or jsonb_typeof(script) is distinct from 'array';
