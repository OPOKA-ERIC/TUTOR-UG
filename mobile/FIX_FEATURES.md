# TutorUG — Fix All Features (Do This Now)

## Root Causes Found & Fixed in Code

| Problem | Root Cause | Fix Applied |
|---|---|---|
| Chat spinning | Wrong model ID `claude-haiku-4-5` | Changed to `claude-3-5-haiku-20241022` |
| Podcast spinning | Wrong model ID `claude-sonnet-4-20250514` | Changed to `claude-3-5-sonnet-20241022` |
| All features hanging | Missing CORS headers on all edge functions | Added OPTIONS handler + CORS to all 4 functions |
| Study Rooms empty | DB tables not created yet | Fixed migration SQL (safe to re-run) |
| Meetings spinning | Edge function field names mismatch + no error handling | Fixed field names + added try/catch |

---

## What You Must Do (3 Steps)

### STEP 1 — Run the database migration
1. Go to: https://supabase.com/dashboard/project/jsjhgwficdrgzwbwzkhm/sql/new
2. Open file: `supabase/features_migration.sql`
3. Paste the entire contents and click **Run**
4. You should see: "Success. No rows returned"

This creates: `meetings`, `meeting_participants`, `study_rooms` (with 11 rooms pre-seeded), `room_messages`, `podcast_sessions`

---

### STEP 2 — Set your Anthropic API key as a Supabase secret
1. Go to: https://supabase.com/dashboard/project/jsjhgwficdrgzwbwzkhm/settings/functions
2. Click **Add new secret**
3. Name: `ANTHROPIC_KEY`
4. Value: your Anthropic API key (starts with `sk-ant-...`)
5. Click Save

Without this, ALL AI features (chat, podcast, moderation) will fail.

---

### STEP 3 — Deploy the updated edge functions
Open terminal in the project root and run:

```bash
supabase functions deploy send-chat-message --no-verify-jwt
supabase functions deploy moderate-message --no-verify-jwt
supabase functions deploy generate-podcast --no-verify-jwt
supabase functions deploy create-meeting --no-verify-jwt
```

OR just double-click `deploy-functions.bat` in the project root.

---

## Optional: Daily.co for real video meetings
- Without a Daily.co key, meetings will use mock room URLs (good for testing the flow)
- To get real video: sign up at https://www.daily.co, get API key, add secret `DAILY_API_KEY` in Supabase

---

## After all 3 steps — everything should work:
- ✅ Chat AI responds in real time (streaming)
- ✅ Study Rooms shows 11 rooms, messages send/receive live
- ✅ AI Podcast generates HOST + STUDENT scripts, plays with TTS
- ✅ Meetings creates rooms and shows in list
