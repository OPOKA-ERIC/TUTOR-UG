# TutorUG Meetings Feature — Changes Summary & Continuation Prompt

**Date:** September 9 + 11 + 12, 2026
**Session Focus:** Meetings overhaul + join experience + RLS create/read bugs (now all fixed)

---

## SEPT 12 SESSION — Create Meeting Broken: ROOT CAUSE Found & Fixed ✅

### Symptom (from user)
- Old "already deleted" meetings kept showing on everyone's page.
- After running the wipe SQL, **Create stopped working**: tap Save → nothing happens, the screen just keeps refreshing. No error on screen (mobile used to silently ignore the response).

### Investigation trail (all against the LIVE Supabase DB, via throwaway Node scripts)
1. First insert failure: **FK 23503** `meetings_host_id_fkey` — because `meetings.host_id → users.user_id`, and the user's email had no row in `public.users`. DB was healthy; the *account* was the problem.
2. Full create path verified working end-to-end with a throwaway account: `users` row insert ✅ → `meetings` insert ✅ → edge function `create-meeting` **200 with clean Jitsi URL** ✅ → cleanup delete ✅. Backend + edge functions were healthy.
3. **ROOT CAUSE finally found:** **Infinite recursion (Postgres error 42P17)** in meetings RLS.
   - Old `meetings_read` policy checked `meeting_invites` via a raw subquery.
   - `meeting_invites` table has its own policy (`invites_host_manage`) that queries `meetings` **again** → cycle.
   - Result: PostgREST rejected **EVERY** `SELECT` on `meetings` with `SELECT could not be executed ... infinite recursion detected in policy for relation "meetings"`.
   - Writes still worked (separate policy), which is exactly why *"create saves but the list never updates"*.
4. **Second (mobile-only) bug:** PostgREST `in.(...)` filters used **quoted values** — `status=in.("scheduled","live")`, `status=in.("pending","accepted")`, quoted id lists. PostgREST takes the quotes literally → **always empty results**. Unquoted them → `in.(scheduled,live)` etc.

### The fix (user ran this SQL in the Supabase SQL Editor — **LIVE on DB now**)
- New helper function runs as the table owner (`SECURITY DEFINER`), so it bypasses `meeting_invites` RLS while doing the invite lookup → **breaks the recursion**:
```sql
create or replace function public.is_user_invited(p_meeting_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.meeting_invites mi
    where mi.meeting_id = p_meeting_id
      and ( mi.user_id = auth.uid()::text
            or mi.email = (select email from public.users where user_id = auth.uid()::text) )
  );
$$;
grant execute on function public.is_user_invited(text) to anon, authenticated, service_role;

drop policy if exists "meetings_read" on meetings;
create policy "meetings_read" on meetings for select
  using ( auth.uid()::text = host_id or public.is_user_invited(meeting_id) );
```
- Same fix written into `supabase/features_migration.sql` **and** `supabase/clear_meetings.sql`.

### Other code changes (committed as `d7f6279`, pushed)
- **`MeetingRepository.kt`**: `createMeeting` now **throws** with the HTTP code + response body instead of silently swallowing → failures surface as toast messages. In-list filters unquoted. `loadInvitedMeetings` matches by **user_id OR email** (invites to a not-yet-registered address show up once that email signs in). `sendInvites` calls the edge function directly.
- **`FeatInvited badge` on cards** (mobile + web) and invite polling every 15 s so new invites "pop in" without reopening the screen.
- **`clear_meetings.sql`** rewritten as a fully self-contained reset script: drops ALL meetings policies via `DO ... pg_policies`, deletes every meeting (cascades to participants + invites), recreates exactly 2 policies (`meetings_host_write`, `meetings_read` via helper) + `participants_host_delete`.
- **Added `participants_host_delete` policy** so meeting-delete cascades don't fail on `meeting_participants` under RLS.
- `supabase/functions/invite-to-meeting/` edge function is now tracked in git.
- Temp diagnostic scripts (`web/tutorug-repro.cjs`, `web/tutorug-query-test.cjs`, etc.) created this session were **deleted, not committed**.

