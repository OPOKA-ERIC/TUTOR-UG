import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Send, Mic, MicOff, ChevronRight, Volume2, VolumeX,
  Loader2, ArrowLeft, BookOpen, CheckCircle
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuth } from '@/lib/AuthContext'
import { SUPABASE_URL, SUPABASE_ANON } from '@/lib/supabase'
import Layout from '@/components/Layout'
import Logo from '@/components/Logo'
import type { DocumentSection, ChatMessage } from '@/types'

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
  const [speaking, setSpeaking] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const storedSections = sessionStorage.getItem('learning_sections')
    const storedDocId = sessionStorage.getItem('learning_doc_id')
    if (!storedSections || !storedDocId) { navigate('/documents'); return }
    const parsed = JSON.parse(storedSections) as DocumentSection[]
    setSections(parsed)
    setDocId(storedDocId)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  // Reset messages when section changes
  useEffect(() => {
    setMessages([])
    setStreamingText('')
  }, [sectionIndex])

  const currentSection = sections[sectionIndex]

  async function sendMessage(overrideText?: string) {
    const text = (overrideText || input).trim()
    if (!text || loading || !profile || !currentSection) return
    setInput('')

    const userMsg: ChatMessage = {
      message_id: crypto.randomUUID(),
      session_id: '',
      user_id: profile.user_id,
      role: 'user',
      content: text,
      token_count: 0,
      created_at: new Date().toISOString(),
    }
    setMessages(m => [...m, userMsg])
    setLoading(true)
    setStreamingText('')

    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-chat-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`,
      },
      body: JSON.stringify({
        sessionId: `learn-${docId}-${sectionIndex}`,
        message: text,
        userProfile: {
          name: profile.name,
          district: profile.district,
          educationLevel: profile.education_level,
          school: profile.school,
          course: profile.course,
          profession: profile.profession,
          combination: profile.combination,
        },
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
    const aiMsg: ChatMessage = {
      message_id: crypto.randomUUID(),
      session_id: '',
      user_id: profile.user_id,
      role: 'assistant',
      content: full,
      token_count: 0,
      created_at: new Date().toISOString(),
    }
    setMessages(m => [...m, aiMsg])
    setLoading(false)
  }

  function goToQuiz() {
    sessionStorage.setItem('quiz_section', JSON.stringify(currentSection))
    sessionStorage.setItem('quiz_section_index', String(sectionIndex))
    sessionStorage.setItem('quiz_total_sections', String(sections.length))
    sessionStorage.setItem('quiz_doc_id', docId)
    navigate('/quiz')
  }

  function reExplain() {
    sendMessage(`Please re-explain this section "${currentSection.title}" in a completely different way with new examples from ${profile?.district || 'Uganda'}.`)
  }

  function speak(text: string) {
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return }
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = 'en-GB'
    utt.onend = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(utt)
  }

  function startVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = 'en-GB'
    rec.interimResults = false
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
      <Loader2 size={32} className="animate-spin text-primary" />
    </div>
  )

  return (
    <Layout>
      <div className="flex h-full overflow-hidden">

        {/* ── Sections Sidebar ── */}
        <div className="w-60 bg-surface border-r border-outline flex flex-col shrink-0">
          <div className="p-3 border-b border-outline">
            <button
              onClick={() => navigate('/documents')}
              className="flex items-center gap-1.5 text-text-disabled text-sm hover:text-text-light transition-colors">
              <ArrowLeft size={14} /> Back to Documents
            </button>
          </div>

          <div className="p-3 border-b border-outline">
            <p className="text-text-disabled text-xs font-bold uppercase tracking-wider">
              {sections.length} Sections
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sections.map((s, i) => (
              <div
                key={s.section_id}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all
                  ${i === sectionIndex
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : s.quiz_passed
                    ? 'text-lime hover:bg-lime/5 cursor-pointer'
                    : i < sectionIndex
                    ? 'text-text-light hover:bg-surface-var cursor-pointer'
                    : 'text-text-disabled'}`}
                onClick={() => i <= sectionIndex && setSectionIndex(i)}>
                <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs shrink-0
                  ${i === sectionIndex ? 'border-primary' : s.quiz_passed ? 'border-lime bg-lime/10' : 'border-current'}`}>
                  {s.quiz_passed ? <CheckCircle size={12} /> : i + 1}
                </div>
                <span className="truncate font-medium">{s.title}</span>
              </div>
            ))}
          </div>

          {/* Re-explain button */}
          <div className="p-3 border-t border-outline">
            <button
              onClick={reExplain}
              disabled={loading}
              className="w-full btn-secondary text-xs py-2 flex items-center justify-center gap-1.5">
              <BookOpen size={13} /> Re-explain Section
            </button>
          </div>
        </div>

        {/* ── Main Chat Area ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Top bar */}
          <div className="bg-grad-bar border-b border-outline px-5 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <Logo size="sm" />
              <div className="h-5 w-px bg-outline" />
              <div>
                <p className="text-text-white font-semibold text-sm">{currentSection.title}</p>
                <p className="text-text-disabled text-xs">
                  Section {sectionIndex + 1} of {sections.length}
                </p>
              </div>
            </div>

            {/* Progress dots */}
            <div className="flex items-center gap-1.5">
              {sections.map((s, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all ${
                    s.quiz_passed ? 'w-3.5 h-3.5 bg-lime' :
                    i === sectionIndex ? 'w-3.5 h-3.5 bg-primary' :
                    'w-2.5 h-2.5 bg-outline'}`}
                />
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* Section intro card — shown when no messages yet */}
            {messages.length === 0 && (
              <div className="card bg-secondary/5 border-secondary/20 animate-fade-in">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen size={16} className="text-secondary" />
                  <p className="text-secondary text-xs font-bold uppercase tracking-wider">
                    {currentSection.title}
                  </p>
                </div>
                <div className="prose prose-invert prose-sm max-w-none text-text-light">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {currentSection.content.slice(0, 800) +
                      (currentSection.content.length > 800 ? '\n\n*...click "Take Quiz" when you\'re ready or ask me questions below.*' : '')}
                  </ReactMarkdown>
                </div>
                <p className="text-text-disabled text-xs mt-4 border-t border-outline/50 pt-3">
                  💡 Ask questions about this section below, then click <strong className="text-primary">Take Quiz</strong> when you're ready.
                </p>
              </div>
            )}

            {/* Chat messages */}
            {messages.map(msg => (
              <div
                key={msg.message_id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[78%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-primary text-ink'
                    : 'bg-surface-var text-text-white'}`}>
                  {msg.role === 'assistant' ? (
                    <div className="flex items-start gap-2">
                      <div className="prose prose-invert prose-sm max-w-none flex-1">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                      <button
                        onClick={() => speak(msg.content)}
                        className="text-text-disabled hover:text-primary mt-1 shrink-0 transition-colors">
                        {speaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
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
                <div className="max-w-[78%] bg-surface-var rounded-2xl px-4 py-3">
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
                  </div>
                  <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-1 align-middle rounded-sm" />
                </div>
              </div>
            )}

            {loading && !streamingText && (
              <div className="flex justify-start">
                <div className="bg-surface-var rounded-2xl px-4 py-3 flex items-center gap-2">
                  <Loader2 size={15} className="animate-spin text-primary" />
                  <span className="text-text-disabled text-sm">TutorUG is thinking...</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-outline p-4 shrink-0 space-y-3 bg-surface/50">

            {/* Take Quiz button */}
            <button
              onClick={goToQuiz}
              className="w-full bg-grad-lime text-ink font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99] transition-all">
              <CheckCircle size={17} />
              Take Quiz for This Section
              <ChevronRight size={17} />
            </button>

            {/* Text input */}
            <div className="flex items-end gap-2 bg-surface-input rounded-2xl px-4 py-3 border border-outline focus-within:border-primary transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
                }}
                placeholder="Ask a question about this section..."
                rows={1}
                className="flex-1 bg-transparent text-text-white placeholder-text-disabled resize-none outline-none text-sm max-h-28"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={startVoice}
                  className={`p-2 rounded-xl transition-colors ${
                    listening
                      ? 'bg-error/20 text-error animate-pulse'
                      : 'text-text-disabled hover:text-primary hover:bg-primary/10'}`}>
                  {listening ? <MicOff size={17} /> : <Mic size={17} />}
                </button>
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  className="p-2 bg-primary text-ink rounded-xl hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <Send size={17} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
