import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Mic, ChevronRight, Volume2, Loader2, ArrowLeft } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuth } from '@/lib/AuthContext'
import { SUPABASE_URL, SUPABASE_ANON } from '@/lib/supabase'
import Layout from '@/components/Layout'
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
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const storedSections = sessionStorage.getItem('learning_sections')
    const storedDocId = sessionStorage.getItem('learning_doc_id')
    if (!storedSections || !storedDocId) { navigate('/documents'); return }
    setSections(JSON.parse(storedSections))
    setDocId(storedDocId)
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, streamingText])

  const currentSection = sections[sectionIndex]

  async function sendMessage() {
    if (!input.trim() || loading || !profile || !currentSection) return
    const text = input.trim()
    setInput('')

    const userMsg: ChatMessage = {
      message_id: crypto.randomUUID(), session_id: '', user_id: profile.user_id,
      role: 'user', content: text, token_count: 0, created_at: new Date().toISOString(),
    }
    setMessages(m => [...m, userMsg])
    setLoading(true)
    setStreamingText('')

    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-chat-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}` },
      body: JSON.stringify({
        sessionId: `learn-${docId}-${sectionIndex}`, message: text,
        userProfile: { name: profile.name, district: profile.district, educationLevel: profile.education_level, school: profile.school, course: profile.course, profession: profile.profession, combination: profile.combination },
        districtContext: `Student: ${profile.name}, District: ${profile.district}`,
        conversationHistory: messages.map(m => ({ role: m.role, content: m.content })),
        learningMode: true, sectionTitle: currentSection.title,
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
    setMessages(m => [...m, { message_id: crypto.randomUUID(), session_id: '', user_id: profile.user_id, role: 'assistant', content: full, token_count: 0, created_at: new Date().toISOString() }])
    setLoading(false)
  }

  function goToQuiz() {
    sessionStorage.setItem('quiz_section', JSON.stringify(currentSection))
    sessionStorage.setItem('quiz_section_index', String(sectionIndex))
    sessionStorage.setItem('quiz_total_sections', String(sections.length))
    sessionStorage.setItem('quiz_doc_id', docId)
    navigate('/quiz')
  }

  function speak(text: string) {
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = 'en-GB'
    window.speechSynthesis.speak(utt)
  }

  if (!currentSection) return null

  return (
    <Layout>
      <div className="flex h-full overflow-hidden">
        {/* Section list sidebar */}
        <div className="w-56 bg-surface border-r border-outline flex flex-col shrink-0">
          <div className="p-3 border-b border-outline">
            <button onClick={() => navigate('/documents')} className="flex items-center gap-1 text-text-disabled text-sm hover:text-text-light">
              <ArrowLeft size={14} /> Documents
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <p className="text-text-disabled text-xs font-semibold uppercase px-2 py-1">Sections</p>
            {sections.map((s, i) => (
              <div key={s.section_id}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${i === sectionIndex ? 'bg-primary/10 text-primary border border-primary/20' : s.quiz_passed ? 'text-lime' : 'text-text-disabled'}`}>
                <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-xs shrink-0">
                  {s.quiz_passed ? '✓' : i + 1}
                </span>
                <span className="truncate">{s.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <div className="bg-grad-bar border-b border-outline px-5 py-3 flex items-center justify-between shrink-0">
            <div>
              <p className="text-text-white font-semibold text-sm">{currentSection.title}</p>
              <p className="text-text-disabled text-xs">Section {sectionIndex + 1} of {sections.length}</p>
            </div>
            {/* Progress dots */}
            <div className="flex items-center gap-1.5">
              {sections.map((_, i) => (
                <div key={i} className={`rounded-full transition-all ${i < sectionIndex ? 'w-3.5 h-3.5 bg-lime' : i === sectionIndex ? 'w-3.5 h-3.5 bg-primary' : 'w-2.5 h-2.5 bg-outline'}`} />
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.length === 0 && (
              <div className="card bg-secondary/5 border-secondary/20">
                <p className="text-secondary text-xs font-bold uppercase mb-2">📖 {currentSection.title}</p>
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentSection.content.slice(0, 600) + (currentSection.content.length > 600 ? '...' : '')}</ReactMarkdown>
                </div>
                <p className="text-text-disabled text-xs mt-3">Ask questions about this section, then click "Take Quiz" when ready.</p>
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
                      <button onClick={() => speak(msg.content)} className="text-text-disabled hover:text-primary mt-1 shrink-0"><Volume2 size={14} /></button>
                    </div>
                  ) : <p className="text-sm">{msg.content}</p>}
                </div>
              </div>
            ))}

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
                  <span className="text-text-disabled text-sm">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input + Quiz button */}
          <div className="border-t border-outline p-4 shrink-0 space-y-3">
            <button onClick={goToQuiz} className="w-full bg-grad-lime text-ink font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
              Take Quiz for This Section <ChevronRight size={18} />
            </button>
            <div className="flex items-end gap-3 bg-surface-input rounded-2xl px-4 py-3 border border-outline focus-within:border-primary transition-colors">
              <textarea value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Ask about this section..." rows={1}
                className="flex-1 bg-transparent text-text-white placeholder-text-disabled resize-none outline-none text-sm max-h-24" />
              <button onClick={sendMessage} disabled={!input.trim() || loading}
                className="p-2 bg-primary text-ink rounded-xl hover:bg-primary-dark disabled:opacity-40 transition-colors">
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
