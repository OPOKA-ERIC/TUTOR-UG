import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Menu, Send, Mic, Plus, Loader2, Volume2, Paperclip,
  Square, ChevronUp, ChevronDown, Video, Users,
  PanelLeftOpen, Calendar, Settings, MessageSquare
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuth } from '@/lib/AuthContext'
import { useSettings } from '@/lib/SettingsContext'
import { useTimetable } from '@/lib/TimetableContext'
import { supabase } from '@/lib/supabase'
import { apiUrl, apiHeaders } from '@/lib/api'
import { getSidebarSubjects } from '@/lib/constants'
import ChatSidebar, { subjectMeta } from '@/components/ChatSidebar'
import ChatHistoryModal from '@/components/ChatHistoryModal'
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

const TOPIC_CHIPS = ['Understand a concept', 'Work through problems', 'Prepare for exams']

const K_SESSION = 'tutorug:currentSessionId'
const K_SIDEBAR = 'tutorug:sidebarOpen'
const K_SUBJECTS = 'tutorug:subjectsOpen'
const K_RATE = 'tutorug:speechRate'

function formatMessageTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return d.toDateString() === now.toDateString()
    ? time
    : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`
}

export default function ChatPage() {
  const { profile, logout } = useAuth()
  const { openSettings } = useSettings()
  const { openTimetable } = useTimetable()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(() => sessionStorage.getItem(K_SIDEBAR) !== 'collapsed')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => sessionStorage.getItem(K_SESSION))
  const [currentSubject, setCurrentSubject] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [listening, setListening] = useState(false)
  const [subjectsOpen, setSubjectsOpen] = useState(() => sessionStorage.getItem(K_SUBJECTS) === 'open')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null)
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const [speechRate, setSpeechRate] = useState(() => parseFloat(sessionStorage.getItem(K_RATE) || '1.0'))
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const didRestoreRef = useRef(false)
  const subjects = profile ? getSidebarSubjects(profile) : []

  const subjectCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const se of sessions) {
      const k = (se.subject || '').trim()
      if (!k || /^general$/i.test(k)) continue
      map[k] = (map[k] || 0) + 1
    }
    return map
  }, [sessions])

  // context label shown in top bar — matches Android contextLabel
  const contextLabel = !profile ? '' :
    profile.education_level === 'University' ? (profile.course || 'University') :
    profile.education_level === 'Professional' ? (profile.profession || 'Professional') :
    ['S5', 'S6'].includes(profile.education_level)
      ? `${profile.education_level} • ${profile.combination || 'A-Level'}`
      : profile.education_level

  useEffect(() => { if (profile) loadHistory() }, [profile])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, streamingText])
  useEffect(() => { return () => abortRef.current?.abort() }, [])
  useEffect(() => {
    if (currentSessionId) sessionStorage.setItem(K_SESSION, currentSessionId)
    else sessionStorage.removeItem(K_SESSION)
  }, [currentSessionId])
  useEffect(() => { sessionStorage.setItem(K_SIDEBAR, sidebarOpen ? 'open' : 'collapsed') }, [sidebarOpen])
  useEffect(() => { sessionStorage.setItem(K_SUBJECTS, subjectsOpen ? 'open' : 'collapsed') }, [subjectsOpen])
  useEffect(() => {
    const n = parseFloat(speechRate.toFixed(2))
    sessionStorage.setItem(K_RATE, String(n))
  }, [speechRate])

  async function loadHistory() {
    if (!profile) return
    setHistoryLoading(true)
    const { data } = await supabase
      .from('chat_sessions').select('*')
      .eq('user_id', profile.user_id)
      .is('document_id', null)
      .order('last_message_at', { ascending: false })
      .limit(50)
    const list: ChatSession[] = ((data as ChatSession[]) || []).map(s => ({ ...s, first_message: undefined }))
    if (list.length) {
      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('session_id, content, role, created_at')
        .in('session_id', list.map(s => s.session_id))
        .eq('role', 'user')
        .order('created_at', { ascending: true })
      const firstBySession: Record<string, string> = {}
      for (const m of (msgs as { session_id: string; content: string }[]) || []) {
        if (!(m.session_id in firstBySession)) firstBySession[m.session_id] = m.content
      }
      list.forEach(s => { s.first_message = firstBySession[s.session_id] })
    }
    setSessions(list)
    setHistoryLoading(false)

    const restoreId = sessionStorage.getItem(K_SESSION)
    if (restoreId && !didRestoreRef.current) {
      const target = list.find(s => s.session_id === restoreId)
      if (target) {
        didRestoreRef.current = true
        await selectSession(target)
      } else {
        sessionStorage.removeItem(K_SESSION)
      }
    }
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
    setShowQuickReplies(false)
    setMobileOpen(false)
  }

  async function confirmDeleteSession(sessionId: string) {
    await supabase.from('chat_messages').delete().eq('session_id', sessionId)
    await supabase.from('chat_sessions').delete().eq('session_id', sessionId)
    setSessions(s => s.filter(x => x.session_id !== sessionId))
    if (currentSessionId === sessionId) { setCurrentSessionId(null); setMessages([]) }
  }

  async function renameSession(sessionId: string, title: string) {
    const clean = title.trim().slice(0, 120)
    if (!clean) return
    await supabase.from('chat_sessions').update({ title: clean }).eq('session_id', sessionId)
    setSessions(s => s.map(x => x.session_id === sessionId ? { ...x, title: clean } : x))
  }

  async function startSubjectChat(subject: string) {
    if (!profile) return
    setMobileOpen(false)
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
    const level = profile.education_level || 'unknown level'
const combo = ['S5', 'S6'].includes(profile.education_level) && profile.combination ? ` They study ${profile.combination}.` : ''
const introPrompt = `This student is at the exact level "${level}" (from their profile record).${combo} They just opened the ${subject} subject. Reply with exactly this structure, keeping it very short and warm:
Line 1: one short friendly greeting.
Line 2: "What would you like to do today?"
Then a markdown bullet list with exactly these three options:
- Understand a concept
- Work through problems
- Prepare for exams
No other text, no long intro, no extra questions. Never refer to any level other than "${level}".`
    await sendToAI(introPrompt, sessionId, [], true)
    setLoading(false)
    setShowQuickReplies(true)
  }

  function handleNewChat() {
    setCurrentSessionId(null)
    setMessages([])
    setCurrentSubject('')
    setShowQuickReplies(false)
    setMobileOpen(false)
  }

  async function submitMessage(value: string) {
    if (!value.trim() || loading || !profile) return
    setShowQuickReplies(false)
    const text = value.trim()

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

  async function sendMessage() {
    if (!input.trim() || loading || !profile) return
    const text = input.trim()
    setInput('')
    await submitMessage(text)
  }

  async function sendToAI(message: string, sessionId: string, history: ChatMessage[], hideUserMsg = false) {
    if (!profile) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setStreamingText('')

    let full = ''

    try {
      const res = await fetch(apiUrl('send-chat-message'), {
        method: 'POST',
        signal: controller.signal,
        headers: await apiHeaders(),
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

      // Only proceed if this request is still the active one
      if (controller.signal.aborted) return
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      const aiErr: ChatMessage = {
        message_id: crypto.randomUUID(), session_id: sessionId,
        user_id: profile.user_id, role: 'assistant', content: '⚠️ Connection error. Please try again.',
        token_count: 0, created_at: new Date().toISOString(),
      }
      setMessages(m => [...m, aiErr])
      setLoading(false)
      return
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

  const isMobile = () => window.innerWidth < 768

  function renderInputBar() {
    return (
      <div className="flex items-center gap-2 px-2 py-2 rounded-full"
        style={{ background: 'linear-gradient(135deg, #1A1A3A, #12122A)', border: '1.5px solid rgba(255,184,0,0.7)' }}>
        <button onClick={startVoice} title="Voice input" aria-label="Voice input"
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0"
          style={{ background: listening ? 'linear-gradient(135deg,#EF4444,#DC2626)' : 'linear-gradient(135deg,#F59E0B,#D97706)' }}>
          <Mic size={20} style={{ color: '#0A0A1F' }} />
        </button>
        <label title="Attach a file" aria-label="Attach a file"
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 cursor-pointer"
          style={{ background: 'rgba(255,184,0,0.12)' }}>
          <Paperclip size={20} style={{ color: '#FFB800' }} />
          <input type="file" accept="*/*" className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) alert(`File selected: ${file.name}\n\nTo upload and learn from documents, go to the Documents page.`)
              e.target.value = ''
            }} />
        </label>
        <textarea
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder="Ask a question..." rows={1}
          className="flex-1 bg-transparent text-text-white placeholder-text-disabled resize-none outline-none text-sm max-h-24" />
        <button onClick={sendMessage} disabled={!input.trim() || loading}
          title="Send message" aria-label="Send message"
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0"
          style={{ background: input.trim() && !loading ? 'linear-gradient(135deg,#7C3AED,#6D28D9)' : '#1A1A3A' }}>
          <Send size={18} className="text-text-white" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full bg-gradient-to-b from-surface to-bg relative overflow-hidden">
      <div className="w-full h-full flex">

      {/* ── DESKTOP SIDEBAR (inline, does not cover chat) ── */}
      <aside className={`${sidebarOpen ? 'w-72' : 'w-16'} transition-all duration-300 shrink-0 hidden md:flex flex-col border-r border-outline`}>
        {sidebarOpen ? (
          <ChatSidebar
            profile={profile}
            subjects={subjects}
            subjectsOpen={subjectsOpen}
            currentSubject={currentSubject}
            historyOpen={historyOpen}
            subjectCounts={subjectCounts}
            onSubjectsToggle={() => setSubjectsOpen(v => !v)}
            onNewChat={handleNewChat}
            onStartSubjectChat={startSubjectChat}
            onNavigate={p => navigate(p)}
            onOpenTimetable={openTimetable}
            onOpenSettings={openSettings}
            onOpenHistory={() => setHistoryOpen(true)}
            onLogout={handleLogout}
            onCollapse={() => setSidebarOpen(false)}
            onClose={() => setMobileOpen(false)}
            isMobile={false}
          />
        ) : (
          /* ── COLLAPSED ICON BAR ── */
          <div className="w-16 h-full bg-surface flex flex-col items-center py-3 gap-5 shrink-0">
            <button onClick={() => setSidebarOpen(true)}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10 hover:text-primary transition-colors"
              title="Expand sidebar" aria-label="Expand sidebar">
              <PanelLeftOpen size={20} className="text-text-disabled" />
            </button>

            <button onClick={() => setSidebarOpen(true)}
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm overflow-hidden shrink-0"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#0A0A1F' }}
              title="Profile">
              {profile.avatar_url
                ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />
                : profile.name.charAt(0).toUpperCase()}
            </button>

            <div className="w-8 h-px bg-white/10" />

            <button onClick={handleNewChat}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
              title="New Chat" aria-label="New Chat">
              <Plus size={20} style={{ color: '#F59E0B' }} />
            </button>

            <button onClick={() => { navigate('/meetings') }}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
              title="Meetings" aria-label="Meetings">
              <Video size={20} style={{ color: '#F59E0B' }} />
            </button>

            <button onClick={() => { navigate('/rooms') }}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
              title="Study Rooms" aria-label="Study Rooms">
              <Users size={20} style={{ color: '#7C3AED' }} />
            </button>

            <button onClick={() => { navigate('/podcast') }}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
              title="AI Podcast" aria-label="AI Podcast">
              <Mic size={20} style={{ color: '#EF4444' }} />
            </button>

            <button onClick={() => { openTimetable() }}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
              title="Study Timetable" aria-label="Study Timetable">
              <Calendar size={20} style={{ color: '#F59E0B' }} />
            </button>

            <button onClick={() => { openSettings() }}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
              title="Settings" aria-label="Settings">
              <Settings size={20} className="text-text-disabled" />
            </button>

            <button onClick={() => setHistoryOpen(true)}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
              title="Chat History" aria-label="Chat History">
              <MessageSquare size={20} className="text-text-disabled" />
            </button>
          </div>
        )}
      </aside>

      {/* ── MAIN CHAT AREA ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── TOP BAR ── */}
        <div className="bg-gradient-to-r from-surface to-surface-var px-2 py-1.5 flex items-center gap-2 shrink-0 z-10">
          {isMobile() && (
            <button onClick={() => setMobileOpen(true)}
              className="w-12 h-12 flex items-center justify-center shrink-0 -ml-1">
              <Menu size={24} className="text-text-white" />
            </button>
          )}
          {currentSubject && currentSubject !== 'General' ? (() => {
            const meta = subjectMeta(currentSubject)
            const Icon = meta.icon
            return (
              <div className="min-w-0 flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: `${meta.color}1F` }}>
                  <Icon size={16} style={{ color: meta.color }} />
                </span>
                <div className="min-w-0 leading-tight">
                  <p className="text-sm font-bold truncate max-w-[200px]" style={{ color: '#FFB800' }}>{currentSubject}</p>
                  <p className="text-[10px] tracking-widest uppercase hidden sm:block" style={{ color: '#9A9AC4' }}>Mode</p>
                </div>
              </div>
            )
          })() : (
            <p className="text-sm font-bold text-text-white">Chat</p>
          )}
          {contextLabel && (
            <span className="ml-auto hidden md:inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#A3A3C8' }}>
              {contextLabel}
            </span>
          )}
        </div>

        {/* ── EMPTY STATE or MESSAGES ── */}
        {messages.length === 0 && !loading && !streamingText ? (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 pb-8">
            <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-5">
              <div className="text-center">
                <p className="text-5xl mb-3">👋</p>
                <p className="text-primary text-xl font-bold">Hello {profile.name || 'there'}!</p>
                {profile.education_level === 'University' && (
                  <><p className="text-text-disabled text-sm">Course: {profile.course || 'Not set'}</p>{profile.school && <p className="text-text-disabled text-sm">University: {profile.school}</p>}</>
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
                {historyLoading ? (
                  <div className="flex items-center justify-center gap-2 text-sm mt-3" style={{ color: '#8E8EBB' }}>
                    <Loader2 size={15} className="animate-spin" /> Loading your conversations…
                  </div>
                ) : (
                  <>
                    <p className="text-primary font-semibold text-lg mt-3">What's on your mind today?</p>
                    {sessions.length === 0 && (
                      <p className="text-text-disabled text-sm mt-1">No conversations yet — start typing below.</p>
                    )}
                  </>
                )}
              </div>
              <div className="w-full">
                {renderInputBar()}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-6 pb-4">
            <div className="mx-auto w-full max-w-[700px] space-y-3">
              {messages.map(msg => (
                <div key={msg.message_id}
                  className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse justify-start' : 'flex-row'}`}>
                  {msg.role === 'assistant' && <AIAvatar />}
                  <div className={`${msg.role === 'user' ? 'max-w-[75%]' : 'max-w-[78%]'}`}>
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-1.5 mb-1 ml-0.5">
                        <span className="text-primary text-xs font-bold">TutorUG AI</span>
                        <span className="text-xs px-1 rounded" style={{ backgroundColor: 'rgba(255,184,0,0.15)', color: '#FFB800' }}>✦</span>
                        <button onClick={() => speakMessage(msg.message_id, msg.content)}
                          className="ml-auto text-text-disabled hover:text-primary transition-colors">
                          {speakingMsgId === msg.message_id ? <Square size={12} style={{ color: '#EF4444' }} /> : <Volume2 size={12} />}
                        </button>
                      </div>
                    )}
                    <div className={`px-4 py-3 ${msg.role === 'user' ? 'rounded-2xl rounded-br-sm text-ink text-sm font-medium' : 'rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl'}`}
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
                    <p className={`text-[10px] mt-1 px-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}
                      style={{ color: '#9A9AC4' }}>
                      {formatMessageTime(msg.created_at)}
                    </p>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-black text-xs"
                      style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#1A1A1A' }}>Me</div>
                  )}
                </div>
              ))}
              {!currentSubject && showQuickReplies && !loading && !streamingText && subjects.slice(0, 4).length > 0 && (
                <div className="flex items-start gap-2">
                  <AIAvatar />
                  <div className="flex flex-col items-start gap-1.5 pt-0.5">
                    {subjects.slice(0, 4).map(s => (
                      <button key={s} onClick={() => startSubjectChat(s)}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold hover:opacity-80 transition-opacity"
                        style={{ background: 'rgba(255,184,0,0.12)', border: '1px solid rgba(255,184,0,0.35)', color: '#FFB800' }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {showQuickReplies && !loading && !streamingText && (
                <div className="flex items-start gap-2">
                  <AIAvatar />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {TOPIC_CHIPS.map(t => (
                      <button key={t} onClick={() => submitMessage(t)}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold hover:opacity-80 transition-opacity"
                        style={{ background: 'rgba(26,26,58,0.6)', border: '1px solid rgba(255,255,255,0.18)', color: '#C0C0D8' }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {loading && !streamingText && (
                <div className="flex items-end gap-2">
                  <AIAvatar />
                  <div className="px-4 py-3 rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl flex items-center gap-1"
                    style={{ background: 'linear-gradient(135deg, #12122A, #1A1A3A)', border: '1px solid rgba(255,184,0,0.3)' }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </div>
                </div>
              )}
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
          </div>
        )}

        {/* ── VOICE PLAYBACK BAR ── */}
        {speakingMsgId && (
          <div className="px-4 py-2 flex items-center gap-3 shrink-0 relative z-10"
            style={{ background: 'rgba(26,26,58,0.95)', borderTop: '1px solid rgba(255,184,0,0.2)' }}>
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
            <span className="text-text-disabled text-xs flex-1">Speaking…</span>
            <button onClick={() => changeRate(-0.25)} className="text-text-disabled hover:text-primary p-1"><ChevronDown size={16} /></button>
            <span className="text-primary text-xs font-bold w-8 text-center">{speechRate.toFixed(1)}x</span>
            <button onClick={() => changeRate(0.25)} className="text-text-disabled hover:text-primary p-1"><ChevronUp size={16} /></button>
            <button onClick={stopSpeaking} className="p-1" style={{ color: '#EF4444' }}><Square size={16} /></button>
          </div>
        )}

        {/* ── INPUT BAR (bottom) ── */}
        {(messages.length > 0 || loading || streamingText) && (
          <div className="px-4 py-3 shrink-0 relative z-10">
            {renderInputBar()}
          </div>
        )}
      </div>

      {/* ── MOBILE OVERLAY SIDEBAR ── */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/65 z-40" onClick={() => setMobileOpen(false)} />
          <div className="fixed top-0 left-0 h-full w-72 z-50 shadow-2xl">
            <ChatSidebar
              profile={profile}
              subjects={subjects}
              subjectsOpen={subjectsOpen}
              currentSubject={currentSubject}
              historyOpen={historyOpen}
              subjectCounts={subjectCounts}
              onSubjectsToggle={() => setSubjectsOpen(v => !v)}
              onNewChat={handleNewChat}
              onStartSubjectChat={startSubjectChat}
              onNavigate={p => { navigate(p); setMobileOpen(false) }}
              onOpenTimetable={() => { openTimetable(); setMobileOpen(false) }}
              onOpenSettings={() => { openSettings(); setMobileOpen(false) }}
              onOpenHistory={() => { setHistoryOpen(true); setMobileOpen(false) }}
              onLogout={handleLogout}
              onCollapse={() => setSidebarOpen(false)}
              onClose={() => setMobileOpen(false)}
              isMobile
            />
          </div>
        </>
      )}

      {historyOpen && (
        <ChatHistoryModal
          sessions={sessions}
          currentSessionId={currentSessionId}
          historyLoading={historyLoading}
          onSelect={s => { selectSession(s); setHistoryOpen(false) }}
          onDelete={confirmDeleteSession}
          onRename={renameSession}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
    </div>
  )
}