### Repo sync with the team
- Pulled 3 teammate commits — **zero conflicts**: `52f4efa` (unified auth screens w/ Baloo2 gold/kitenge design), `3e50a6c` (chat sidebar + history modal redesign), `ec14e87` (chat & admin features). Local was behind `origin/main`; fast-forwarded cleanly, then pushed `d7f6279` on top.

### Verified after the fix
- Anonymous `SELECT` from `meetings` now returns `[]` instead of the 42P17 error → recursion **gone**.
- Rebuilt `app-debug.apk` (56.9 MB) via `gradlew :app:assembleDebug` — **shared with user + colleagues for field testing**.

### Build command that works
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat :app:assembleDebug --console=plain
```
APK → `mobile\app\build\outputs\apk\debug\app-debug.apk`

### Open items / next steps
1. **User to test on the new APK**: create a meeting → should appear in the list instantly; invite a colleague → invite pops in within ~15 s; delete → gone everywhere.
2. **Colleagues' reports** to collect once they're on the new APK.
3. If create still errors for some account, check that a `public.users` row exists for that email (`INSERT ... ON CONFLICT DO NOTHING`) — FK 23503, not RLS.
4. Clean up: the RLS recursion fix should NOT be re-introduced by re-running old SQL that embeds the inline `meetings_read`; always use `public.is_user_invited(...)`.

---

## SEPT 11 SESSION — Meeting Join: Fixed & Working ✅

### Root cause: meet.jit.si bans embedding
The mobile app loaded meetings inside an **in-app WebView**, which Jitsi classifies as **"embedding"**. Since 2023, meet.jit.si restricts embedded sessions: calls auto-disconnect after **5 minutes**, anonymous users get forced into a **"wait for a moderator / please login"** screen, and Google/GitHub OAuth opens a **blank page** inside a WebView. No URL flag fixes this — it is deliberate policy.

Symptom chain that misled us along the way:
1. Jitsi mobile interstitial ("Join in app / Join in browser").
2. Jitsi moderator-login trap + broken OAuth in WebView.
3. A Daily.co **"missing payment method"** wall — because a `DAILY_API_KEY` was set; Daily.co's free tier *creates* rooms but *blocks joining calls* until a card is on file.

### What we changed (all committed + pushed to origin/main)
1. **Mobile: meetings now open in the phone's external browser** (Android Intent `ACTION_VIEW`) instead of the in-app WebView → **not embedding** → unlimited free calls, first-joiner auto-becomes moderator, real Google/GitHub login works. Join screen replaced with a "Meeting opened in your browser" screen with **Reopen** + **Leave** (`MeetingsScreen.kt`).
2. **`create-meeting` (Supabase edge function + Express backend)**:
   - Jitsi fallback URL carries clean auto-join config: `prejoinPageEnabled=false`, `requireDisplayName=false`, `disableDeepLinking=true`.
   - `max_participants` 50 → 10 (Daily.co free plan rejects >10).
   - Graceful fallback to Jitsi whenever Daily.co fails.
   - Daily.co used only when `DAILY_API_KEY` is set.
3. **`DAILY_API_KEY` cleared on Supabase** — meetings stay on free Jitsi (no card required).
4. **DB backfill** — existing `meetings.room_url` rows (bare Jitsi or Daily URLs) normalized to the clean Jitsi auto-join links.
5. **Mobile repository hardening** (`MeetingRepository.kt`): never falls back to a `tutorug.daily.co` URL; fake `host_x`/`join_x` tokens removed; display name injected into Jitsi fragment links.
6. **Edge function deployed + verified live** (returns clean Jitsi URL with empty tokens).

### Known free-server quirk (by design)
The **first person to join a room is the moderator**. Host should tap **Join first**, then participants follow.

### Upgrades for later (when revenue exists)
- **JaaS** (Jitsi as a Service, ~free 25 endpoints/mo) or **self-hosted Jitsi** → in-app meetings, branding, no moderator dependency.
- **Paid Daily.co plan** (a card unlocks it) → clean one-tap calls via the WebView path we already built.
- Do **not** go back to an in-app WebView on free meet.jit.si.

---

## WHAT WE DID THIS SESSION (Sept 9)

### 1. Delete Meetings (NEW)
- Added a delete button (trash icon) on every meeting card — **host only**
- Deleting a meeting cascades to delete all `meeting_participants` and `meeting_invites` records
- Web: Trash icon on active cards + delete button on ended cards
- Mobile: Red delete icon in the top-right of each card
- Confirmation dialog before deleting

### 2. Invite-Only Meetings (NEW)
- **New database table:** `meeting_invites` (id, meeting_id, email, user_id, status, invited_at)
- **New backend route:** `POST /api/invite-to-meeting` — looks up users by email, stores invites, sends HTML email notification via Resend
- **New backend route:** `POST /api/respond-invite` — accept or refuse an invite
- **New email template:** `buildMeetingInviteEmail` in `backend/src/utils/email.js`
- Host can invite people by entering their email addresses (comma-separated) in the create form or via an "Invite" button on the meeting card
- Invited people receive an email notification with meeting details
- Invited meetings appear in a separate "Invited to" section for non-hosts
- Host can view invited people and their status (pending/accepted/refused) on each card

### 3. Calendar Date Picker (Mobile — FIXED)
- Replaced the raw text input (`YYYY-MM-DDTHH:MM` placeholder) with a **native Android DatePickerDialog + TimePickerDialog**
- Tap the field → calendar opens → pick date → time picker opens → pick time → auto-formatted
- Web already had `datetime-local` input, so no change needed there

### 4. Direct Meeting Join — No Re-login (FIXED)
- **Daily.co tokens** now include `user_name` property (in both Edge Function and Express backend)
- **Jitsi fallback** URL now includes `#config.displayName="Name"&config.prejoinPageEnabled=false`
- **Mobile WebView** passes `userName` as query param: `?t=token&userName=Name`
- When you click Join, your name is baked into the token/URL — Daily.co/Jitsi knows who you are immediately, no re-login prompt

