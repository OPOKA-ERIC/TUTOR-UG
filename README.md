# TutorUG — Uganda's Smart Learning Companion

AI-Powered Localized Education Platform for Uganda
**Primary • Secondary • University • Professional**
**135+ Districts | Voice-Enabled | Document Learning | Adaptive Quizzing**

---

## 🚀 Quick Start

### Prerequisites
- Android Studio Hedgehog or later
- JDK 17+ (the bundled Android Studio JBR works)
- A Supabase project
- An Anthropic Claude API key
- A Resend API key (password reset + meeting invites)

### Android app

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat :app:assembleDebug --console=plain
```

APK → `mobile\app\build\outputs\apk\debug\app-debug.apk`

The app talks to Supabase directly over HTTPS using the anon key
(`mobile/app/src/main/java/com/tutorug/app/data/remote/SupabaseClient.kt`).
There is no `google-services.json` and no Firebase dependency.

### Web app

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm run build      # -> web/dist  (Vercel preset, see web/vercel.json)
```

Vite dev proxies `/auth`, `/rest`, `/storage` and `/functions` to Supabase.

### Database

SQL lives in `supabase/` as plain, re-runnable scripts — there is no
migration-versioning tool. Run them in the Supabase SQL Editor, in order:

| Script | Creates |
|---|---|
| `supabase/setup.sql` | `users`, `chat_sessions`, `chat_messages`, `documents`, `quiz_results`, `study_session_logs`, `timetable_entries` + RLS + storage policies |
| `supabase/features_migration.sql` | `meetings`, `meeting_participants`, `meeting_invites`, `study_rooms`, `room_messages`, `podcast_sessions` + `is_user_invited()` |
| `supabase/security_migration.sql` | `get_own_profile()`, `admin_list_users()`, `admin_find_user()`, `rate_limits`, `consume_rate_limit()` |
| `supabase/admin_migration.sql` | `users.role`, `is_admin()`, `reviews` + admin RLS |
| `supabase/clear_meetings.sql` | Self-contained meetings reset (drops policies, deletes rows, recreates 2 policies) |

> ⚠️ `supabase_migration.sql` in the repo root is an **older, parallel schema**
> that overlaps `supabase/setup.sql`. Prefer `supabase/setup.sql`.
> ⚠️ Never re-introduce the old inline `meetings_read` policy — it caused RLS
> infinite recursion (Postgres `42P17`). Always use `public.is_user_invited(...)`.
> See `MEETINGS_FEATURE_SUMMARY.md`.

### Secrets

Set in the Supabase dashboard under **Edge Functions → Secrets**:

| Secret | Used by |
|---|---|
| `ANTHROPIC_KEY` | `send-chat-message`, `generate-quiz`, `generate-podcast`, `moderate-message`, `process-document` |
| `SUPABASE_SERVICE_ROLE_KEY` | `process-document`, `invite-to-meeting`, `send-otp`, `verify-otp`, `reset-password` |
| `RESEND_API_KEY` + `FROM_EMAIL` | `send-otp`, `reset-password`, `invite-to-meeting`, `send-reminder` |
| `DAILY_API_KEY` | **Optional.** Leave unset — meetings use free `meet.jit.si` |

### Deploy the edge functions

Double-click `deploy-functions.bat` (uses the bundled `supabase.exe`), or:

```powershell
.\supabase functions deploy send-chat-message
.\supabase functions deploy send-otp --no-verify-jwt
```

All functions require a valid Supabase JWT **except** `send-otp`,
`verify-otp` and `reset-password` — a signed-out user has no JWT, and those
three do not call `requireUser()`. The script handles this for you.

---

## 📱 Features Implemented

✅ **Core**
- Supabase Auth (email/password) with 6-digit OTP password reset
- Student profile with district + level + combination selection
- 135+ Uganda districts database (`mobile/app/src/main/res/raw/districts.json`)
- AI chat with localized Ugandan context, streamed over SSE
- Voice input (speech-to-text) and voice output (text-to-speech)
- KaTeX math rendering for AI answers
- Chat history with rename/delete, grouped by date
- Subject sidebar navigation

✅ **Learning**
- Document upload (PDF, images) + ML Kit OCR for handwritten notes
- Section-by-section guided learning flow
- Adaptive quiz engine (70% pass threshold) with progress tracking
- AI-generated revision podcasts (host + student scripts)
- Study rooms with AI message moderation

✅ **Platform**
- Video meetings (Jitsi, opens in external browser) with invite-only access
- Join approval flow (pending / approved / refused)
- Meeting invites by email with Resend notifications
- Timetable with local alarms + reboot rescheduling
- Study insights from attendance logs
- Web admin console: analytics, reviews moderation, user management
- 5 colour themes, light/dark, Baloo 2 typography, kitenge auth design

🔄 **Roadmap**
- Teacher dashboard
- Offline mode
- Multi-language support (Luganda, Acholi, Runyankole)

---

## 🏗️ Architecture

