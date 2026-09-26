# TutorUG — Setup Guide (Supabase)

> Superseded the old Firebase setup. There is no `firebase.json`, no
> `firestore.rules`, and no `google-services.json` in this project. Auth,
> database and storage are all **Supabase**. For the short version see the
> root `README.md`.

---

## Step 1 — Create the Supabase project

1. Go to https://supabase.com/dashboard and create a project.
2. Note the **project ref** (TutorUG's live ref is `jsjhgwficdrgzwbwzkhm`).
3. **Authentication → Sign In / Providers → Email** — enable Email/Password.

---

## Step 2 — Run the database scripts

Open **SQL Editor → New query** and run these in order. Each is written to be
re-runnable (`if not exists`, `add column if not exists`).

1. `supabase/setup.sql` — users, chat, documents, quizzes, timetable, RLS
2. `supabase/features_migration.sql` — meetings, invites, study rooms, podcasts
3. `supabase/security_migration.sql` — rate limits + admin helper functions
4. `supabase/admin_migration.sql` — `users.role`, `is_admin()`, `reviews`

Each should return "Success. No rows returned".

> Skip `supabase_migration.sql` in the repo root — it is an older parallel
> schema that overlaps `supabase/setup.sql`.

To wipe and rebuild meetings only, run `supabase/clear_meetings.sql`. It is
self-contained: it drops every `meetings` policy, deletes all meetings
(cascading to participants and invites), then recreates exactly two policies.

---

## Step 3 — Set the edge function secrets

**Project Settings → Edge Functions → Secrets → Add new secret**

| Name | Value | Required |
|---|---|---|
| `ANTHROPIC_KEY` | `sk-ant-...` from https://console.anthropic.com | ✅ all AI features |
| `SUPABASE_SERVICE_ROLE_KEY` | from Project Settings → API | ✅ document parsing, invites, OTP |
| `RESEND_API_KEY` | `re_...` from https://resend.com | ✅ password reset, invites |
| `FROM_EMAIL` | a verified Resend sender | ✅ password reset, invites |
| `DAILY_API_KEY` | Daily.co key | ❌ leave unset — meetings use free Jitsi |

Without `ANTHROPIC_KEY` every AI feature (chat, quiz, podcast, moderation,
document processing) fails.

---

## Step 4 — Deploy the edge functions

Double-click `deploy-functions.bat` in the project root, or run individually:

```powershell
.\supabase functions deploy send-chat-message
.\supabase functions deploy generate-quiz
.\supabase functions deploy generate-podcast
.\supabase functions deploy moderate-message
.\supabase functions deploy process-document
.\supabase functions deploy create-meeting
.\supabase functions deploy invite-to-meeting
.\supabase functions deploy send-reminder
.\supabase functions deploy send-otp --no-verify-jwt
.\supabase functions deploy verify-otp --no-verify-jwt
.\supabase functions deploy reset-password --no-verify-jwt
```

The AI and meeting functions keep JWT verification on. The three
password-reset functions must be deployed with `--no-verify-jwt` because a
signed-out user has no JWT to send.

---

## Step 5 — Point the clients at your project

**Android** — `mobile/app/src/main/java/com/tutorug/app/data/remote/SupabaseClient.kt`:
set `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

**Web** — `web/.env`:
```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_API_BASE_URL=https://<your-api-host>/api
```
`VITE_API_BASE_URL` is only used for the non-AI Express routes (data export,
account deletion, invite responses). AI calls go straight to Supabase.

**Express backend** — `backend/.env` (see `backend/.env.example`):
`ANTHROPIC_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
`FROM_EMAIL`, `DAILY_API_KEY`. Empty values here mean the local Express server
returns 500 on any AI or email route.

---

## Step 6 — Build & run

### Android
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat :app:assembleDebug --console=plain
```
APK → `mobile\app\build\outputs\apk\debug\app-debug.apk`

Then open the project in Android Studio, pick a device or the Pixel 6
emulator, and press Run.

### Web
```bash
cd web
npm install
npm run dev     # http://localhost:5173
```

---

## Testing the app

1. **Register** — e.g. Akello, `akello@test.com` / `test1234`, district Gulu,
   level S3.
2. **Chat** — pick Mathematics, ask "Explain profit and loss". The answer uses
   Gulu Main Market and UGX.
3. **Voice** — tap the mic, ask a question, listen to the reply.
4. **Document** — upload a PDF or photo of handwritten notes, pick a subject,
   then work through the generated sections and quiz.
5. **Meetings** — create one, invite a colleague by email, join. The URL opens
   in your external browser, not a WebView (Jitsi blocks embedded sessions).

---

## Troubleshooting

**Build fails**
- Confirm JDK 17+ is active (`$env:JATH_HOME`).
- `./gradlew.bat clean` then rebuild.
- If opening in Android Studio misbehaves, note that `mobile/` is a complete
  standalone Gradle project and the repo root also maps `:app` to
  `mobile/app`. Prefer building from the repo root.

**AI features fail / chat spins**
- `ANTHROPIC_KEY` secret set?
- Check the function logs: Supabase → Edge Functions → Logs.
- Confirm the function was deployed *with* JWT verification and that the
  client is sending a valid access token.

**Password reset fails with 401**
- `send-otp`, `verify-otp` and `reset-password` must be deployed with
  `--no-verify-jwt`.

**Study rooms / meetings empty**
- `supabase/features_migration.sql` was not run, or was run before
  `setup.sql`.

**Voice not working**
- Grant the microphone permission.
- Confirm Google Text-to-Speech is installed on the device.

**"Timetable table not set up"**
- `supabase/setup.sql` was not run, or predates the `timetable_entries` table.

---

© 2025 TutorUG
