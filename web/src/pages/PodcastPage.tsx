import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Mic, Play, Pause, Plus, Loader2, Volume2, Square, RotateCcw,
} from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { apiUrl, apiHeaders } from '@/lib/api'
import {
  normalizeScript, buildUtterances, resolveSpeakerPlan, loadVoices, type Utterance,
} from '@/lib/podcast'
import {
  getHostVoiceMale, getStudentGender, getSpeechRate, hydrateStudentGender,
} from '@/lib/voicePrefs'
import type { PodcastSegment, PodcastSession } from '@/types'

type Playback = 'IDLE' | 'PLAYING' | 'PAUSED'

const VIOLET = '#7C3AED'
const AMBER = '#F59E0B'

export default function PodcastPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [topic, setTopic] = useState('')
  const [subject, setSubject] = useState('')
  const [loading, setLoading] = useState(false)
  const [script, setScript] = useState<PodcastSegment[]>([])
  const [history, setHistory] = useState<PodcastSession[]>([])
  const [playback, setPlayback] = useState<Playback>('IDLE')
  const [cursor, setCursor] = useState(-1)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [followUp, setFollowUp] = useState('')
  const [followUpLoading, setFollowUpLoading] = useState(false)
  const [conversationHistory, setConversationHistory] = useState<{ role: string; content: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [hasSources, setHasSources] = useState(false)
  const [speechReady, setSpeechReady] = useState(false)

  const playbackRef = useRef<Playback>('IDLE')
  const cursorRef = useRef(-1)
  const endRef = useRef<number | null>(null)
  const activeRef = useRef<HTMLDivElement>(null)

  const playbackSet = useCallback((next: Playback) => {
    playbackRef.current = next
    setPlayback(next)
  }, [])
  const cursorSet = useCallback((next: number) => {
    cursorRef.current = next
    setCursor(next)
  }, [])

  useEffect(() => { playbackSet(playback) }, [playback, playbackSet])

  useEffect(() => { if (profile) loadHistory() }, [profile])
  useEffect(() => { hydrateStudentGender(profile?.gender) }, [profile?.gender])
  useEffect(() => {
    if (activeIdx >= 0) activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeIdx])

  // Keep the browser from stopping mid-sentence in some tabs.
  useEffect(() => {
    const keepAlive = setInterval(() => {
      if (playbackRef.current === 'PLAYING' && window.speechSynthesis.paused) {
        window.speechSynthesis.resume()
      }
    }, 5000)
    return () => clearInterval(keepAlive)
  }, [])

  useEffect(() => () => { window.speechSynthesis?.cancel() }, [])

  const utterances: Utterance[] = buildUtterances(script)

  async function loadHistory() {
    if (!profile) return
    const { data } = await supabase
      .from('podcast_sessions').select('*')
      .eq('user_id', profile.user_id)
      .order('created_at', { ascending: false }).limit(10)
    setHistory((data as PodcastSession[]) || [])
  }

  /**
   * Pulls text out of the learner's own notes so the episode is grounded in
   * their material. Mirrors the mobile repository, including the same caps, so
   * both clients send an equivalent payload.
   */
  async function loadSourceMaterial(userId: string, forTopic: string): Promise<string> {
    try {
      const { data } = await supabase
        .from('document_sections')
        .select('title,content,section_index')
        .eq('user_id', userId)
        .order('section_index')
        .limit(60)
      if (!data || data.length === 0) return ''

      const words = forTopic.trim().split(/\s+/).filter((w) => w.length > 3).map((w) => w.toLowerCase())
      const scored = (data as { title?: string; content?: string }[])
        .map((row) => {
          const title = row.title || ''
          const content = row.content || ''
          const hay = `${title} ${content}`.toLowerCase()
          const score =
            words.filter((w) => hay.includes(w)).length +
            (words.some((w) => title.toLowerCase().includes(w)) ? 3 : 0)
          return { score, title, content }
        })
        .sort((a, b) => b.score - a.score)

      const relevant = scored[0] && scored[0].score > 0 ? scored.slice(0, 8) : scored.slice(0, 4)
      let out = ''
      for (const row of relevant) {
        if (!row.content) continue
        const body = row.content.length > 1400 ? row.content.slice(0, 1400) + ' ...' : row.content
        out += `- ${row.title || 'Untitled section'}: ${body.replace(/\s+/g, ' ')}\n`
        if (out.length > 9000) break
      }
      return out
    } catch {
      return ''
    }
  }

  async function generatePodcast(followUpTopic?: string) {
    if (!profile) return
    const isFollowUp = !!followUpTopic
    if (isFollowUp) setFollowUpLoading(true)
    else { setLoading(true); setError(null) }

    try {
      const activeTopic = isFollowUp ? followUpTopic : topic
      const sourceMaterial = await loadSourceMaterial(profile.user_id, activeTopic)
      setHasSources(sourceMaterial.trim().length > 0)

      const res = await fetch(apiUrl('generate-podcast'), {
        method: 'POST',
        headers: await apiHeaders(),
        body: JSON.stringify({
          topic: activeTopic,
          userProfile: {
            name: profile.name,
            district: profile.district,
            educationLevel: profile.education_level,
          },
          districtContext: `Student: ${profile.name}, District: ${profile.district}`,
          conversationHistory: isFollowUp ? conversationHistory : [],
          ...(sourceMaterial ? { sourceMaterial } : {}),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Server error ${res.status}` }))
        throw new Error(err.error || `Server error ${res.status}`)
      }
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      const newSegments = normalizeScript(json.script)
      if (!newSegments.length) throw new Error('No script returned — check ANTHROPIC_KEY in Supabase secrets')

      const updatedScript = isFollowUp ? [...script, ...newSegments] : newSegments
      setScript(updatedScript)
      setFollowUp('')
      cursorSet(-1)
      setActiveIdx(-1)
      playbackSet('IDLE')

      setConversationHistory((prev) => [...prev, {
        role: 'assistant',
        content: newSegments.map((s) => `${s.speaker}: ${s.text}`).join('\n'),
      }])

      if (!isFollowUp) {
        await supabase.from('podcast_sessions').insert({
          podcast_id: crypto.randomUUID(),
          user_id: profile.user_id,
          topic,
          subject,
          education_level: profile.education_level,
          script: updatedScript,
          duration_secs: updatedScript.length * 15,
          created_at: new Date().toISOString(),
        })
        loadHistory()
      } else {
        const latest = history[0]
        if (latest) {
          await supabase.from('podcast_sessions')
            .update({ script: updatedScript, duration_secs: updatedScript.length * 15 })
            .eq('podcast_id', latest.podcast_id)
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to generate podcast')
    } finally {
      setLoading(false)
      setFollowUpLoading(false)
    }
  }

  /**
   * Speaks utterances from [start] up to [endExclusive]. The student voice
   * follows the learner's own gender; the host keeps the chosen voice gender.
   */
  const runQueue = useCallback(async (start: number, endExclusive: number) => {
    window.speechSynthesis.cancel()
    endRef.current = endExclusive
    playbackSet('PLAYING')

    const voices = await loadVoices()
    if (!voices.length) setSpeechReady(false)
    else setSpeechReady(true)

    const hostMale = getHostVoiceMale()
    const studentMale = getStudentGender() === 'male'
    const plan = resolveSpeakerPlan(voices, hostMale, studentMale)
    const rate = getSpeechRate()
    // Surfaces a browser with no usable system voices instead of silently doing nothing.
    console.info('[TutorUGTTS]', 'voice plan', {
      hostMale, studentMale, collided: plan.collided,
      host: plan.host?.name, student: plan.student?.name,
      totalVoices: voices.length,
    })

    const step = (i: number) => {
      if (playbackRef.current !== 'PLAYING') return
      if (i >= endExclusive || i >= utterances.length) {
        cursorSet(-1)
        setActiveIdx(-1)
        playbackSet('IDLE')
        return
      }
      cursorSet(i)
      setActiveIdx(utterances[i].segIdx)

      const u = utterances[i]
      const isHost = u.speaker === 'HOST'
      const utter = new SpeechSynthesisUtterance(u.text)
      utter.lang = 'en-GB'
      utter.rate = rate
      // Pitch and voice both separate the two speakers. When the learner and the
      // host share a gender the voice is swapped so the characters still differ.
      utter.voice = isHost ? plan.host : plan.student
      utter.pitch = isHost ? plan.hostPitch : plan.studentPitch
      utter.onend = () => step(i + 1)
      utter.onerror = () => step(i + 1)
      window.speechSynthesis.speak(utter)
    }

    step(Math.max(0, Math.min(start, Math.max(0, utterances.length - 1))))
  }, [utterances, playbackSet, cursorSet])

  const playFrom = useCallback((start: number) => runQueue(start, utterances.length), [runQueue, utterances.length])

  const playSegment = useCallback((segIdx: number) => {
    const first = utterances.findIndex((u) => u.segIdx === segIdx)
    if (first < 0) return
    let last = first
    while (last + 1 < utterances.length && utterances[last + 1].segIdx === segIdx) last++
    runQueue(first, last + 1)
  }, [utterances, runQueue])

  function togglePlayPause() {
    if (playback === 'PLAYING') {
      window.speechSynthesis.cancel()
      playbackSet('PAUSED')
      return
    }
    playFrom(cursorRef.current >= 0 ? cursorRef.current : 0)
  }

  function stopAll() {
    window.speechSynthesis.cancel()
    playbackSet('IDLE')
    cursorSet(-1)
    setActiveIdx(-1)
  }

  function restart() {
    playFrom(0)
  }

  function speakSingle(idx: number) {
    window.speechSynthesis.cancel()
    playbackSet('IDLE')
    const voices = window.speechSynthesis.getVoices()
    const isHost = script[idx]?.speaker === 'HOST'
    const plan = resolveSpeakerPlan(voices, getHostVoiceMale(), getStudentGender() === 'male')
    const utter = new SpeechSynthesisUtterance(script[idx].text)
    utter.lang = 'en-GB'
    utter.rate = getSpeechRate()
    utter.voice = isHost ? plan.host : plan.student
    utter.pitch = isHost ? plan.hostPitch : plan.studentPitch
    window.speechSynthesis.speak(utter)
  }

  function loadSession(session: PodcastSession) {
    // Never trust the column shape: a text column can hand back a JSON string.
    const segments = normalizeScript(session.script)
    setScript(segments)
    setTopic(session.topic || '')
    setSubject(session.subject || '')
    setHasSources(false)
    cursorSet(-1)
    setActiveIdx(-1)
    playbackSet('IDLE')
    window.speechSynthesis.cancel()
    if (segments.length) {
      setConversationHistory([{
        role: 'assistant',
        content: segments.map((s) => `${s.speaker}: ${s.text}`).join('\n'),
      }])
    } else {
      setConversationHistory([])
      setError('That saved episode had no readable script. Generate it again.')
    }
  }

  const inputStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }

  if (!profile) return null

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-surface to-bg overflow-hidden items-center">
      <div className="max-w-3xl mx-auto w-full flex flex-col h-full">

        {/* TOP BAR */}
        <div className="bg-gradient-to-r from-surface to-surface-var px-2 py-2 flex items-center gap-2 shrink-0">
          <button onClick={() => navigate('/chat')} className="w-10 h-10 flex items-center justify-center shrink-0">
            <div className="w-8 h-8 bg-surface-input rounded-full flex items-center justify-center">
              <ArrowLeft size={16} className="text-text-white" />
            </div>
          </button>
          <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0"
            style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#0A0A1F' }}>🎙</div>
          <p className="text-text-white font-bold text-lg flex-1">AI Podcast</p>
          {script.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button onClick={restart} title="Replay from start"
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                <RotateCcw size={13} style={{ color: '#FFB800' }} />
              </button>
              <button onClick={stopAll} title="Stop"
                disabled={playback === 'IDLE'}
                className="w-8 h-8 rounded-xl flex items-center justify-center disabled:opacity-30"
                style={{ background: 'rgba(239,68,68,0.15)' }}>
                <Square size={12} style={{ color: '#EF4444' }} />
              </button>
              <button onClick={togglePlayPause}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                style={{ background: playback === 'PLAYING' ? 'rgba(255,184,0,0.2)' : 'rgba(255,184,0,0.15)', color: '#FFB800' }}>
                {playback === 'PLAYING' ? <Pause size={12} /> : <Play size={12} />}
                {playback === 'PLAYING' ? 'Pause' : playback === 'PAUSED' ? 'Resume' : 'Play'}
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

          {/* Generate form */}
          {script.length === 0 && (
            <div className="space-y-3">
              <div className="rounded-2xl p-5 space-y-3" style={{ background: '#12122A' }}>
                <p className="text-text-white font-bold text-base">🎙️ Generate a Learning Podcast</p>
                <p className="text-text-disabled text-xs">A HOST and a student discuss your topic out loud. The AI reads your own uploaded notes, so the conversation is about your material, not a generic summary.</p>
                <input value={topic} onChange={(e) => setTopic(e.target.value)}
                  placeholder="Topic (e.g. Photosynthesis, Quadratic Equations) *"
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={inputStyle} />
                <input value={subject} onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject (e.g. Biology, Mathematics)"
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={inputStyle} />
                <button onClick={() => generatePodcast()} disabled={loading || !topic.trim()}
                  className="w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#0A0A1F' }}>
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
                  {loading ? 'Generating podcast…' : 'Generate Podcast'}
                </button>
                {error && (
                  <div className="rounded-xl px-3 py-2 text-xs font-medium" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                    ⚠️ {error}
                  </div>
                )}
              </div>

              {/* Past sessions */}
              {history.length > 0 && (
                <div>
                  <p className="text-text-disabled text-xs font-bold uppercase tracking-wider mb-2">PAST PODCASTS</p>
                  <div className="space-y-2">
                    {history.map((s) => {
                      const segs = normalizeScript(s.script)
                      return (
                        <button key={s.podcast_id} onClick={() => loadSession(s)}
                          className="w-full text-left rounded-2xl p-3 flex items-center gap-3"
                          style={{ background: '#12122A', border: '1px solid rgba(255,184,0,0.1)' }}>
                          <span className="text-xl">🎙️</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-text-white text-sm font-semibold truncate">{s.topic || 'Untitled'}</p>
                            <p className="text-text-disabled text-xs">
                              {s.subject || 'General'} · {segs.length} segments
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Podcast script */}
          {script.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-text-disabled text-xs font-bold uppercase tracking-wider">NOW PLAYING — {topic}</p>
                <button onClick={() => { stopAll(); setScript([]); setConversationHistory([]) }}
                  className="text-text-disabled text-xs flex items-center gap-1 hover:text-primary">
                  <Plus size={12} /> New Topic
                </button>
              </div>

              {/* Transport summary */}
              <div className="rounded-2xl px-4 py-3 flex items-center gap-3"
                style={{ background: '#12122A', border: '1px solid rgba(255,184,0,0.12)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-text-white text-xs font-bold">
                    {playback === 'PLAYING'
                      ? (activeIdx >= 0 && script[activeIdx]?.speaker === 'HOST'
                        ? 'TutorUG HOST is speaking'
                        : `${profile.name} is speaking`)
                      : playback === 'PAUSED'
                        ? `Paused on turn ${activeIdx + 1}`
                        : `Ready · ${script.length} turns`}
                  </p>
                  <p className="text-text-disabled text-[10px]">
                    {hasSources ? 'Two different voices · grounded in your notes' : 'Two different voices · syllabus based'}
                    {!speechReady && ' · no system voices found'}
                  </p>
                </div>
                <p className="text-text-disabled text-xs font-bold">{Math.max(0, activeIdx + 1)}/{script.length}</p>
              </div>

              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full transition-all duration-300"
                  style={{
                    width: `${script.length ? ((Math.max(0, activeIdx + 1)) / script.length) * 100 : 0}%`,
                    background: 'linear-gradient(90deg,#F59E0B,#D97706)',
                  }} />
              </div>

              {script.map((seg, idx) => {
                const isHost = seg.speaker === 'HOST'
                const isActive = activeIdx === idx
                const isPast = activeIdx > idx
                return (
                  <div key={idx} ref={isActive ? activeRef : undefined}
                    className={`flex gap-3 ${isHost ? 'flex-row' : 'flex-row-reverse'}`}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                      style={isHost
                        ? { background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', color: '#fff' }
                        : { background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#0A0A1F' }}>
                      {isHost ? 'AI' : 'ME'}
                    </div>
                    <div className="max-w-[80%]">
                      <p className="text-xs font-bold mb-1" style={{ color: isHost ? VIOLET : AMBER }}>
                        {isHost ? 'TutorUG HOST' : profile.name}
                      </p>
                      <div className="rounded-2xl px-4 py-3 text-sm relative transition-all"
                        style={isHost
                          ? {
                            background: isActive ? '#241a4d' : '#1A1A3A',
                            border: `1px solid ${isActive ? 'rgba(124,58,237,0.8)' : 'rgba(124,58,237,0.3)'}`,
                            color: '#F0F0FF',
                            opacity: isPast ? 0.6 : 1,
                          }
                          : {
                            background: isActive ? 'rgba(245,158,11,0.3)' : 'linear-gradient(135deg,#F59E0B30,#D9770640)',
                            border: `1px solid ${isActive ? 'rgba(255,184,0,0.9)' : 'rgba(255,184,0,0.3)'}`,
                            color: '#F0F0FF',
                            opacity: isPast ? 0.6 : 1,
                          }}>
                        {seg.text}
                        <button onClick={() => speakSingle(idx)} title="Hear this turn"
                          className="absolute top-2 right-2 opacity-60 hover:opacity-100">
                          <Volume2 size={12} style={{ color: isHost ? VIOLET : AMBER }} />
                        </button>
                      </div>
                      <button onClick={() => (activeIdx === idx && playback !== 'IDLE' ? togglePlayPause() : playSegment(idx))}
                        className="mt-1 text-[10px] flex items-center gap-1"
                        style={{ color: isHost ? VIOLET : AMBER, opacity: 0.8 }}>
                        {activeIdx === idx && playback !== 'IDLE' ? <><Pause size={10} /> Pause this turn</> : <><Play size={10} /> Hear this turn</>}
                      </button>
                    </div>
                  </div>
                )
              })}

              {/* Follow-up input */}
              <div className="rounded-2xl p-4 space-y-3 mt-2" style={{ background: '#12122A' }}>
                <p className="text-text-white text-sm font-semibold">💬 Ask a follow-up question</p>
                <div className="flex gap-2">
                  <input value={followUp} onChange={(e) => setFollowUp(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && followUp.trim()) generatePodcast(followUp.trim()) }}
                    placeholder="What else do you want to know?" className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none" style={inputStyle} />
                  <button onClick={() => generatePodcast(followUp.trim())} disabled={!followUp.trim() || followUpLoading}
                    className="h-10 w-10 rounded-xl flex items-center justify-center disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}>
                    {followUpLoading ? <Loader2 size={15} className="animate-spin text-white" /> : <Mic size={15} className="text-white" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
