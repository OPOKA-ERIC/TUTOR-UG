import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Trophy, RefreshCw, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { SUPABASE_URL, SUPABASE_ANON } from '@/lib/supabase'
import Layout from '@/components/Layout'
import type { QuizQuestion, DocumentSection } from '@/types'

export default function QuizPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [answered, setAnswered] = useState<Set<number>>(new Set())
  const [currentQ, setCurrentQ] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showResults, setShowResults] = useState(false)
  const [section, setSection] = useState<DocumentSection | null>(null)
  const [sectionIndex, setSectionIndex] = useState(0)
  const [totalSections, setTotalSections] = useState(1)
  const [docId, setDocId] = useState('')

  useEffect(() => {
    const s = sessionStorage.getItem('quiz_section')
    const idx = sessionStorage.getItem('quiz_section_index')
    const total = sessionStorage.getItem('quiz_total_sections')
    const dId = sessionStorage.getItem('quiz_doc_id')
    if (!s) { navigate('/documents'); return }
    const sec = JSON.parse(s) as DocumentSection
    setSection(sec)
    setSectionIndex(Number(idx) || 0)
    setTotalSections(Number(total) || 1)
    setDocId(dId || '')
    generateQuiz(sec)
  }, [])

  async function generateQuiz(sec: DocumentSection) {
    if (!profile) return
    setLoading(true)
    setQuestions([]); setAnswers({}); setAnswered(new Set()); setCurrentQ(0); setShowResults(false)
    const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}` },
      body: JSON.stringify({
        sectionContent: sec.content,
        userProfile: { name: profile.name, district: profile.district, educationLevel: profile.education_level },
        districtContext: `Student: ${profile.name}, District: ${profile.district}`,
      }),
    })
    const data = await res.json()
    setQuestions(data.questions || [])
    setLoading(false)
  }

  function submitAnswer(qIdx: number, aIdx: number) {
    setAnswers(a => ({ ...a, [qIdx]: aIdx }))
    setAnswered(s => new Set([...s, qIdx]))
  }

  function calculateScore(): number {
    if (!questions.length) return 0
    const correct = Object.entries(answers).filter(([i, a]) => questions[Number(i)]?.correctIndex === a).length
    return Math.round((correct / questions.length) * 100)
  }

  async function finishQuiz() {
    if (!profile || !section) return
    const score = calculateScore()
    const passed = score >= 70
    const correct = Object.entries(answers).filter(([i, a]) => questions[Number(i)]?.correctIndex === a).length

    await supabase.from('quiz_results').insert({
      quiz_id: crypto.randomUUID(), user_id: profile.user_id,
      document_id: docId || null, section_id: section.section_id,
      section_title: section.title, subject: section.title,
      education_level: profile.education_level, score,
      total_questions: questions.length, correct_answers: correct,
      passed, difficulty: 'adaptive', time_taken_sec: 0,
      taken_at: new Date().toISOString(),
    })

    // Update section progress
    await supabase.from('document_sections')
      .update({ quiz_passed: passed, best_score: score, attempt_count: section.attempt_count + 1 })
      .eq('section_id', section.section_id)

    setShowResults(true)
  }

  function nextSection() {
    const nextIdx = sectionIndex + 1
    const storedSections = sessionStorage.getItem('learning_sections')
    if (!storedSections) { navigate('/documents'); return }
    const sections = JSON.parse(storedSections) as DocumentSection[]
    if (nextIdx < sections.length) {
      sessionStorage.setItem('quiz_section', JSON.stringify(sections[nextIdx]))
      sessionStorage.setItem('quiz_section_index', String(nextIdx))
      navigate('/learn')
    } else {
      navigate('/documents')
    }
  }

  const score = calculateScore()
  const passed = score >= 70
  const q = questions[currentQ]

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate('/learn')} className="flex items-center gap-1 text-text-disabled hover:text-text-light text-sm">
            <ArrowLeft size={16} /> Back to Learning
          </button>
          {section && <p className="text-text-disabled text-sm">Section {sectionIndex + 1} / {totalSections}</p>}
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-2 mb-6 justify-center">
          {Array.from({ length: totalSections }).map((_, i) => (
            <div key={i} className={`rounded-full transition-all ${i < sectionIndex ? 'w-4 h-4 bg-lime' : i === sectionIndex ? 'w-4 h-4 bg-primary' : 'w-3 h-3 bg-outline'}`} />
          ))}
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 size={40} className="animate-spin text-primary" />
            <p className="text-text-disabled">Generating quiz questions...</p>
          </div>
        )}

        {/* Results */}
        {!loading && showResults && (
          <div className="text-center animate-fade-in">
            <div className={`w-32 h-32 rounded-full mx-auto mb-6 flex items-center justify-center ${passed ? 'bg-lime/10' : 'bg-error/10'}`}>
              {passed ? <Trophy size={56} className="text-lime" /> : <RefreshCw size={56} className="text-error" />}
            </div>
            <h2 className={`text-3xl font-black mb-2 ${passed ? 'text-lime' : 'text-error'}`}>
              {passed ? 'Great Work! 🎉' : 'Keep Going! 💪'}
            </h2>
            <p className="text-7xl font-black text-primary mb-4">{score}%</p>
            <div className={`rounded-xl p-4 mb-6 ${passed ? 'bg-lime/8 border border-lime/20' : 'bg-error/8 border border-error/20'}`}>
              <p className={`text-sm ${passed ? 'text-lime' : 'text-error'}`}>
                {passed ? `You scored ${score}% — solid understanding of this section.` : `You scored ${score}% — you need 70% or above to move on.`}
              </p>
            </div>

            <div className="space-y-3">
              {passed && (
                <button onClick={nextSection} className="w-full bg-grad-lime text-ink font-bold py-3 rounded-xl hover:opacity-90 transition-opacity">
                  Continue to Next Section →
                </button>
              )}
              <button onClick={() => section && generateQuiz(section)}
                className="w-full bg-grad-violet text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity">
                Redo Quiz
              </button>
              <button onClick={() => navigate('/learn')}
                className="w-full bg-surface-var text-text-light font-medium py-3 rounded-xl hover:bg-surface-card transition-colors">
                Re-explain This Section
              </button>
            </div>
          </div>
        )}

        {/* Question */}
        {!loading && !showResults && q && (
          <div className="animate-fade-in">
            <div className="card mb-5">
              <p className="text-primary text-xs font-bold uppercase mb-2">Question {currentQ + 1} of {questions.length}</p>
              <p className="text-text-white text-lg font-medium">{q.question}</p>
            </div>

            <div className="space-y-3 mb-5">
              {q.options.map((opt, i) => {
                const isSelected = answers[currentQ] === i
                const isAnswered = answered.has(currentQ)
                const isCorrect = i === q.correctIndex
                let cls = 'card cursor-pointer border transition-all '
                if (isAnswered) {
                  if (isCorrect) cls += 'border-lime bg-lime/10 '
                  else if (isSelected) cls += 'border-error bg-error/10 '
                  else cls += 'border-outline opacity-50 '
                } else {
                  cls += isSelected ? 'border-primary bg-primary/10 ' : 'border-outline hover:border-primary/50 '
                }

                return (
                  <div key={i} onClick={() => !isAnswered && setAnswers(a => ({ ...a, [currentQ]: i }))} className={cls}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isAnswered && isCorrect ? 'bg-lime/20 text-lime' : isAnswered && isSelected && !isCorrect ? 'bg-error/20 text-error' : isSelected ? 'bg-primary/20 text-primary' : 'bg-surface-var text-text-disabled'}`}>
                        {String.fromCharCode(65 + i)}
                      </div>
                      <span className="text-text-white text-sm">{opt}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {answers[currentQ] !== undefined && !answered.has(currentQ) && (
              <button onClick={() => submitAnswer(currentQ, answers[currentQ])}
                className="btn-primary w-full mb-4">Submit Answer</button>
            )}

            {answered.has(currentQ) && (
              <>
                <div className="card bg-secondary/8 border-secondary/20 mb-4">
                  <p className="text-secondary text-xs font-bold uppercase mb-1">Explanation</p>
                  <p className="text-text-light text-sm">{q.explanation}</p>
                </div>
                {currentQ < questions.length - 1 ? (
                  <button onClick={() => setCurrentQ(c => c + 1)} className="btn-primary w-full">Next Question →</button>
                ) : (
                  <button onClick={finishQuiz} className="w-full bg-grad-lime text-ink font-bold py-3 rounded-xl hover:opacity-90 transition-opacity">
                    Finish Quiz 🎉
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