```
TutorUG_App/
├── mobile/                        # Android app (Kotlin + Jetpack Compose)
│   └── app/src/main/java/com/tutorug/app/
│       ├── data/
│       │   ├── local/             # DistrictDatabase (136 districts)
│       │   ├── model/             # Models.kt — all data classes
│       │   ├── remote/            # SupabaseClient (OkHttp + session)
│       │   └── repository/        # 9 repos: Auth, Chat, Document, Meeting,
│       │                          #   Podcast, Quiz, StudyRoom, StudySession, Timetable
│       ├── ui/
│       │   ├── components/        # AuthKit.kt (auth design system)
│       │   ├── screens/           # 19 screens
│       │   └── theme/             # 5 themes, Baloo 2 fonts
│       ├── util/                  # Constants, VoiceManager, alarm receivers
│       ├── viewmodel/             # 9 ViewModels
│       ├── MainActivity.kt        # Compose NavHost
│       └── TutorUGApp.kt          # Application
│
├── web/                           # Web app (React 18 + TS + Vite + Tailwind)
│   └── src/
│       ├── components/            # Logo, ChatSidebar, ChatHistoryModal
│       ├── lib/                   # supabase, api, Auth/Settings/Theme/Timetable contexts
│       ├── pages/                 # 15 pages
│       └── types/                 # All TypeScript types
│
├── supabase/                      # Database + AI backend
│   ├── setup.sql                  # base schema
│   ├── features_migration.sql     # meetings, rooms, podcasts
│   ├── security_migration.sql     # rate limits, admin helpers
│   ├── admin_migration.sql        # roles, reviews
│   ├── clear_meetings.sql         # meetings reset
│   └── functions/                 # 11 Deno edge functions
│       ├── _shared/security.ts    # CORS, requireUser, rate limiting
│       ├── send-chat-message      # Claude, SSE stream
│       ├── generate-quiz          # Claude
│       ├── generate-podcast       # Claude
│       ├── moderate-message       # Claude
│       ├── process-document       # Claude + section writer
│       ├── create-meeting         # Jitsi / Daily.co
│       ├── invite-to-meeting      # Resend email invites
│       ├── send-otp / verify-otp / reset-password / send-reminder
│
├── backend/                       # Express API (Render) — non-AI routes only
│   └── src/routes/                # 14 routes
│
├── functions/                     # ⚠️ LEGACY Firebase callables — dead code
├── pitch_docs/                    # Concept note (HTML / PDF / DOCX)
└── MEETINGS_FEATURE_SUMMARY.md    # Engineering log — read this before touching meetings
```

### Where each feature actually runs

| Concern | Owner |
|---|---|
| Auth, DB, storage, realtime | Supabase (Postgres + GoTrue + Storage), RLS on every table |
| AI (chat, quiz, podcast, moderation, document parsing) | Supabase edge functions → Anthropic Claude |
| Meetings | Jitsi (`meet.jit.si`), created by the `create-meeting` edge function |
| Email | Resend, from `send-otp` / `reset-password` / `invite-to-meeting` / `send-reminder` |
| Data export / account deletion | Express `backend` on Render |
| Android → backend | **Never.** The Android app only talks to Supabase. |
| Web → backend | Only `export-data`, `delete-data`, `respond-invite`, `send-reminder`, and the OTP trio. All AI calls go straight to Supabase (bypasses Express to avoid `Premature close`). |

### Edge functions

| Function | Model | Auth |
|---|---|---|
| `send-chat-message` | `claude-haiku-4-5` (SSE, 1024 tok) | JWT |
| `generate-quiz` | `claude-sonnet-4-20250514` | JWT |
| `generate-podcast` | `claude-haiku-4-5` | JWT |
| `moderate-message` | `claude-3-5-haiku-20241022` | JWT |
| `process-document` | `claude-haiku-4-5` (3000 tok) | JWT |
| `create-meeting` | — | JWT |
| `invite-to-meeting` | — | JWT |
| `send-reminder` | — | JWT |
| `send-otp` / `verify-otp` / `reset-password` | — | public (rate-limited) |

---

## 🎨 Design

- **Black** `#0A0A0A` · **Gold** `#F5C518` · **Red** `#C0392B` (Ugandan flag theme)
- **Font:** Baloo 2
- **Web:** 5 themes (Deep Space, Midnight, Forest, Ocean, Sunset) as CSS variables
- **Auth screens:** shared `AuthKit.kt` / kitenge pattern across Android and web

---

## 🔐 Security

- Supabase Auth with JWT bearer tokens, verified server-side in `_shared/security.ts` and `backend/src/middleware/auth.js`
- RLS on all 18 tables; admin access via `is_admin()` / `role`
- Service-role key is used **only** inside edge functions, never in a client
- Rate limiting: in-memory per function, plus the `rate_limits` table for OTP flows
- `usesCleartextTraffic="false"` on Android; HTTPS everywhere
- OkHttp logging is compiled out of release builds

---

## 🗂️ Database tables (18)

`users` · `user_settings` · `chat_sessions` · `chat_messages` · `documents` ·
`document_sections` · `quiz_results` · `study_session_logs` · `timetable_entries` ·
`meetings` · `meeting_participants` · `meeting_invites` · `study_rooms` ·
`room_messages` · `podcast_sessions` · `reviews` · `rate_limits` ·
`password_reset_otps`

---

## 💰 Cost Estimate

**MVP (0–500 users):**
- Anthropic Claude API: $60–$360/month
- Supabase: $2–$10/month
- Express on Render: $0 (free tier)
- **Total: ~$60–$400/month**

**Growth (1,000+ daily users):**
- Anthropic Claude API: $600–$3,600/month
- Supabase: $10–$50/month
- **Total: ~$600–$4,000/month**

Meetings are free (Jitsi) unless a `DAILY_API_KEY` with a card on file is set.

---

## 📞 Support

**Founding team:**
- Opoka Eric — Co-Founder — opokaeric9@gmail.com
- Ojok Eric — Co-Founder — ericojok69@gmail.com
- Opeto Isaac — Co-Founder — opetoisaac21@gmail.com
- Kayanja Jonathan — Co-Founder — kayanjajonathan296@gmail.com
- Kintu Benjamin — Co-Founder — kintubenjamin05@gmail.com

**Contact:** info@tutorug.com

---

© 2025 TutorUG | Uganda's Smart Learning Companion 🇺🇬