### 5. Join Approval System (NEW)
- **`meeting_participants` table** now has a `status` column: `pending` | `approved` | `refused`
- **Non-host join flow:** Click "Join" → request goes to `pending` → host sees "Pending Approval" with approve (checkmark) / refuse (X) buttons → once approved, participant gets the join token and can enter
- **Realtime updates:** Web subscribes to participant INSERT/UPDATE events — shows toast notifications for new requests and status changes
- Host gets realtime notification when someone requests to join

### 6. Database Migration Updates (`features_migration.sql`)
- Added `host_name` column to `meetings` table
- Added `status` column to `meeting_participants` table
- New `meeting_invites` table with full RLS policies
- Added RLS policies for host to read/update participant records
- Added Realtime publication for `meeting_invites`

### 7. Build Fix
- Downgraded Gradle from 9.0.0 → 8.7 (9.0.0 was failing to download)
- Generated missing `gradlew`, `gradlew.bat`, `gradle-wrapper.jar` from another project
- Fixed BOTH wrapper properties files (root + mobile/)

---

## FILES MODIFIED

| File | What changed |
|---|---|
| `supabase/features_migration.sql` | New `meeting_invites` table, `status` column on participants, `host_name` on meetings, new RLS policies, Realtime |
| `backend/src/utils/email.js` | New `buildMeetingInviteEmail` HTML template |
| `backend/src/routes/invite-to-meeting.js` | **NEW FILE** — invite by email endpoint |
| `backend/src/routes/respond-invite.js` | **NEW FILE** — accept/refuse invite endpoint |
| `backend/src/server.js` | Mounted 2 new routes (`/api/invite-to-meeting`, `/api/respond-invite`) |
| `supabase/functions/create-meeting/index.ts` | Accepts `userName`, passes to Daily.co tokens + Jitsi URL with `prejoinPageEnabled=false` |
| `backend/src/routes/create-meeting.js` | Same `userName` support + Jitsi config fix |
| `web/src/types/index.ts` | Added `MeetingInvite` interface, `status` field on `MeetingParticipant` |
| `web/src/pages/MeetingsPage.tsx` | Full rewrite: delete, invite, approval UI, invited meetings section, realtime subscriptions, pass userName on join |
| `mobile/.../data/model/Models.kt` | Added `MeetingParticipant`, `MeetingInvite` data classes; added `hostName` to `Meeting` |
| `mobile/.../data/repository/MeetingRepository.kt` | Added `deleteMeeting`, `sendInvites`, `approveParticipant`, `refuseParticipant`, `loadInvites`, `loadInvitedMeetings`, `requestJoin`, `loadParticipants` |
| `mobile/.../viewmodel/MeetingViewModel.kt` | Added `deleteMeeting`, `approveParticipant`, `refuseParticipant`, `sendInvites`, `loadInvites`, `join` with approval flow, `joinApproved` |
| `mobile/.../ui/screens/MeetingsScreen.kt` | Full rewrite: delete button, calendar date picker, invite form, participant approval UI, toast messages, invited meetings section |
| `mobile/gradle/wrapper/gradle-wrapper.properties` | Gradle 9.0.0 → 8.7 |
| `gradle/wrapper/gradle-wrapper.properties` (root) | Gradle 9.0.0 → 8.7 |
| `mobile/gradlew`, `mobile/gradlew.bat`, `mobile/gradle/wrapper/gradle-wrapper.jar` | Generated/copied from another project |

