import type { PodcastSegment } from '@/types'

/**
 * The `script` column on podcast_sessions is plain text, so rows written by
 * different clients arrive in three shapes: a real array, a JSON-encoded string,
 * or nothing at all. Reading it as an array and calling .map() on a string
 * threw a TypeError that blanked the whole page, so every read funnels through
 * here first.
 */
export type RawScript = PodcastSegment[] | string | null | undefined

export function normalizeScript(raw: RawScript): PodcastSegment[] {
  let value: unknown = raw

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    try {
      value = JSON.parse(trimmed)
    } catch {
      return []
    }
    // Tolerate a double-encoded value rather than silently dropping the episode.
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value)
      } catch {
        return []
      }
    }
  }

  if (!Array.isArray(value)) return []

  return value
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .map((s) => ({
      speaker:
        String(s.speaker ?? 'HOST').toUpperCase() === 'STUDENT'
          ? ('STUDENT' as const)
          : ('HOST' as const),
      text: String(s.text ?? '').trim(),
    }))
    .filter((s) => s.text.length > 0)
}

export interface Utterance {
  text: string
  segIdx: number
  speaker: PodcastSegment['speaker']
}

/**
 * Speech synthesis gives us no way to resume mid-utterance, so each turn is cut
 * into sentence-sized pieces. Pausing then replays at most one sentence instead
 * of restarting the whole turn.
 */
export function splitForSpeech(raw: string, maxLen = 260): string[] {
  if (!raw || !raw.trim()) return []
  const out: string[] = []

  for (const sentence of raw.split(/(?<=[.!?])\s+/)) {
    const trimmed = sentence.trim()
    if (!trimmed) continue

    if (trimmed.length <= maxLen) {
      out.push(trimmed)
      continue
    }

    let buffer = ''
    for (const clause of trimmed.split(/(?<=[,;:])\s+/)) {
      const c = clause.trim()
      if (!c) continue
      if (buffer && buffer.length + c.length + 1 > maxLen) {
        out.push(buffer)
        buffer = ''
      }
      buffer += (buffer ? ' ' : '') + c
    }
    if (buffer) out.push(buffer)
  }

  return out
}

export function buildUtterances(script: PodcastSegment[]): Utterance[] {
  const out: Utterance[] = []
  script.forEach((seg, segIdx) => {
    splitForSpeech(seg.text).forEach((text) => out.push({ text, segIdx, speaker: seg.speaker }))
  })
  return out
}

/** Voice-name keywords used to pick a recognisably male or female voice. */
const MALE_HINTS = [
  'david', 'mark', 'daniel', 'george', 'guy', 'fred', 'ralph',
  'albert', 'bruce', 'oliver', 'arthur', 'ryan', 'thomas', 'aaron', 'adam',
  'gordon', 'victor', 'james', 'luca', 'maged', 'xander', 'carlos', 'jorge',
]
const FEMALE_HINTS = [
  'karen', 'moira', 'tessa', 'samantha', 'victoria', 'fiona',
  'serena', 'kate', 'hazel', 'amelie', 'zira', 'susan', 'fanny', 'linda',
  'zuyin', 'carla', 'beatriz', 'lucia', 'paulina', 'monica', 'isabella',
]

// "female" contains the substring "male". Matching with includes() therefore
// scores a female voice as the STRONGEST possible male match, so a male student
// was handed a female voice and the planner believed there was no collision, so
// it never applied the corrective pitch. That is what made "male" sound female.
// Test for the word as a standalone token and explicitly veto the other gender.
const MALE_TOKEN = /(^|[^a-z])male($|[^a-z])/
const FEMALE_TOKEN = /(^|[^a-z])female($|[^a-z])/

function declaresMale(voice: SpeechSynthesisVoice): boolean {
  const n = voice.name.toLowerCase()
  return MALE_TOKEN.test(n) && !FEMALE_TOKEN.test(n)
}

function declaresFemale(voice: SpeechSynthesisVoice): boolean {
  const n = voice.name.toLowerCase()
  return FEMALE_TOKEN.test(n)
}

function scoreVoice(voice: SpeechSynthesisVoice, male: boolean): number {
  const name = voice.name.toLowerCase()
  const hints = male ? MALE_HINTS : FEMALE_HINTS
  let score = 0
  // An explicit "male"/"female" token is the strongest signal available, but a
  // voice that declares the other gender is never a match at any score.
  if (male) {
    if (declaresFemale(voice)) return 0
    if (declaresMale(voice)) score += 100
  } else {
    if (declaresMale(voice)) return 0
    if (declaresFemale(voice)) score += 100
  }
  for (const hint of hints) {
    if (name.includes(hint)) score += 10
  }
  if (voice.lang?.toLowerCase().startsWith('en')) score += 5
  return score
}

/** True when the voice name itself declares the requested gender. */
export function voiceMatchesGender(voice: SpeechSynthesisVoice, male: boolean): boolean {
  return scoreVoice(voice, male) > 0
}

export function pickVoiceFor(
  voices: SpeechSynthesisVoice[],
  male: boolean,
  exclude?: SpeechSynthesisVoice | null,
): SpeechSynthesisVoice | null {
  const ranked = voices
    .filter((v) => v.lang?.toLowerCase().startsWith('en'))
    .map((v) => ({ v, s: scoreVoice(v, male) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)

  const best = ranked.find((x) => x.v !== exclude) ?? ranked[0]
  if (best) return best.v

  // No gender match available: borrow any other English voice for contrast.
  const other = voices.find((v) => v.lang?.toLowerCase().startsWith('en') && v !== exclude)
  return other ?? voices.find((v) => v.lang?.toLowerCase().startsWith('en')) ?? null
}

/** speechSynthesis.getVoices() is async on first load in Chrome. */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return resolve([])
    const existing = window.speechSynthesis.getVoices()
    if (existing.length) return resolve(existing)
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve(window.speechSynthesis.getVoices())
    }
    window.speechSynthesis.addEventListener('voiceschanged', finish, { once: true })
    // Some browsers never fire the event, so do not wait forever.
    setTimeout(finish, 1500)
  })
}

/**
 * Decides the per-turn voice and pitch for the two speakers.
 *
 * Mirrors the Android VoiceManager: the host follows the learner's chosen
 * assistant voice, the student follows the learner's own gender, and when the
 * browser only exposes one usable voice, pitch carries the difference instead.
 * A male student sharing a female voice must be shifted DOWN, otherwise raising
 * the pitch makes him sound even more feminine.
 */
export function resolveSpeakerPlan(
  voices: SpeechSynthesisVoice[],
  hostMale: boolean,
  studentMale: boolean,
) {
  const host = pickVoiceFor(voices, hostMale)
  const studentWanted = pickVoiceFor(voices, studentMale, host)

  // A collision means the student's voice is the WRONG GENDER, not merely the
  // same object as the host. pickVoiceFor always borrows some other English
  // voice when no gender match exists, so comparing object identity reported
  // "no collision" on a female-only device and left the pitch at 1.0, which is
  // how a male student kept sounding female.
  const collided = !studentWanted || !voiceMatchesGender(studentWanted, studentMale)
  const student = collided
    ? voices.find((v) => v !== host && v.lang?.toLowerCase().startsWith('en')) ?? host
    : studentWanted

  return {
    host,
    student,
    collided,
    hostPitch: hostMale ? 0.85 : 1.05,
    studentPitch: collided ? (studentMale ? 0.72 : 1.28) : 1,
  }
}
