-- ============================================================
-- TutorUG — Full Database Migration
-- Run this in Supabase SQL Editor
-- Drops ALL existing tables and rebuilds from scratch
-- ============================================================

-- ── 1. DROP ALL EXISTING TABLES (order matters for FK deps) ──
DROP TABLE IF EXISTS public.user_settings    CASCADE;
DROP TABLE IF EXISTS public.quiz_results     CASCADE;
DROP TABLE IF EXISTS public.document_sections CASCADE;
DROP TABLE IF EXISTS public.documents        CASCADE;
DROP TABLE IF EXISTS public.chat_messages    CASCADE;
DROP TABLE IF EXISTS public.chat_sessions    CASCADE;
DROP TABLE IF EXISTS public.users            CASCADE;

-- ── 2. ENABLE UUID EXTENSION ─────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: users
-- Stores every field collected during registration + profile
-- ============================================================
CREATE TABLE public.users (
    user_id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name            TEXT        NOT NULL DEFAULT '',
    email           TEXT        NOT NULL DEFAULT '',
    district        TEXT        NOT NULL DEFAULT '',
    region          TEXT        NOT NULL DEFAULT '',
    education_level TEXT        NOT NULL DEFAULT '',
    school          TEXT        NOT NULL DEFAULT '',
    combination     TEXT        NOT NULL DEFAULT '',   -- A-Level e.g. "PCB"
    course          TEXT        NOT NULL DEFAULT '',   -- University course
    profession      TEXT        NOT NULL DEFAULT '',   -- Professional
    avatar_url      TEXT        NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_messages  INT         NOT NULL DEFAULT 0,
    total_quizzes   INT         NOT NULL DEFAULT 0,
    total_documents INT         NOT NULL DEFAULT 0,
    streak_days     INT         NOT NULL DEFAULT 0,
    last_streak_date DATE
);