---

## SQL TO RUN IN SUPABASE

Run the updated `supabase/features_migration.sql` in your Supabase SQL Editor. It's safe to run multiple times (uses `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`).

---

## CONTINUATION PROMPT FOR NEXT SESSION

Copy and paste this prompt into a new opencode session:

---

I'm working on the TutorUG_App project at D:\MY LIFE\SOFTWARE PROJECTS\TutorUG_App. This is an AI-powered education platform for Ugandan students built with Kotlin/Jetpack Compose (Android), React/TypeScript (web), Express.js (backend), Supabase (DB/auth), and Anthropic Claude (AI).

State as of the **Sept 12 session** (all committed + pushed to origin/main, commit `d7f6279`):

1. **ROOT CAUSE FOUND for "Create meeting does nothing": infinite recursion (42P17)** — the old `meetings_read` policy subqueried `meeting_invites`, whose own policy queried `meetings` back. Every SELECT on `meetings` failed; writes still worked. FIXED on the live DB and in `features_migration.sql` + `clear_meetings.sql` via a `SECURITY DEFINER` helper `public.is_user_invited(p_meeting_id text)` that bypasses `meeting_invites` RLS. The `meetings_read` policy is now: `auth.uid()::text = host_id or public.is_user_invited(meeting_id)`.
2. **Mobile PostgREST in-list filters unquoted** — `in.("scheduled","live")` → `in.(scheduled,live)` (PostgREST treats quotes literally).
3. **`MeetingRepository.createMeeting` now throws** on non-2xx responses so failures surface as toasts (was silently swallowed). Let me diagnose from the toast message if a user reports a failure.
4. **`clear_meetings.sql`** is a self-contained reset script (drops all meetings policies, deletes all rows, recreates exactly 2 policies + helper). `participants_host_delete` policy added so delete cascades work under RLS.
5. **Repo sync**: pulled 3 teammate commits (auth redesign + chat sidebar/history + chat/admin features) with zero conflicts; I pushed `d7f6279` (meeting fixes). Temp `.cjs` diagnostic scripts were deleted, not committed.
6. **Verified live**: anonymous `SELECT` from `meetings` returns `[]` (no more 42P17). Fresh `app-debug.apk` (56.9 MB) built and shared for field testing.
7. If some account still can't create: check a `public.users` row exists for the email (FK 23503 on `host_id`), not an RLS issue.

Next steps to pick up:
- Collect results of the field test of `app-debug.apk` (create → appears in list, invites pop-in in ~15 s, delete cascades).
- Fix any create errors reported via the new toast messages.
- Do NOT re-introduce the inline recursive `meetings_read`; always use `public.is_user_invited(...)`.

Please continue helping me with this project. What would you like to work on next?
