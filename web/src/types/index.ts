export interface UserProfile {
  user_id: string
  name: string
  email: string
  district: string
  region: string
  education_level: string
  school: string
  combination: string
  course: string
  profession: string
  avatar_url: string
  created_at: string
  last_active: string
  total_messages: number
  total_quizzes: number
  total_documents: number
  streak_days: number
  last_streak_date: string | null
}

export interface ChatSession {
  session_id: string
  user_id: string
  subject: string
  education_level: string
  title: string
  message_count: number
  started_at: string
  last_message_at: string
  document_id: string | null
  section_index: number
  messages?: ChatMessage[]
}

export interface ChatMessage {
  message_id: string
  session_id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  token_count: number
  created_at: string
}

export interface UploadedDocument {
  document_id: string
  user_id: string
  file_name: string
  storage_url: string
  mime_type: string
  file_size_kb: number
  subject: string
  education_level: string
  status: 'processing' | 'ready' | 'failed'
  overall_score: number
  section_count: number
  uploaded_at: string
  processed_at: string | null
}

export interface DocumentSection {
  section_id: string
  document_id: string
  user_id: string
  section_index: number
  title: string
  content: string
  quiz_passed: boolean
  best_score: number
  attempt_count: number
  created_at: string
}

export interface QuizQuestion {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface QuizResult {
  quiz_id: string
  user_id: string
  document_id: string | null
  section_id: string | null
  section_title: string
  subject: string
  education_level: string
  score: number
  total_questions: number
  correct_answers: number
  passed: boolean
  difficulty: string
  time_taken_sec: number
  taken_at: string
}

export interface TimetableEntry {
  entry_id: string
  user_id: string
  subject: string
  day_of_week: number   // 1=Mon … 7=Sun
  start_hour: number
  start_min: number
  end_hour: number
  end_min: number
  color_hex: string
  created_at: string
}

export interface UserSettings {
  user_id: string
  voice_enabled: boolean
  auto_read_enabled: boolean
  quiz_sound_enabled: boolean
  notifications_enabled: boolean
  study_reminders_enabled: boolean
  quiz_difficulty: string
  app_theme: string
  language: string
  updated_at: string
}

export interface StudySessionLog {
  log_id: string
  user_id: string
  entry_id: string
  subject: string
  day_of_week: number
  scheduled_mins: number
  attended_mins: number
  alarm_fired: boolean
  date_str: string
  created_at: string
}

export type InsightType = 'GOOD' | 'NEEDS_MORE_TIME' | 'MISSED' | 'NO_DATA'

export interface StudyInsight {
  entry_id: string
  subject: string
  day_of_week: number
  date_str: string
  type: InsightType
  attended_mins: number
  scheduled_mins: number
  avg_score: number
  recommendation: string
}

// Auth states
export type AuthState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'authenticated'; profile: UserProfile }
  | { status: 'error'; message: string }

// Upload states
export type UploadState =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'processing'; documentId: string }
  | { status: 'ready'; documentId: string; sections: DocumentSection[] }
  | { status: 'error'; message: string }

// ── MEETINGS ──────────────────────────────────────────────────────────────────
export interface Meeting {
  meeting_id: string
  host_id: string
  title: string
  subject: string
  description: string
  room_url: string
  room_token: string
  scheduled_at: string
  duration_mins: number
  status: 'scheduled' | 'live' | 'ended'
  created_at: string
  host_name?: string   // joined from users
}

export interface MeetingParticipant {
  id: string
  meeting_id: string
  user_id: string
  join_token: string
  joined_at: string
}

// ── STUDY ROOMS ───────────────────────────────────────────────────────────────
export interface StudyRoom {
  room_id: string
  subject: string
  education_level: string
  description: string
  member_count: number
  created_at: string
}

export interface RoomMessage {
  message_id: string
  room_id: string
  user_id: string
  user_name: string
  user_avatar: string
  content: string
  flagged: boolean
  created_at: string
}

// ── PODCAST ───────────────────────────────────────────────────────────────────
export interface PodcastSegment {
  speaker: 'HOST' | 'STUDENT'
  text: string
}

export interface PodcastSession {
  podcast_id: string
  user_id: string
  topic: string
  subject: string
  education_level: string
  script: PodcastSegment[]
  duration_secs: number
  created_at: string
}