-- ============================================================
-- TABLE: chat_sessions
-- One session per subject/topic conversation
-- ============================================================
CREATE TABLE public.chat_sessions (
    session_id      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID        NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    subject         TEXT        NOT NULL DEFAULT '',
    education_level TEXT        NOT NULL DEFAULT '',
    title           TEXT        NOT NULL DEFAULT '',   -- auto-generated from first message
    message_count   INT         NOT NULL DEFAULT 0,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: chat_messages
-- Normalized — one row per message (not JSON array)
-- ============================================================
CREATE TABLE public.chat_messages (
    message_id  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id  UUID        NOT NULL REFERENCES public.chat_sessions(session_id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    role        TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
    content     TEXT        NOT NULL DEFAULT '',
    token_count INT         NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: documents
-- Uploaded PDFs / images / docs
-- ============================================================
CREATE TABLE public.documents (
    document_id   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID        NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    file_name     TEXT        NOT NULL DEFAULT '',
    storage_url   TEXT        NOT NULL DEFAULT '',
    mime_type     TEXT        NOT NULL DEFAULT 'application/octet-stream',
    file_size_kb  INT         NOT NULL DEFAULT 0,
    subject       TEXT        NOT NULL DEFAULT '',
    education_level TEXT      NOT NULL DEFAULT '',
    status        TEXT        NOT NULL DEFAULT 'processing'
                              CHECK (status IN ('processing', 'ready', 'failed')),
    overall_score INT         NOT NULL DEFAULT 0,
    section_count INT         NOT NULL DEFAULT 0,
    uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at  TIMESTAMPTZ
);

-- ============================================================
-- TABLE: document_sections
-- Each section extracted from a document by AI
-- ============================================================
CREATE TABLE public.document_sections (
    section_id    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id   UUID        NOT NULL REFERENCES public.documents(document_id) ON DELETE CASCADE,
    user_id       UUID        NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    section_index INT         NOT NULL DEFAULT 0,
    title         TEXT        NOT NULL DEFAULT '',
    content       TEXT        NOT NULL DEFAULT '',
    quiz_passed   BOOLEAN     NOT NULL DEFAULT FALSE,
    best_score    INT         NOT NULL DEFAULT 0,
    attempt_count INT         NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: quiz_results
-- Every quiz attempt — one row per attempt
-- ============================================================
CREATE TABLE public.quiz_results (
    quiz_id       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID        NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    document_id   UUID        REFERENCES public.documents(document_id) ON DELETE SET NULL,
    section_id    UUID        REFERENCES public.document_sections(section_id) ON DELETE SET NULL,
    section_title TEXT        NOT NULL DEFAULT '',
    subject       TEXT        NOT NULL DEFAULT '',
    education_level TEXT      NOT NULL DEFAULT '',
    score         INT         NOT NULL DEFAULT 0,
    total_questions INT       NOT NULL DEFAULT 0,
    correct_answers INT       NOT NULL DEFAULT 0,
    passed        BOOLEAN     NOT NULL DEFAULT FALSE,
    difficulty    TEXT        NOT NULL DEFAULT 'adaptive'
                              CHECK (difficulty IN ('adaptive', 'easy', 'medium', 'hard')),
    time_taken_sec INT        NOT NULL DEFAULT 0,
    taken_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: user_settings
-- All SettingsViewModel preferences — one row per user
-- ============================================================
CREATE TABLE public.user_settings (
    user_id                UUID    PRIMARY KEY REFERENCES public.users(user_id) ON DELETE CASCADE,
    voice_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
    auto_read_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
    quiz_sound_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    notifications_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
    study_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    quiz_difficulty        TEXT    NOT NULL DEFAULT 'adaptive'
                                   CHECK (quiz_difficulty IN ('adaptive', 'easy', 'medium', 'hard')),
    app_theme              TEXT    NOT NULL DEFAULT 'DEEP_SPACE'
                                   CHECK (app_theme IN ('DEEP_SPACE','MIDNIGHT','FOREST','OCEAN','SUNSET')),
    language               TEXT    NOT NULL DEFAULT 'en',
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES — for fast queries used by the app
-- ============================================================
CREATE INDEX idx_chat_sessions_user    ON public.chat_sessions(user_id, last_message_at DESC);
CREATE INDEX idx_chat_messages_session ON public.chat_messages(session_id, created_at ASC);
CREATE INDEX idx_documents_user        ON public.documents(user_id, uploaded_at DESC);
CREATE INDEX idx_doc_sections_document ON public.document_sections(document_id, section_index ASC);
CREATE INDEX idx_quiz_results_user     ON public.quiz_results(user_id, taken_at DESC);
CREATE INDEX idx_quiz_results_document ON public.quiz_results(document_id);

-- ============================================================
-- ROW LEVEL SECURITY — users can only access their own data
-- ============================================================
ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_results      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings     ENABLE ROW LEVEL SECURITY;

-- users
CREATE POLICY "users_own" ON public.users
    FOR ALL USING (auth.uid() = user_id);

-- chat_sessions
CREATE POLICY "sessions_own" ON public.chat_sessions
    FOR ALL USING (auth.uid() = user_id);

-- chat_messages
CREATE POLICY "messages_own" ON public.chat_messages
    FOR ALL USING (auth.uid() = user_id);

-- documents
CREATE POLICY "documents_own" ON public.documents
    FOR ALL USING (auth.uid() = user_id);

-- document_sections
CREATE POLICY "sections_own" ON public.document_sections
    FOR ALL USING (auth.uid() = user_id);

-- quiz_results
CREATE POLICY "quiz_own" ON public.quiz_results
    FOR ALL USING (auth.uid() = user_id);

-- user_settings
CREATE POLICY "settings_own" ON public.user_settings
    FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- FUNCTION: auto-create user_settings row on new user insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_settings()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_user_created_settings
    AFTER INSERT ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_settings();

-- ============================================================
-- FUNCTION: update last_active on new message
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.users
    SET last_active = NOW(),
        total_messages = total_messages + 1
    WHERE user_id = NEW.user_id;

    UPDATE public.chat_sessions
    SET last_message_at = NOW(),
        message_count = message_count + 1
    WHERE session_id = NEW.session_id;

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_message_inserted
    AFTER INSERT ON public.chat_messages
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_message();

-- ============================================================
-- FUNCTION: update stats on quiz result saved
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_quiz_result()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.users
    SET total_quizzes = total_quizzes + 1
    WHERE user_id = NEW.user_id;

    -- Update section best score if this result is better
    IF NEW.section_id IS NOT NULL THEN
        UPDATE public.document_sections
        SET attempt_count = attempt_count + 1,
            best_score    = GREATEST(best_score, NEW.score),
            quiz_passed   = quiz_passed OR NEW.passed
        WHERE section_id = NEW.section_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_quiz_result_inserted
    AFTER INSERT ON public.quiz_results
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_quiz_result();

-- ============================================================
-- FUNCTION: update document stats when section added
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_section()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.documents
    SET section_count = section_count + 1
    WHERE document_id = NEW.document_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_section_inserted
    AFTER INSERT ON public.document_sections
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_section();

-- ============================================================
-- FUNCTION: update total_documents on document insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_document()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.users
    SET total_documents = total_documents + 1
    WHERE user_id = NEW.user_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_document_inserted
    AFTER INSERT ON public.documents
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_document();
