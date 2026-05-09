-- =============================================
-- TutorUG Supabase Database Setup
-- Run this in Supabase SQL Editor
-- =============================================

-- USERS TABLE
create table if not exists users (
  user_id text primary key,
  name text not null,
  email text not null,
  district text default '',
  region text default '',
  education_level text default '',
  school text default '',
  combination text default '',
  course text default '',
  profession text default '',
  avatar_url text default '',
  total_messages int default 0,
  total_quizzes int default 0,
  total_documents int default 0,
  streak_days int default 0,
  last_streak_date text default null,
  created_at text default now()::text,
  last_active text default now()::text
);

-- If table already exists, add missing columns (safe to run multiple times)
alter table users add column if not exists avatar_url text default '';
alter table users add column if not exists total_messages int default 0;
alter table users add column if not exists total_quizzes int default 0;
alter table users add column if not exists total_documents int default 0;
alter table users add column if not exists streak_days int default 0;
alter table users add column if not exists last_streak_date text default null;
alter table users add column if not exists region text default '';
alter table users add column if not exists combination text default '';
alter table users add column if not exists course text default '';
alter table users add column if not exists profession text default '';

-- CHAT SESSIONS TABLE
create table if not exists chat_sessions (
  session_id text primary key,
  user_id text not null references users(user_id),
  subject text default '',
  education_level text default '',
  title text default '',
  message_count int default 0,
  last_message_at text default now()::text,
  started_at text default now()::text
);

alter table chat_sessions add column if not exists title text default '';
alter table chat_sessions add column if not exists message_count int default 0;
alter table chat_sessions add column if not exists last_message_at text default now()::text;
alter table chat_sessions add column if not exists document_id text default null;
alter table chat_sessions add column if not exists section_index int default 0;
create index if not exists chat_sessions_document_idx on chat_sessions(document_id);
create index if not exists chat_sessions_user_idx on chat_sessions(user_id);

-- CHAT MESSAGES TABLE
create table if not exists chat_messages (
  message_id text primary key default gen_random_uuid()::text,
  session_id text not null references chat_sessions(session_id),
  user_id text not null references users(user_id),
  role text not null,
  content text not null,
  token_count int default 0,
  created_at text default now()::text
);

alter table chat_messages enable row level security;
create policy "chat_messages_own" on chat_messages
  for all using (auth.uid()::text = user_id);

create index if not exists chat_messages_session_idx on chat_messages(session_id);
create index if not exists chat_messages_user_idx on chat_messages(user_id);

-- DOCUMENTS TABLE
create table if not exists documents (
  document_id text primary key,
  user_id text not null references users(user_id),
  file_name text not null,
  storage_url text default '',
  subject text default '',
  uploaded_at bigint default extract(epoch from now()) * 1000,
  sections jsonb default '[]'::jsonb,
  overall_score int default 0,
  status text default 'processing'
);

-- QUIZ RESULTS TABLE
create table if not exists quiz_results (
  quiz_id text primary key,
  user_id text not null references users(user_id),
  document_id text default '',
  section text default '',
  score int default 0,
  passed boolean default false,
  timestamp bigint default extract(epoch from now()) * 1000
);

-- STUDY SESSION LOGS TABLE
create table if not exists study_session_logs (
  log_id         text primary key,
  user_id        text not null references users(user_id),
  entry_id       text not null,
  subject        text not null,
  day_of_week    int not null,
  scheduled_mins int default 0,
  attended_mins  int default 0,
  alarm_fired    boolean default false,
  date_str       text not null,   -- 'YYYY-MM-DD'
  created_at     text default now()::text,
  unique(user_id, entry_id, date_str)
);

alter table study_session_logs enable row level security;
create policy "session_logs_own" on study_session_logs
  for all using (auth.uid()::text = user_id);

create index if not exists session_logs_user_idx  on study_session_logs(user_id);
create index if not exists session_logs_entry_idx on study_session_logs(entry_id);
create index if not exists session_logs_date_idx  on study_session_logs(date_str);

-- TIMETABLE ENTRIES TABLE
create table if not exists timetable_entries (
  entry_id text primary key,
  user_id text not null references users(user_id),
  subject text not null,
  day_of_week int not null,   -- 1=Mon ... 7=Sun
  start_hour int not null,
  start_min int not null default 0,
  end_hour int not null,
  end_min int not null default 0,
  color_hex text default '#FFC107',
  created_at text default now()::text
);

alter table timetable_entries enable row level security;
create policy "timetable_own" on timetable_entries
  for all using (auth.uid()::text = user_id);

create index if not exists timetable_user_idx on timetable_entries(user_id);
create index if not exists timetable_day_idx on timetable_entries(day_of_week);

-- =============================================
-- ROW LEVEL SECURITY (RLS) — replaces Firestore rules
-- =============================================

alter table users enable row level security;
alter table chat_sessions enable row level security;
alter table documents enable row level security;
alter table quiz_results enable row level security;

-- Users: can only read/write their own profile
create policy "users_own" on users
  for all using (auth.uid()::text = user_id);

-- Chat sessions: can only access their own sessions
create policy "chat_sessions_own" on chat_sessions
  for all using (auth.uid()::text = user_id);

-- Documents: can only access their own documents
create policy "documents_own" on documents
  for all using (auth.uid()::text = user_id);

-- Quiz results: can only access their own results
create policy "quiz_results_own" on quiz_results
  for all using (auth.uid()::text = user_id);

-- =============================================
-- STORAGE BUCKET
-- =============================================

-- Run this to create the documents storage bucket
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict do nothing;

-- Storage policy: users can only access their own folder
create policy "storage_own" on storage.objects
  for all using (
    bucket_id = 'documents' and
    auth.uid()::text = (storage.foldername(name))[2]
  );

-- Avatars bucket (public read so profile pictures load without auth)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict do nothing;

create policy "avatars_upload" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_read" on storage.objects
  for select using (bucket_id = 'avatars');
