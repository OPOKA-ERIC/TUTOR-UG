import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Mic, Plus, Trash2, BookOpen, Loader2, Volume2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { SUPABASE_URL, SUPABASE_ANON } from '@/lib/supabase'
import { getSidebarSubjects } from '@/lib/constants'
import Layout from '@/components/Layout'
import Logo from '@/components/Logo'
import type { ChatSession, ChatMessage } from '@/types'

export default function ChatPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [listening, setListening] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const subjects = profile ? getSidebarSubjects(profile) : []

  useEffect(() => { if (profile) loadHistory() }, [profile])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, streamingText])

  async function loadHistory() {
    if (!profile) return
    const { data } = await supabase
      .from('chat_sessions')
      .select('*')
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
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', session.session_id)
      .order('created_at', { ascending: true })
    setMessages((data as ChatMessage[]) || [])
  }

  async function deleteSession(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation()
    await supabase.from('chat_messages').delete().eq('session_id', sessionId)
    await supabase.from('chat_sessions').delete().eq('session_id', sessionId)
    setSessions(s => s.filter(x => x.session_id !== sessionId))
    if (currentSessionId === sessionId) { setCurrentSessionId(null); setMessages([]) }
  }

  async function startSubjectChat(subject: string) {
    if (!profile) return
    setLoading(true)
    setMessages([])
    const sessionId = await createSession(subject)
    setCurrentSessionId(sessionId)
    setSessions(s => [{ session_id: sessionId, user_id: profile.user_id, subject,
      education_level: profile.education_level, title: subject, message_count: 0,
      started_at: new Date().toISOString(), last_message_at: new Date().toISOString(),
      document_id: null, section_index: 0 }, ...s])
    const introPrompt = `The student has just opened the ${subject} subject. Greet them warmly, briefly introduce what you can help them with in ${subject} at ${profile.education_level} level, and ask what specific topic they want to study today. Keep it short, friendly and encouraging.`
    await sendToAI(introPrompt, sessionId, [], true)
    setLoading(false)
  }

  async function sendMessage() {
    if (!input.trim() || loading || !profile) return
    const text = input.trim()
    setInput('')

    let sessionId = currentSessionId
    if (!sessionId) {
      sessionId = await createSession('General')
      setCurrentSessionId(sessionId)
      setSessions(s => [{ session_id: sessionId!, user_id: profile.user_id, subject: 'General',
        education_level: profile.education_level, title: 'General', message_count: 0,
        started_at: new Date().toISOString(), last_message_at: new Date().toISOString(),
        document_id: null, section_index: 0 }, ...s])
    }

    const userMsg: ChatMessage = {
      message_id: crypto.randomUUID(), session_id: sessionId, user_id: profile.user_id,
      role: 'user', content: text, token_count: 0, created_at: new Date().toISOString(),
    }
    setMessages(m => [...m, userMsg])
    await sendToAI(text, sessionId, [...messages, userMsg])
  }

  async function sendToAI(message: string, sessionId: string, history: ChatMessage[], hideUserMsg = false) {
    if (!profile) return
    setLoading(true)
    setStreamingText('')

    const districtContext = `Student: ${profile.name}, District: ${profile.district}, Level: ${profile.education_level}`
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-chat-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}` },
      body: JSON.stringify({
        sessionId, message,
        userProfile: { name: profile.name, district: profile.district, educationLevel: profile.education_level, school: profile.school, course: profile.course, profession: profile.profession, combination: profile.combination },
        districtContext,
        conversationHistory: history.map(m => ({ role: m.role, content: m.content })),
        learningMode: false, sectionTitle: '',
      }),
    })

    if (!res.ok || !res.body) { setLoading(false); return }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let full = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
      for (const line of lines) {
        try {
          const data = JSON.parse(line.slice(6))
          if (data.token) { full += data.token; setStreamingText(t => t + data.token) }
          if (data.done) full = data.response || full
        } catch {}
      }
    }

    setStreamingText('')
    const aiMsg: ChatMessage = {
      message_id: crypto.randomUUID(), session_id: sessionId, user_id: profile.user_id,
      role: 'assistant', content: full, token_count: 0, created_at: new Date().toISOString(),
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

  function speak(text: string) {
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = 'en-GB'
    window.speechSynthesis.speak(utt)
  }

  return (
    <Layout>
      <div className="flex h-full overflow-hidden">
        {/* ── Chat history sidebar ── */}
        <div className="w-64 bg-surface border-r border-outline flex flex-col shrink-0">
          <div className="p-3 border-b border-outline">
            <button onClick={() => { setCurrentSessionId(null); setMessages([]) }}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2 text-sm">
              <Plus size={16} /> New Chat
            </button>
          </div>

          {/* Subjects */}
          {subjects.length > 0 && (
            <div className="p-3 border-b border-outline">
              <p className="text-text-disabled text-xs font-semibold uppercase mb-2">Subjects</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {subjects.map(s => (
                  <button key={s} onClick={() => startSubjectChat(s)}
                    className="w-full text-left text-sm text-text-light hover:text-primary hover:bg-primary/5 px-2 py-1.5 rounded-lg transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* History */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <p className="text-text-disabled text-xs font-semibold uppercase px-2 py-1">History</p>
            {sessions.map(s => (
              <div key={s.session_id}
                onClick={() => selectSession(s)}
                className={`group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors ${currentSessionId === s.session_id ? 'bg-primary/10 border border-primary/20' : 'hover:bg-surface-var'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-text-white text-xs font-medium truncate">{s.subject || 'Chat'}</p>
                  <p className="text-text-disabled text-xs">{s.message_count} msgs</p>
                </div>
                <button onClick={e => deleteSession(s.session_id, e)}
                  className="opacity-0 group-hover:opacity-100 text-error hover:text-error p-1 rounded transition-opacity">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Chat area ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <div className="bg-grad-bar border-b border-outline px-5 py-3 flex items-center gap-3 shrink-0">
            <Logo size="sm" />
            <div className="h-5 w-px bg-outline" />
            <span className="text-text-light text-sm">
              {sessions.find(s => s.session_id === currentSessionId)?.subject || 'AI Tutor'}
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-4 opacity-60">
                <BookOpen size={48} className="text-primary" />
                <div>
                  <p className="text-text-white font-semibold">Start a conversation</p>
                  <p className="text-text-disabled text-sm mt-1">Pick a subject from the sidebar or type your question below</p>
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.message_id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-primary text-ink' : 'bg-surface-var text-text-white'}`}>
                  {msg.role === 'assistant' ? (
                    <div className="flex items-start gap-2">
                      <div className="prose prose-invert prose-sm max-w-none flex-1">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                      <button onClick={() => speak(msg.content)} className="text-text-disabled hover:text-primary mt-1 shrink-0">
                        <Volume2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Streaming */}
            {streamingText && (
              <div className="flex justify-start">
                <div className="max-w-[75%] bg-surface-var rounded-2xl px-4 py-3">
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
                  </div>
                  <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-1 align-middle" />
                </div>
              </div>
            )}

            {loading && !streamingText && (
              <div className="flex justify-start">
                <div className="bg-surface-var rounded-2xl px-4 py-3 flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-primary" />
                  <span className="text-text-disabled text-sm">TutorUG is thinking...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-outline p-4 shrink-0">
            <div className="flex items-end gap-3 bg-surface-input rounded-2xl px-4 py-3 border border-outline focus-within:border-primary transition-colors">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Ask TutorUG anything..."
                rows={1}
                className="flex-1 bg-transparent text-text-white placeholder-text-disabled resize-none outline-none text-sm max-h-32"
              />
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={startVoice}
                  className={`p-2 rounded-xl transition-colors ${listening ? 'bg-error/20 text-error' : 'text-text-disabled hover:text-primary hover:bg-primary/10'}`}>
                  <Mic size={18} />
                </button>
                <button onClick={sendMessage} disabled={!input.trim() || loading}
                  className="p-2 bg-primary text-ink rounded-xl hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
