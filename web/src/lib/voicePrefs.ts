import { supabase } from './supabase'

/**
 * Voice preferences are device-local, matching the mobile app, which keeps
 * speech rate and voice gender in local storage rather than user_settings.
 * The learner's own gender is additionally mirrored to the profile so the
 * podcast follows them onto a new device.
 */

const RATE_KEY = 'tutorug.speech_rate'
const HOST_VOICE_KEY = 'tutorug.host_voice_gender' // 'male' | 'female'
const STUDENT_GENDER_KEY = 'tutorug.student_gender' // 'male' | 'female' | ''

function read(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  return window.localStorage.getItem(key) ?? fallback
}

function write(key: string, value: string) {
  if (typeof window === 'undefined') return
  if (value) window.localStorage.setItem(key, value)
  else window.localStorage.removeItem(key)
}

export function getSpeechRate(): number {
  const raw = parseFloat(read(RATE_KEY, '1'))
  return Number.isFinite(raw) ? Math.min(2, Math.max(0.5, raw)) : 1
}

export function setSpeechRate(rate: number) {
  write(RATE_KEY, String(rate))
}

/** The chatbot / HOST voice. Mobile default is female. */
export function getHostVoiceMale(): boolean {
  return read(HOST_VOICE_KEY, 'female') === 'male'
}

export function setHostVoiceMale(male: boolean) {
  write(HOST_VOICE_KEY, male ? 'male' : 'female')
}

export function getStudentGender(): string {
  return read(STUDENT_GENDER_KEY, '')
}

export function setStudentGender(value: string) {
  write(STUDENT_GENDER_KEY, value)
  void syncGenderToProfile(value)
}

async function syncGenderToProfile(gender: string) {
  try {
    const { data } = await supabase.auth.getSession()
    const userId = data.session?.user?.id
    if (!userId) return
    await supabase
      .from('users')
      .update({ gender: gender || null })
      .eq('user_id', userId)
  } catch {
    // A missing gender column must never break Settings; the local value stands.
  }
}

/** Seeds the picker from the profile on a new device without overwriting a local choice. */
export function hydrateStudentGender(profileGender?: string | null) {
  if (getStudentGender()) return
  const clean = (profileGender || '').trim().toLowerCase()
  if (clean === 'male' || clean === 'female' || clean === 'other') {
    write(STUDENT_GENDER_KEY, clean)
  }
}
