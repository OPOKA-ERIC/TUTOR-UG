-- =============================================
-- TutorUG — CLEAR ALL MEETINGS (Fresh Start)
-- Run in the Supabase SQL Editor.
--   1. Shows what exists right now (diagnostic)
--   2. Deletes EVERY meeting (cascades to
--      meeting_participants and meeting_invites)
--   3. Replaces ALL policies on meetings with the
--      correct ones, so nobody sees a meeting
--      unless they are its host or invited.
-- Safe to run multiple times.
-- =============================================

-- ── 1. DIAGNOSTIC: what is in the DB right now ─────────────────────
select 'MEETINGS IN DB' as info, count(*) from meetings;
select meeting_id, title, host_id, status, scheduled_at
from meetings order by created_at;
select 'POLICIES ON meetings' as info, policyname, cmd, qual
from pg_policies where tablename = 'meetings';
select 'USERS' as info, user_id, email from users;

-- ── 2. DELETE EVERYTHING ───────────────────────────────────────────
delete from meeting_invites;
delete from meeting_participants;
delete from meetings;

-- ── 3. RESET POLICIES (exactly two, nothing else) ──────────────────
-- Host can do anything to their own meetings.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='meetings'
  loop
    execute format('drop policy if exists %I on public.meetings', p.policyname);
  end loop;
end $$;

-- Invite lookup helper: SECURITY DEFINER so it bypasses meeting_invites RLS.
-- Without this the meetings_read policy recurses infinitely (42P17), because
-- meeting_invites has its own policy that queries meetings again.
create or replace function public.is_user_invited(p_meeting_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.meeting_invites mi
    where mi.meeting_id = p_meeting_id
      and (
        mi.user_id = auth.uid()::text
        or mi.email = (select email from public.users where user_id = auth.uid()::text)
      )
  );
$$;

grant execute on function public.is_user_invited(text) to anon, authenticated, service_role;

create policy "meetings_host_write" on meetings for all using (auth.uid()::text = host_id);

-- A meeting is only visible to its host and to anyone invited to it
-- (matched by user_id or email). This kills the old bug where EVERY
-- signed-in user could read everyone's meetings.
create policy "meetings_read" on meetings for select
  using (
    auth.uid()::text = host_id
    or public.is_user_invited(meeting_id)
  );

-- Host can delete participant rows for their meetings. Without this, ON
-- DELETE CASCADE from meetings fails: RLS blocks the cascade on rows owned
-- by other users, raising an FK error and leaving the meeting undeletable.
do $$ begin
  if not exists (select 1 from pg_policies where tablename='meeting_participants' and policyname='participants_host_delete') then
    create policy "participants_host_delete" on meeting_participants for delete
      using (exists (
        select 1 from meetings where meetings.meeting_id = meeting_participants.meeting_id
        and meetings.host_id = auth.uid()::text
      ));
  end if;
end $$;

-- ── 4. CONFIRM ─────────────────────────────────────────────────────
select 'MEETINGS REMAINING' as info, count(*) from meetings;
select 'POLICIES ON meetings NOW' as info, policyname, cmd
from pg_policies where tablename = 'meetings';