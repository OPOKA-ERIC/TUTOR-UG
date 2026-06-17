-- =============================================
-- TutorUG COMPLETE MIGRATION — Run this in Supabase SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS / ON CONFLICT DO NOTHING)
-- =============================================

-- ── MEETINGS ─────────────────────────────────────────────────────────────────
create table if not exists meetings (
  meeting_id   text primary key,
  host_id      text not null references users(user_id),
  title        text not null,
  subject      text default '',
  description  text default '',
  room_url     text default '',
  room_token   text default '',
  scheduled_at text not null,
  duration_mins int default 60,
  status       text default 'scheduled',
  created_at   text default now()::text
);

alter table meetings enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='meetings' and policyname='meetings_read') then
    create policy "meetings_read" on meetings for select using (auth.uid() is not null);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='meetings' and policyname='meetings_host_write') then
    create policy "meetings_host_write" on meetings for all using (auth.uid()::text = host_id);
  end if;
end $$;

create index if not exists meetings_status_idx on meetings(status);
create index if not exists meetings_scheduled_idx on meetings(scheduled_at);

-- ── MEETING PARTICIPANTS ──────────────────────────────────────────────────────
create table if not exists meeting_participants (
  id           text primary key default gen_random_uuid()::text,
  meeting_id   text not null references meetings(meeting_id) on delete cascade,
  user_id      text not null references users(user_id),
  join_token   text default '',
  joined_at    text default now()::text,
  unique(meeting_id, user_id)
);

alter table meeting_participants enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='meeting_participants' and policyname='participants_own') then
    create policy "participants_own" on meeting_participants for all using (auth.uid()::text = user_id);
  end if;
end $$;

-- ── STUDY ROOMS ───────────────────────────────────────────────────────────────
create table if not exists study_rooms (
  room_id       text primary key,
  subject       text not null,
  education_level text default '',
  description   text default '',
  member_count  int default 0,
  created_at    text default now()::text
);

alter table study_rooms enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='study_rooms' and policyname='rooms_read_all') then
    create policy "rooms_read_all" on study_rooms for select using (auth.uid() is not null);
  end if;
end $$;

-- Pre-seed rooms (safe to run multiple times)
insert into study_rooms (room_id, subject, education_level, description) values
  ('room-math-olevel',    'Mathematics',        'O-Level',      'O-Level Mathematics discussion'),
  ('room-english-olevel', 'English Language',   'O-Level',      'O-Level English discussion'),
  ('room-biology',        'Biology',            'O-Level',      'Biology concepts and questions'),
  ('room-chemistry',      'Chemistry',          'O-Level',      'Chemistry problems and concepts'),
  ('room-physics',        'Physics',            'O-Level',       'Physics concepts and problems'),
  ('room-math-alevel',    'Mathematics',        'A-Level',      'A-Level Mathematics discussion'),
  ('room-economics',      'Economics',          'A-Level',      'Economics discussion'),
  ('room-history',        'History',            'A-Level',      'History and social studies'),
  ('room-university',     'University General', 'University',   'University students discussion'),
  ('room-professional',   'Professional Skills','Professional', 'Professional development chat'),
  ('room-general',        'General Studies',    '',             'General academic discussion')
on conflict (room_id) do nothing;

-- ── ROOM MESSAGES ─────────────────────────────────────────────────────────────
create table if not exists room_messages (
  message_id   text primary key default gen_random_uuid()::text,
  room_id      text not null references study_rooms(room_id),
  user_id      text not null references users(user_id),
  user_name    text not null default '',
  user_avatar  text default '',
  content      text not null,
  flagged      boolean default false,
  created_at   text default now()::text
);

alter table room_messages enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='room_messages' and policyname='room_messages_read') then
    create policy "room_messages_read" on room_messages for select using (auth.uid() is not null);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='room_messages' and policyname='room_messages_insert') then
    create policy "room_messages_insert" on room_messages for insert with check (auth.uid()::text = user_id);
  end if;
end $$;

create index if not exists room_messages_room_idx on room_messages(room_id);
create index if not exists room_messages_created_idx on room_messages(created_at);

-- Enable Realtime for live chat
alter publication supabase_realtime add table room_messages;

-- ── PODCAST SESSIONS ──────────────────────────────────────────────────────────
create table if not exists podcast_sessions (
  podcast_id    text primary key,
  user_id       text not null references users(user_id),
  topic         text not null,
  subject       text default '',
  education_level text default '',
  script        jsonb default '[]'::jsonb,
  duration_secs int default 0,
  created_at    text default now()::text
);

alter table podcast_sessions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='podcast_sessions' and policyname='podcasts_own') then
    create policy "podcasts_own" on podcast_sessions for all using (auth.uid()::text = user_id);
  end if;
end $$;

create index if not exists podcasts_user_idx on podcast_sessions(user_id);
