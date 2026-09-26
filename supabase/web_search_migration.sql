-- =============================================
-- TutorUG WEB SEARCH MIGRATION — Run this in Supabase SQL Editor
-- Safe to run multiple times. Adds storage for the sources an AI answer
-- was grounded in, so citations survive a page reload.
-- =============================================

-- ── CHAT MESSAGE SOURCES ───────────────────────────────────────────────────
-- Shape matches ChatSource in web/src/types/index.ts and the Kotlin
-- ChatSource data class: [{ url, title, citedText }]
alter table chat_messages add column if not exists sources jsonb default '[]'::jsonb;

-- Rate limiting for searches reuses the existing public.consume_rate_limit()
-- RPC from supabase/security_migration.sql — no change needed there.
