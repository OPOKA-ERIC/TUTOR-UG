import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Mic, MicOff, Play, Pause, Plus, Loader2, Volume2, Square } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { SUPABASE_URL, SUPABASE_ANON } from '@/lib/supabase'
import type { PodcastSegment, PodcastSession } from '@/types'

export default function PodcastPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [topic, setTopic] = useState('')
  const [subject, setSubject] = useState('')
  const [loading, setLoading] = useState(false)
  const [script, setScript] = useState<PodcastSegment[]>([])
  const [history, setHistory] = useState<PodcastSession[]>([])
  const [playingIdx, setPlayingIdx] = useState<number | null>(null)
  const [followUp, setFollowUp] = useState('')
  const [followUpLoading, setFollowUpLoading] = useState(false)
  const [conversationHistory, setConversationHistory] = useState<{ role: string; content: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (profile) loadHistory() }, [profile])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [script])

  async function loadHistory() {
    if (!profile) return
    const { data } = await supabase
      .from('podcast_sessions').select('*')
      .eq('user_id', profile.user_id)
      .order('created_at', { ascending: false }).limit(10)
    setHistory((data as PodcastSession[]) || [])
  }

  async function generatePodcast(followUpTopic?: string) {
    if (!profile) return
    const isFollowUp = !!followUpTopic
    if (isFollowUp) setFollowUpLoading(true)
    else { setLoading(true); setError(null) }

    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token || SUPABASE_ANON
      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-podcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          topic: isFollowUp ? followUpTopic : topic,
          userProfile: { name: profile.name, district: profile.district, educationLevel: profile.education_level },
          districtContext: `Student: ${profile.name}, District: ${profile.district}`,
          conversationHistory: isFollowUp ? conversationHistory : [],
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Server error ${res.status}` }))
        throw new Error(err.error || `Server error ${res.status}`)
      }
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      const newSegments: PodcastSegment[] = json.script || []
      if (!newSegments.length) throw new Error('No script returned — check ANTHROPIC_KEY in Supabase secrets')

      const updatedScript = isFollowUp ? [...script, ...newSegments] : newSegments
      setScript(updatedScript)
      setFollowUp('')

      setConversationHistory(prev => [...prev, {
        role: 'assistant',
        content: newSegments.map(s => `${s.speaker}: ${s.text}`).join('\n'),
      }])

      if (!isFollowUp) {
        const podcastId = crypto.randomUUID()
        await supabase.from('podcast_sessions').insert({
          podcast_id: podcastId,
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
      setError(e.message || 'Failed to generate podcast')
    } finally {
      setLoading(false)
      setFollowUpLoading(false)
    }
  }

  function speakSegment(idx: number, text: string) {
    if (playingIdx === idx) {
      window.speechSynthesis.cancel()
      setPlayingIdx(null)
      return
    }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-GB'
    u.rate = 0.95
    u.onend = () => setPlayingIdx(null)
    utteranceRef.current = u
    window.speechSynthesis.speak(u)
    setPlayingIdx(idx)
  }

  function playAll() {
    if (script.length === 0) return
    window.speechSynthesis.cancel()
    let idx = 0
    const playNext = () => {
      if (idx >= script.length) { setPlayingIdx(null); return }
      const u = new SpeechSynthesisUtterance(script[idx].text)
      u.lang = 'en-GB'
      u.rate = 0.95
      u.onend = () => { idx++; setPlayingIdx(idx); playNext() }
      utteranceRef.current = u
      window.speechSynthesis.speak(u)
      setPlayingIdx(idx)
    }
    playNext()
  }

  function stopAll() {
    window.speechSynthesis.cancel()
    setPlayingIdx(null)
  }

  function loadSession(session: PodcastSession) {
    setScript(session.script)
    setTopic(session.topic)
    setSubject(session.subject)
    setConversationHistory([{
      role: 'assistant',
      content: session.script.map(s => `${s.speaker}: ${s.text}`).join('\n'),
    }])
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
          <div className="flex items-center gap-2">
            <button onClick={playingIdx !== null ? stopAll : playAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
              style={{ background: playingIdx !== null ? 'rgba(239,68,68,0.15)' : 'rgba(255,184,0,0.15)', color: playingIdx !== null ? '#EF4444' : '#FFB800' }}>
              {playingIdx !== null ? <Square size={12} /> : <Play size={12} />}
              {playingIdx !== null ? 'Stop' : 'Play All'}
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
              <p className="text-text-disabled text-xs">TutorUG AI will create an interactive podcast episode between a HOST and you on any topic you're studying.</p>
              <input value={topic} onChange={e => setTopic(e.target.value)}
                placeholder="Topic (e.g. Photosynthesis, Quadratic Equations) *"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={inputStyle} />
              <input value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="Subject (e.g. Biology, Mathematics)"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={inputStyle} />
              <button onClick={() => generatePodcast()} disabled={loading || !topic}
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
                  {history.map(s => (
                    <button key={s.podcast_id} onClick={() => loadSession(s)}
                      className="w-full text-left rounded-2xl p-3 flex items-center gap-3"
                      style={{ background: '#12122A', border: '1px solid rgba(255,184,0,0.1)' }}>
                      <span className="text-xl">🎙️</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-text-white text-sm font-semibold truncate">{s.topic}</p>
                        <p className="text-text-disabled text-xs">{s.subject} · {s.script.length} segments</p>
                      </div>
                    </button>
                  ))}
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
              <button onClick={() => { setScript([]); setConversationHistory([]) }}
                className="text-text-disabled text-xs flex items-center gap-1 hover:text-primary">
                <Plus size={12} /> New Topic
              </button>
            </div>

            {script.map((seg, idx) => {
              const isHost = seg.speaker === 'HOST'
              const isPlaying = playingIdx === idx
              return (
                <div key={idx} className={`flex gap-3 ${isHost ? 'flex-row' : 'flex-row-reverse'}`}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                    style={isHost
                      ? { background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', color: '#fff' }
                      : { background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#0A0A1F' }}>
                    {isHost ? 'AI' : 'ME'}
                  </div>
                  <div className="max-w-[80%]">
                    <p className="text-xs font-bold mb-1" style={{ color: isHost ? '#7C3AED' : '#F59E0B' }}>
                      {isHost ? 'TutorUG HOST' : profile.name}
                    </p>
                    <div className="rounded-2xl px-4 py-3 text-sm relative"
                      style={isHost
                        ? { background: '#1A1A3A', border: '1px solid rgba(124,58,237,0.3)', color: '#F0F0FF' }
                        : { background: 'linear-gradient(135deg,#F59E0B30,#D9770640)', border: '1px solid rgba(255,184,0,0.3)', color: '#F0F0FF' }}>
                      {seg.text}
                      <button onClick={() => speakSegment(idx, seg.text)}
                        className="absolute top-2 right-2 opacity-60 hover:opacity-100">
                        {isPlaying
                          ? <Square size={12} style={{ color: '#EF4444' }} />
                          : <Volume2 size={12} style={{ color: isHost ? '#7C3AED' : '#F59E0B' }} />}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}

            <div ref={bottomRef} />

            {/* Follow-up input */}
            <div className="rounded-2xl p-4 space-y-3 mt-2" style={{ background: '#12122A' }}>
              <p className="text-text-white text-sm font-semibold">💬 Ask a follow-up question</p>
              <div className="flex gap-2">
                <input value={followUp} onChange={e => setFollowUp(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && followUp.trim()) generatePodcast(followUp.trim()) }}
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
