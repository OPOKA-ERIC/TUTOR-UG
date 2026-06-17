import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Menu, Send, Mic, Plus, Trash2, Loader2,
  Settings, Calendar, LogOut, Volume2, Paperclip,
  Square, ChevronUp, ChevronDown, Video, Users
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { SUPABASE_URL, SUPABASE_ANON } from '@/lib/supabase'
import { getSidebarSubjects } from '@/lib/constants'
import Logo from '@/components/Logo'
import type { ChatSession, ChatMessage } from '@/types'

// AI avatar — Amber→Violet gradient circle
function AIAvatar() {
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-black text-xs text-white"
      style={{ background: 'linear-gradient(135deg, #F59E0B, #7C3AED)' }}>
      AI
    </div>
  )
}

export default function ChatPage() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [currentSubject, setCurrentSubject] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [listening, setListening] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null)
  const [speechRate, setSpeechRate] = useState(1.0)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const subjects = profile ? getSidebarSubjects(profile) : []

  // context label shown in top bar — matches Android contextLabel
  const contextLabel = !profile ? '' :
    profile.education_level === 'University' ? (profile.course || 'University') :
    profile.education_level === 'Professional' ? (profile.profession || 'Professional') :
    ['S5', 'S6'].includes(profile.education_level)
      ? `${profile.education_level} • ${profile.combination || 'A-Level'}`
      : profile.education_level

  useEffect(() => { if (profile) loadHistory() }, [profile])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, streamingText])

  async function loadHistory() {
    if (!profile) return
    const { data } = await supabase
      .from('chat_sessions').select('*')
      .eq('user_id', profile.user_id)
      .is('document_id', null)
      .order('last_message_at', { ascending: false })
      .limit(50)
    setSessions((data as ChatSession[]) || [])
  }

  async function createSession(subject: string): Promise<string> {
    if (!profile) return ''
    const sessionId = crypto.randomUUID()
    await supabase.from('chat_sessions').insert({
      session_id: sessionId, user_id: profile.user_id,
      subject, education_level: profile.education_level,
      title: subject || 'New Chat', message_count: 0,
      started_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
    })
    return sessionId
  }

  async function selectSession(session: ChatSession) {
    setCurrentSessionId(session.session_id)
    setCurrentSubject(session.subject)
    const { data } = await supabase
      .from('chat_messages').select('*')
      .eq('session_id', session.session_id)
      .order('created_at', { ascending: true })
    setMessages((data as ChatMessage[]) || [])
    setDrawerOpen(false)
  }

  async function confirmDeleteSession(sessionId: string) {
    await supabase.from('chat_messages').delete().eq('session_id', sessionId)
    await supabase.from('chat_sessions').delete().eq('session_id', sessionId)
    setSessions(s => s.filter(x => x.session_id !== sessionId))
    if (currentSessionId === sessionId) { setCurrentSessionId(null); setMessages([]) }
    setDeleteConfirmId(null)
  }

  async function startSubjectChat(subject: string) {
    if (!profile) return
    setDrawerOpen(false)
    setLoading(true)
    setMessages([])
    setCurrentSubject(subject)
    const sessionId = await createSession(subject)
    setCurrentSessionId(sessionId)
    setSessions(s => [{
      session_id: sessionId, user_id: profile.user_id, subject,
      education_level: profile.education_level, title: subject, message_count: 0,
      started_at: new Date().toISOString(), last_message_at: new Date().toISOString(),
      document_id: null, section_index: 0,
    }, ...s])
    const introPrompt = `The student has just opened the ${subject} subject. Greet them warmly, briefly introduce what you can help them with in ${subject} at ${profile.education_level} level, and ask what specific topic they want to study today. Keep it short, friendly and encouraging.`
    await sendToAI(introPrompt, sessionId, [], true)
    setLoading(false)
  }

  function handleNewChat() {
    setCurrentSessionId(null)
    setMessages([])
    setCurrentSubject('')
    setDrawerOpen(false)
  }

  async function sendMessage() {
    if (!input.trim() || loading || !profile) return
    const text = input.trim()
    setInput('')

    let sessionId = currentSessionId
    if (!sessionId) {
      sessionId = await createSession('General')
      setCurrentSessionId(sessionId)
      setCurrentSubject('General')
      setSessions(s => [{
        session_id: sessionId!, user_id: profile.user_id, subject: 'General',
        education_level: profile.education_level, title: 'General', message_count: 0,
        started_at: new Date().toISOString(), last_message_at: new Date().toISOString(),
        document_id: null, section_index: 0,
      }, ...s])
    }

    const userMsg: ChatMessage = {
      message_id: crypto.randomUUID(), session_id: sessionId,
      user_id: profile.user_id, role: 'user', content: text,
      token_count: 0, created_at: new Date().toISOString(),
    }
    setMessages(m => [...m, userMsg])
    await sendToAI(text, sessionId, [...messages, userMsg])
  }

  async function sendToAI(message: string, sessionId: string, history: ChatMessage[], hideUserMsg = false) {
    if (!profile) return
    setLoading(true)
    setStreamingText('')

    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-chat-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}` },
      body: JSON.stringify({
        sessionId, message,
        userProfile: { name: profile.name, district: profile.district, educationLevel: profile.education_level, school: profile.school, course: profile.course, profession: profile.profession, combination: profile.combination },
        districtContext: `Student: ${profile.name}, District: ${profile.district}, Level: ${profile.education_level}`,
        conversationHistory: history.map(m => ({ role: m.role, content: m.content })),
        learningMode: false, sectionTitle: '',
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }))
      const errMsg = err.error || `Server error ${res.status}`
      const aiErr: ChatMessage = {
        message_id: crypto.randomUUID(), session_id: sessionId,
        user_id: profile.user_id, role: 'assistant', content: `⚠️ ${errMsg}`,
        token_count: 0, created_at: new Date().toISOString(),
      }
      setMessages(m => [...m, aiErr])
      setLoading(false)
      return
    }
    if (!res.body) { setLoading(false); return }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let full = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const data = JSON.parse(line.slice(6))
          if (data.token) { full += data.token; setStreamingText(t => t + data.token) }
          if (data.done) full = data.response || full
        } catch {}
      }
    }

    setStreamingText('')
    const aiMsg: ChatMessage = {
      message_id: crypto.randomUUID(), session_id: sessionId,
      user_id: profile.user_id, role: 'assistant', content: full,
      token_count: 0, created_at: new Date().toISOString(),
    }
    if (!hideUserMsg) {
      await supabase.from('chat_messages').insert([
        { message_id: crypto.randomUUID(), session_id: sessionId, user_id: profile.user_id, role: 'user', content: message, token_count: 0, created_at: new Date().toISOString() },
        { ...aiMsg },
      ])
    } else {
      await supabase.from('chat_messages').insert([{ ...aiMsg }])
    }
    setMessages(m => hideUserMsg ? [...m, aiMsg] : [...m.slice(0, -1), m[m.length - 1], aiMsg])
    setLoading(false)
    await loadHistory()
  }

  function startVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = 'en-GB'; rec.interimResults = false
    rec.onstart = () => setListening(true)
    rec.onend = () => setListening(false)
    rec.onresult = (e: any) => setInput(e.results[0][0].transcript)
    rec.start()
  }

  function speakMessage(msgId: string, text: string) {
    if (speakingMsgId === msgId) {
      stopSpeaking()
      return
    }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-GB'
    u.rate = speechRate
    u.onend = () => setSpeakingMsgId(null)
    u.onerror = () => setSpeakingMsgId(null)
    utteranceRef.current = u
    window.speechSynthesis.speak(u)
    setSpeakingMsgId(msgId)
  }

  function stopSpeaking() {
    window.speechSynthesis.cancel()
    setSpeakingMsgId(null)
  }

  function changeRate(delta: number) {
    const next = Math.min(2.0, Math.max(0.5, parseFloat((speechRate + delta).toFixed(2))))
    setSpeechRate(next)
    // If currently speaking, restart with new rate
    if (speakingMsgId && utteranceRef.current) {
      const text = utteranceRef.current.text
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'en-GB'; u.rate = next
      u.onend = () => setSpeakingMsgId(null)
      utteranceRef.current = u
      window.speechSynthesis.speak(u)
    }
  }

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  if (!profile) return null

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-surface to-bg relative overflow-hidden">

      {/* ── TOP BAR — matches Android exactly ── */}
      <div className="bg-gradient-to-r from-surface to-surface-var px-1 py-2 flex items-center gap-1 shrink-0 z-10">

        {/* Menu icon — opens drawer */}
        <button onClick={() => setDrawerOpen(true)}
          className="w-12 h-12 flex items-center justify-center shrink-0">
          <Menu size={24} className="text-text-white" />
        </button>

        {/* Avatar circle — Amber gradient with initial */}
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-base overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#0A0A1F' }}>
          {profile.avatar_url
            ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />
            : (profile.name.charAt(0).toUpperCase() || 'U')}
        </div>

        {/* Name + context label */}
        <div className="flex-1 min-w-0 ml-2">
          <p className="text-text-white font-bold text-sm truncate leading-tight">
            {profile.name || 'Student'}
          </p>
          <p className="text-text-disabled text-xs truncate leading-tight">
            {contextLabel}{profile.district ? ` • ${profile.district}` : ''}
          </p>
        </div>

        {/* Timetable icon */}
        <button onClick={() => navigate('/timetable')}
          className="w-12 h-12 flex items-center justify-center shrink-0">
          <Calendar size={22} className="text-text-disabled" />
        </button>

        {/* Settings icon */}
        <button onClick={() => navigate('/settings')}
          className="w-12 h-12 flex items-center justify-center shrink-0">
          <Settings size={22} className="text-text-disabled" />
        </button>
      </div>

      {/* ── MESSAGES ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

        {/* Empty state */}
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 pb-10">
            <p className="text-5xl">👋</p>
            <p className="text-primary text-xl font-bold">Hello {profile.name || 'there'}!</p>
            {profile.education_level === 'University' && (
              <>
                <p className="text-text-disabled text-sm">Course: {profile.course || 'Not set'}</p>
                {profile.school && <p className="text-text-disabled text-sm">University: {profile.school}</p>}
              </>
            )}
            {profile.education_level === 'Professional' && (
              <p className="text-text-disabled text-sm">Profession: {profile.profession || 'Not set'}</p>
            )}
            {['S5', 'S6'].includes(profile.education_level) && (
              <p className="text-text-disabled text-sm">Combination: {profile.combination || 'Not set'}</p>
            )}
            {!['University', 'Professional'].includes(profile.education_level) && (
              <p className="text-text-disabled text-sm">Level: {profile.education_level}{profile.school ? ` • ${profile.school}` : ''}</p>
            )}
            <p className="text-text-disabled text-sm">District: {profile.district || 'Not set'}</p>
            <p className="text-primary font-semibold text-lg mt-2">What's on your mind today?</p>
          </div>
        )}

        {/* Messages */}
        {messages.map(msg => (
          <div key={msg.message_id}
            className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {msg.role === 'assistant' && <AIAvatar />}
            <div className="max-w-[78%]">
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-1 ml-0.5">
                  <span className="text-primary text-xs font-bold">TutorUG AI</span>
                  <span className="text-xs px-1 rounded" style={{ backgroundColor: 'rgba(255,184,0,0.15)', color: '#FFB800' }}>✦</span>
                  {/* Per-message speak/stop button */}
                  <button onClick={() => speakMessage(msg.message_id, msg.content)}
                    className="ml-auto text-text-disabled hover:text-primary transition-colors">
                    {speakingMsgId === msg.message_id
                      ? <Square size={12} style={{ color: '#EF4444' }} />
                      : <Volume2 size={12} />}
                  </button>
                </div>
              )}
              <div className={`px-4 py-3 ${msg.role === 'user'
                ? 'rounded-2xl rounded-br-sm text-ink text-sm font-medium'
                : 'rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl'}`}
                style={msg.role === 'user'
                  ? { background: 'linear-gradient(135deg, #F59E0B80, #D97706)' }
                  : { background: 'linear-gradient(135deg, #12122A, #1A1A3A)', border: '1px solid rgba(255,184,0,0.3)' }}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-invert prose-sm max-w-none text-text-white">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: '#1A1A1A' }}>{msg.content}</p>
                )}
              </div>
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-black text-xs"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#1A1A1A' }}>
                Me
              </div>
            )}
          </div>
        ))}

        {/* Thinking dots */}
        {loading && !streamingText && (
          <div className="flex items-end gap-2">
            <AIAvatar />
            <div className="px-4 py-3 rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl flex items-center gap-1"
              style={{ background: 'linear-gradient(135deg, #12122A, #1A1A3A)', border: '1px solid rgba(255,184,0,0.3)' }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </div>
        )}

        {/* Streaming */}
        {streamingText && (
          <div className="flex items-end gap-2">
            <AIAvatar />
            <div className="max-w-[78%]">
              <div className="flex items-center gap-1.5 mb-1 ml-0.5">
                <span className="text-primary text-xs font-bold">TutorUG AI</span>
                <span className="text-xs px-1 rounded" style={{ backgroundColor: 'rgba(255,184,0,0.15)', color: '#FFB800' }}>✦</span>
              </div>
              <div className="px-4 py-3 rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl"
                style={{ background: 'linear-gradient(135deg, #12122A, #1A1A3A)', border: '1px solid rgba(255,184,0,0.5)' }}>
                <div className="prose prose-invert prose-sm max-w-none text-text-white">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
                </div>
                <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── VOICE PLAYBACK BAR — shown when speaking ── */}
      {speakingMsgId && (
        <div className="px-4 py-2 flex items-center gap-3 shrink-0"
          style={{ background: 'rgba(26,26,58,0.95)', borderTop: '1px solid rgba(255,184,0,0.2)' }}>
          {/* Pulsing dot */}
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
          <span className="text-text-disabled text-xs flex-1">Speaking…</span>
          {/* Slow down */}
          <button onClick={() => changeRate(-0.25)}
            className="text-text-disabled hover:text-primary p-1">
            <ChevronDown size={16} />
          </button>
          {/* Rate label */}
          <span className="text-primary text-xs font-bold w-8 text-center">{speechRate.toFixed(1)}x</span>
          {/* Speed up */}
          <button onClick={() => changeRate(0.25)}
            className="text-text-disabled hover:text-primary p-1">
            <ChevronUp size={16} />
          </button>
          {/* Stop */}
          <button onClick={stopSpeaking}
            className="p-1" style={{ color: '#EF4444' }}>
            <Square size={16} />
          </button>
        </div>
      )}

      {/* ── INPUT BAR — matches Android gradient border ── */}
      <div className="px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 px-2 py-2 rounded-full"
          style={{ background: 'linear-gradient(135deg, #1A1A3A, #12122A)', border: '1.5px solid rgba(255,184,0,0.7)' }}>
          {/* Mic — Amber circle */}
          <button onClick={startVoice}
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: listening ? 'linear-gradient(135deg,#EF4444,#DC2626)' : 'linear-gradient(135deg,#F59E0B,#D97706)' }}>
            <Mic size={20} style={{ color: '#0A0A1F' }} />
          </button>

          {/* Attach file — matches Android AttachFile button */}
          <label className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 cursor-pointer"
            style={{ background: 'rgba(255,184,0,0.12)' }}>
            <Paperclip size={20} style={{ color: '#FFB800' }} />
            <input type="file" accept="*/*" className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) {
                  // Navigate to documents page with the file queued
                  // For now mirrors mobile: triggers document upload flow
                  alert(`File selected: ${file.name}\n\nTo upload and learn from documents, go to the Documents page.`)
                }
                e.target.value = ''
              }} />
          </label>

          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="Ask a question..."
            rows={1}
            className="flex-1 bg-transparent text-text-white placeholder-text-disabled resize-none outline-none text-sm max-h-24"
          />

          {/* Send — Violet circle */}
          <button onClick={sendMessage} disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: input.trim() && !loading ? 'linear-gradient(135deg,#7C3AED,#6D28D9)' : '#1A1A3A' }}>
            <Send size={18} className="text-text-white" />
          </button>
        </div>
      </div>

      {/* ── DRAWER OVERLAY ── */}
      {drawerOpen && (
        <>
          {/* Black overlay — matches Android black/65 */}
          <div className="fixed inset-0 bg-black/65 z-40" onClick={() => setDrawerOpen(false)} />

          {/* Drawer panel — 290px wide, matches Android */}
          <div className="fixed top-0 left-0 h-full w-72 bg-surface z-50 flex flex-col shadow-2xl">

            {/* ── PROFILE CARD — matches Android drawer header ── */}
            <div className="bg-gradient-to-r from-surface to-surface-var px-4 pt-10 pb-4">
              <div className="flex items-center gap-3 mb-3">
                {/* Avatar */}
                <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-2xl overflow-hidden shrink-0"
                  style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#0A0A1F' }}>
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />
                    : profile.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-text-white font-bold text-base truncate">{profile.name || 'Student'}</p>
                  <p className="text-text-disabled text-xs truncate">{profile.email}</p>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-white/10 mb-2" />

              {/* Education details — matches Android DrawerProfileRow */}
              {profile.education_level === 'University' && (
                <>
                  <DrawerRow label="Course" value={profile.course || '—'} />
                  {profile.school && <DrawerRow label="University" value={profile.school} />}
                </>
              )}
              {profile.education_level === 'Professional' && (
                <DrawerRow label="Profession" value={profile.profession || '—'} />
              )}
              {['S5', 'S6'].includes(profile.education_level) && (
                <>
                  <DrawerRow label="Combination" value={profile.combination || '—'} />
                  {profile.school && <DrawerRow label="School" value={profile.school} />}
                </>
              )}
              {!['University', 'Professional', 'S5', 'S6'].includes(profile.education_level) && profile.school && (
                <DrawerRow label="School" value={profile.school} />
              )}
            </div>

            {/* ── SCROLLABLE MIDDLE — New Chat + Subjects + History ── */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

              {/* New Chat button — Yellow/Amber gradient matches Android */}
              <button
                onClick={handleNewChat}
                className="w-full h-11 rounded-xl flex items-center justify-center gap-2 font-bold text-sm"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#0A0A1F' }}>
                <Plus size={18} /> New Chat
              </button>

              {/* Subjects — shown for non-University/Professional */}
              {subjects.length > 0 && (
                <div>
                  <p className="text-text-disabled text-xs font-bold uppercase tracking-wider mb-2">Subjects</p>
                  <div className="space-y-1 max-h-44 overflow-y-auto">
                    {subjects.map(s => (
                      <button key={s} onClick={() => startSubjectChat(s)}
                        className="w-full text-left px-3 py-2 rounded-xl text-sm transition-colors"
                        style={{
                          backgroundColor: currentSubject === s ? 'rgba(255,184,0,0.15)' : '#1A1A3A',
                          color: currentSubject === s ? '#FFB800' : '#C0C0D8',
                          fontWeight: currentSubject === s ? 600 : 400,
                        }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat History */}
              <div>
                <p className="text-text-disabled text-xs font-bold uppercase tracking-wider mb-2">Chat History</p>
                {sessions.length === 0 ? (
                  <p className="text-text-disabled text-xs py-2">No chat history yet.</p>
                ) : (
                  <div className="space-y-1 max-h-52 overflow-y-auto">
                    {sessions.map(s => (
                      <div key={s.session_id}>
                        {/* Delete confirm */}
                        {deleteConfirmId === s.session_id && (
                          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
                            <div className="bg-surface-var rounded-2xl p-5 w-full max-w-xs">
                              <p className="text-text-white font-bold mb-1">Delete Chat?</p>
                              <p className="text-text-disabled text-sm mb-4">This will permanently delete this chat and all its messages.</p>
                              <div className="flex gap-3">
                                <button onClick={() => setDeleteConfirmId(null)} className="flex-1 btn-secondary py-2 text-sm">Cancel</button>
                                <button onClick={() => confirmDeleteSession(s.session_id)} className="flex-1 bg-error text-white font-bold py-2 rounded-xl text-sm">Delete</button>
                              </div>
                            </div>
                          </div>
                        )}

                        <div onClick={() => selectSession(s)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer group transition-colors"
                          style={{ backgroundColor: currentSessionId === s.session_id ? 'rgba(255,184,0,0.1)' : '#1A1A3A' }}>
                          <div className="flex-1 min-w-0">
                            <p className="text-primary text-xs font-medium truncate">{s.subject || 'Chat'}</p>
                            {s.message_count > 0 && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full"
                                style={{ backgroundColor: 'rgba(255,184,0,0.15)', color: '#FFB800' }}>
                                {s.message_count}
                              </span>
                            )}
                          </div>
                          <button onClick={e => { e.stopPropagation(); setDeleteConfirmId(s.session_id) }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1">
                            <Trash2 size={13} className="text-error" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── BOTTOM BUTTONS — Settings, Timetable, Logout ── */}
            <div className="px-4 pb-6 pt-2 border-t border-outline space-y-1">
              <button onClick={() => { navigate('/meetings'); setDrawerOpen(false) }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-var transition-colors">
                <Video size={20} style={{ color: '#F59E0B' }} />
                <span className="text-text-disabled text-sm">Meetings</span>
              </button>
              <button onClick={() => { navigate('/rooms'); setDrawerOpen(false) }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-var transition-colors">
                <Users size={20} style={{ color: '#7C3AED' }} />
                <span className="text-text-disabled text-sm">Study Rooms</span>
              </button>
              <button onClick={() => { navigate('/podcast'); setDrawerOpen(false) }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-var transition-colors">
                <Mic size={20} style={{ color: '#EF4444' }} />
                <span className="text-text-disabled text-sm">AI Podcast</span>
              </button>
              <button onClick={() => { navigate('/settings'); setDrawerOpen(false) }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-var transition-colors">
                <Settings size={20} className="text-text-disabled" />
                <span className="text-text-disabled text-sm">Settings</span>
              </button>
              <button onClick={() => { navigate('/timetable'); setDrawerOpen(false) }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-var transition-colors">
                <Calendar size={20} style={{ color: '#F59E0B' }} />
                <span className="text-text-disabled text-sm">Study Timetable</span>
              </button>
              <button onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-error/10 transition-colors">
                <LogOut size={20} className="text-error" />
                <span className="text-error text-sm">Logout</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// DrawerProfileRow — matches Android DrawerProfileRow composable
function DrawerRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1 py-0.5">
      <span className="text-text-disabled text-xs font-medium">{label}:</span>
      <span className="text-text-disabled text-xs truncate">{value}</span>
    </div>
  )
}
