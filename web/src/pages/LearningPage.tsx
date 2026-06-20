import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Mic, Send } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuth } from '@/lib/AuthContext'
import { apiUrl } from '@/lib/api'
import { SUPABASE_ANON } from '@/lib/supabase'
import Logo from '@/components/Logo'
import type { DocumentSection, ChatMessage } from '@/types'

function AIAvatar() {
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-black text-xs text-white"
      style={{ background: 'linear-gradient(135deg, #F59E0B, #7C3AED)' }}>
      AI
    </div>
  )
}

function ThinkingDots() {
  return (
    <div className="flex items-end gap-2 py-2">
      <AIAvatar />
      <div className="ml-2 bg-surface rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl px-4 py-3 flex items-center gap-1">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </div>
  )
}

export default function LearningPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [sections, setSections] = useState<DocumentSection[]>([])
  const [sectionIndex, setSectionIndex] = useState(0)
  const [docId, setDocId] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [listening, setListening] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const storedSections = sessionStorage.getItem('learning_sections')
    const storedDocId = sessionStorage.getItem('learning_doc_id')
    const storedIndex = sessionStorage.getItem('learning_section_index')
    if (!storedSections || !storedDocId) { navigate('/documents'); return }
    setSections(JSON.parse(storedSections))
    setDocId(storedDocId)
    setSectionIndex(Number(storedIndex) || 0)
    // Clear messages when entering a new section
    setMessages([])
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText, loading])

  const currentSection = sections[sectionIndex]
  const aiHasExplained = messages.some(m => m.role === 'assistant')

  async function sendMessage(overrideText?: string) {
    const text = (overrideText || input).trim()
    if (!text || loading || !profile || !currentSection) return
    setInput('')

    const userMsg: ChatMessage = {
      message_id: crypto.randomUUID(), session_id: '', user_id: profile.user_id,
      role: 'user', content: text, token_count: 0, created_at: new Date().toISOString(),
    }
    setMessages(m => [...m, userMsg])
    setLoading(true)
    setStreamingText('')

    const res = await fetch(apiUrl('send-chat-message'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}` },
      body: JSON.stringify({
        sessionId: `learn-${docId}-${sectionIndex}`,
        message: text,
        userProfile: { name: profile.name, district: profile.district, educationLevel: profile.education_level, school: profile.school, course: profile.course, profession: profile.profession, combination: profile.combination },
        districtContext: `Student: ${profile.name}, District: ${profile.district}`,
        conversationHistory: messages.map(m => ({ role: m.role, content: m.content })),
        learningMode: true,
        sectionTitle: currentSection.title,
      }),
    })

    if (!res.ok || !res.body) { setLoading(false); return }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let full = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))
      for (const line of lines) {
        try {
          const data = JSON.parse(line.slice(6))
          if (data.token) { full += data.token; setStreamingText(t => t + data.token) }
          if (data.done) full = data.response || full
        } catch {}
      }
    }

    setStreamingText('')
    setMessages(m => [...m, {
      message_id: crypto.randomUUID(), session_id: '', user_id: profile.user_id,
      role: 'assistant', content: full, token_count: 0, created_at: new Date().toISOString(),
    }])
    setLoading(false)
  }

  function goToQuiz() {
    sessionStorage.setItem('quiz_section', JSON.stringify(currentSection))
    sessionStorage.setItem('quiz_section_index', String(sectionIndex))
    sessionStorage.setItem('quiz_total_sections', String(sections.length))
    sessionStorage.setItem('quiz_doc_id', docId)
    navigate('/quiz')
  }

  function startVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = 'en-GB'; rec.interimResults = false
    rec.onstart = () => setListening(true)
    rec.onend = () => setListening(false)
    rec.onresult = (e: any) => {
      const spoken = e.results[0][0].transcript
      setInput(spoken)
      textareaRef.current?.focus()
    }
    rec.start()
  }

  if (!currentSection) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-surface to-bg items-center">
      <div className="max-w-3xl mx-auto w-full flex flex-col h-full">

      {/* ── TOP BAR ── */}
      <div className="bg-gradient-to-r from-surface to-surface-var px-1 py-2 flex items-center gap-1 shrink-0">
        <button onClick={() => navigate('/documents')}
          className="w-12 h-12 flex items-center justify-center shrink-0">
          <ArrowLeft size={22} className="text-text-white" />
        </button>
        <Logo size="sm" />
        <div className="flex-1 min-w-0 ml-2">
          <p className="text-text-white font-bold text-sm truncate">{currentSection.title}</p>
          <p className="text-text-disabled text-xs">Section {sectionIndex + 1} of {sections.length}</p>
        </div>
        {/* Section progress dots */}
        <div className="flex items-center gap-1 pr-2 shrink-0">
          {sections.map((_, i) => (
            <div key={i} className="rounded-full transition-all"
              style={{
                width: i === sectionIndex ? 10 : 7,
                height: i === sectionIndex ? 10 : 7,
                backgroundColor: i < sectionIndex ? '#84CC16' : i === sectionIndex ? '#FFB800' : 'rgba(192,192,216,0.3)',
              }} />
          ))}
        </div>
      </div>

      {/* ── MESSAGES ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">

        {/* Section intro card */}
        <div className="flex items-end gap-2">
          <AIAvatar />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 ml-0.5">
              <span className="text-primary text-xs font-bold">TutorUG AI</span>
              <span className="text-primary text-xs px-1 py-0.5 rounded"
                style={{ backgroundColor: 'rgba(255,184,0,0.15)' }}>✦</span>
            </div>
            <div className="rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl px-4 py-3 max-w-xs md:max-w-2xl"
              style={{
                background: 'linear-gradient(135deg, #12122A, #1A1A3A)',
                border: '1px solid',
                borderColor: 'rgba(255,184,0,0.5)',
              }}>
              <p className="text-primary text-sm font-bold mb-2">Let's study: {currentSection.title}</p>
              <div className="prose prose-invert prose-sm max-w-none text-text-light">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {currentSection.content}
                </ReactMarkdown>
              </div>
              <p className="text-text-disabled text-xs mt-2">
                Feel free to ask me any questions about this section!
              </p>
            </div>
          </div>
        </div>

        {/* Chat messages */}
        {messages.map(msg => (
          <div key={msg.message_id}
            className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {msg.role === 'assistant' && <AIAvatar />}
            <div className={`max-w-xs md:max-w-2xl ${msg.role === 'assistant' ? '' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-1 ml-0.5">
                  <span className="text-primary text-xs font-bold">TutorUG AI</span>
                  <span className="text-primary text-xs px-1 py-0.5 rounded"
                    style={{ backgroundColor: 'rgba(255,184,0,0.15)' }}>✦</span>
                </div>
              )}
              <div className={`px-4 py-3 ${
                msg.role === 'user'
                  ? 'rounded-2xl rounded-br-sm text-ink font-medium text-sm'
                  : 'rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl'}`}
                style={msg.role === 'user'
                  ? { background: 'linear-gradient(135deg, #FFB800, #E6A500)' }
                  : {
                      background: 'linear-gradient(135deg, #12122A, #1A1A3A)',
                      border: '1px solid rgba(255,184,0,0.3)',
                    }}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-invert prose-sm max-w-none text-text-white">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Thinking dots */}
        {loading && !streamingText && <ThinkingDots />}

        {/* Streaming bubble */}
        {streamingText && (
          <div className="flex items-end gap-2">
            <AIAvatar />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1 ml-0.5">
                <span className="text-primary text-xs font-bold">TutorUG AI</span>
                <span className="text-primary text-xs px-1 py-0.5 rounded"
                  style={{ backgroundColor: 'rgba(255,184,0,0.15)' }}>✦</span>
              </div>
              <div className="rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl px-4 py-3 max-w-xs md:max-w-2xl"
                style={{
                  background: 'linear-gradient(135deg, #12122A, #1A1A3A)',
                  border: '1px solid rgba(255,184,0,0.5)',
                }}>
                <div className="prose prose-invert prose-sm max-w-none text-text-white">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
                </div>
                <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
              </div>
            </div>
          </div>
        )}

        {/* Quiz button — only after AI has responded */}
        {aiHasExplained && !loading && !streamingText && (
          <div className="rounded-2xl px-4 py-4 text-center"
            style={{ backgroundColor: 'rgba(255,184,0,0.06)' }}>
            <p className="text-text-disabled text-xs mb-3">
              When you feel ready, tell the AI you're done (e.g. "I understood", "I'm done") to go to the quiz — or tap below.
            </p>
            <button
              onClick={goToQuiz}
              className="w-full h-12 rounded-xl flex items-center justify-center gap-2 font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, #84CC16, #65A30D)', color: '#0A0A1F' }}>
              I'm Ready — Take Quiz
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── INPUT BAR ── */}
      <div className="px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 px-2 py-2 rounded-full"
          style={{
            background: 'linear-gradient(135deg, #1A1A3A, #12122A)',
            border: '1.5px solid',
            borderColor: 'rgba(255,184,0,0.7)',
          }}>
          <button
            onClick={startVoice}
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all"
            style={{
              background: listening
                ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                : 'linear-gradient(135deg, #F59E0B, #D97706)',
            }}>
            <Mic size={20} style={{ color: '#0A0A1F' }} />
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="Ask a question about this section..."
            rows={1}
            className="flex-1 bg-transparent text-text-white placeholder-text-disabled resize-none outline-none text-sm max-h-24"
          />

          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all"
            style={{
              background: input.trim() && !loading
                ? 'linear-gradient(135deg, #7C3AED, #6D28D9)'
                : 'linear-gradient(135deg, #1A1A3A, #1A1A3A)',
            }}>
            <Send size={18} className="text-text-white" />
          </button>
        </div>
      </div>
    </div>
    </div>
  )
}
