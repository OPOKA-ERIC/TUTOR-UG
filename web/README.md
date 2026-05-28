# TutorUG Web

React + TypeScript + Tailwind CSS web version of TutorUG.

## Quick Start

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173

## Build for Production

```bash
npm run build
npm run preview
```

## Tech Stack
- React 18 + TypeScript
- Vite
- Tailwind CSS
- React Router v6
- Supabase JS Client
- Lucide React (icons)
- React Markdown

## Task Split

| Member | Pages | Files |
|---|---|---|
| Opoka Eric | Documents, Learning, Quiz | DocumentsPage, LearningPage, QuizPage |
| Ojok Eric | Login, Register, ForgotPassword, Chat | LoginPage, RegisterPage, ForgotPasswordPage, ChatPage |
| Opeto Isaac | Timetable, Progress, Settings, Splash | TimetablePage, ProgressPage, SettingsPage, SplashPage |

## Shared (everyone understands)
- `src/lib/supabase.ts` — Supabase client
- `src/lib/AuthContext.tsx` — Auth state
- `src/lib/constants.ts` — Subjects, education levels
- `src/types/index.ts` — All TypeScript types
- `src/components/Layout.tsx` — Sidebar layout
- `src/components/Logo.tsx` — TutorUG logo
