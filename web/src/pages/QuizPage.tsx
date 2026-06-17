import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Trophy, RefreshCw, CheckCircle } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { SUPABASE_URL, SUPABASE_ANON } from '@/lib/supabase'
import Logo from '@/components/Logo'
import type { QuizQuestion, DocumentSection, QuizResult } from '@/types'

function GradientButton({
  text, gradient, textColor, onClick, disabled = false
}: {
  text: string
  gradient: string
  textColor: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full h-14 rounded-2xl font-bold text-base transition-all disabled:opacity-40"
      style={{ background: gradient, color: textColor }}>
      {text}
    </button>
  )
}

export default function QuizPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set())
  const [currentQ, setCurrentQ] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showResults, setShowResults] = useState(false)
  const [score, setScore] = useState(0)
  const [section, setSection] = useState<DocumentSection | null>(null)
  const [sectionIndex, setSectionIndex] = useState(0)
  const [totalSections, setTotalSections] = useState(1)
  const [docId, setDocId] = useState('')
  const [quizResults, setQuizResults] = useState<QuizResult[]>([])
  const [answers, setAnswers] = useState<Record<number, number>>({})
  // Keep full sections list so "Continue" can navigate correctly
  const [allSections, setAllSections] = useState<DocumentSection[]>([])

  useEffect(() => {
    const s = sessionStorage.getItem('quiz_section')
    const idx = sessionStorage.getItem('quiz_section_index')
    const total = sessionStorage.getItem('quiz_total_sections')
    const dId = sessionStorage.getItem('quiz_doc_id')
    const storedSections = sessionStorage.getItem('learning_sections')
    if (!s) { navigate('/documents'); return }
    const sec = JSON.parse(s) as DocumentSection
    setSection(sec)
    setSectionIndex(Number(idx) || 0)
    setTotalSections(Number(total) || 1)
    setDocId(dId || '')
    if (storedSections) setAllSections(JSON.parse(storedSections) as DocumentSection[])
    generateQuiz(sec)
    if (profile) loadQuizResults()
  }, [])

  // Reset per-question state when fresh questions arrive
  useEffect(() => {
    setCurrentQ(0)
    setSelectedAnswer(null)
    setAnsweredQuestions(new Set())
    setAnswers({})
  }, [questions])

  async function loadQuizResults() {
    if (!profile) return
    const { data } = await supabase
      .from('quiz_results').select('*')
      .eq('user_id', profile.user_id)
      .order('taken_at', { ascending: false })
      .limit(5)
    setQuizResults((data as QuizResult[]) || [])
  }

  async function generateQuiz(sec: DocumentSection) {
    if (!profile) return
    setLoading(true)
    setShowResults(false)
    setScore(0)

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

  function playSound(correct: boolean) {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = correct ? 880 : 220
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3)
    } catch {}
  }

  function calculateScore(answersMap: Record<number, number>): number {
    if (!questions.length) return 0
    const correct = Object.entries(answersMap)
      .filter(([i, a]) => questions[Number(i)]?.correctIndex === a).length
    return Math.round((correct / questions.length) * 100)
  }

  function handleSubmitAnswer() {
    if (selectedAnswer === null) return
    const isCorrect = selectedAnswer === questions[currentQ]?.correctIndex
    playSound(isCorrect)
    const newAnswers = { ...answers, [currentQ]: selectedAnswer }
    setAnswers(newAnswers)
    setAnsweredQuestions(prev => new Set([...prev, currentQ]))
  }

  async function handleFinishQuiz() {
    if (!profile || !section) return
    const finalScore = calculateScore(answers)
    const passed = finalScore >= 70
    const correct = Object.entries(answers)
      .filter(([i, a]) => questions[Number(i)]?.correctIndex === a).length

    await supabase.from('quiz_results').insert({
      quiz_id: crypto.randomUUID(), user_id: profile.user_id,
      document_id: docId || null, section_id: section.section_id,
      section_title: section.title, subject: section.title,
      education_level: profile.education_level, score: finalScore,
      total_questions: questions.length, correct_answers: correct,
      passed, difficulty: 'adaptive', time_taken_sec: 0,
      taken_at: new Date().toISOString(),
    })

    await supabase.from('document_sections')
      .update({ quiz_passed: passed, best_score: finalScore, attempt_count: (section.attempt_count || 0) + 1 })
      .eq('section_id', section.section_id)

    setScore(finalScore)
    await loadQuizResults()
    setShowResults(true)
  }

  function handleNextSection() {
    const nextIdx = sectionIndex + 1
    if (nextIdx < allSections.length) {
      const nextSection = allSections[nextIdx]
      // Update sessionStorage so LearningPage picks up the right section
      sessionStorage.setItem('learning_section_index', String(nextIdx))
      sessionStorage.setItem('quiz_section', JSON.stringify(nextSection))
      sessionStorage.setItem('quiz_section_index', String(nextIdx))
      navigate('/learn')
    } else {
      // All sections done — go back to documents
      navigate('/documents')
    }
  }

  function handleRetryQuiz() {
    if (section) generateQuiz(section)
  }

  function handleReExplain() {
    navigate('/learn')
  }

  const passed = score >= 70
  const currentQuestion = questions.length > 0 && currentQ < questions.length ? questions[currentQ] : null
  const isAnswered = answeredQuestions.has(currentQ)

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-surface to-bg relative overflow-hidden">

      {/* Radial glow bottom-left */}
      <div className="absolute bottom-40 -left-16 w-56 h-56 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(109,40,217,0.1), transparent)' }} />

      {/* ── TOP BAR ── */}
      <div className="bg-gradient-to-r from-surface to-surface-var px-2 py-2 flex items-center gap-1 shrink-0">
        <button onClick={() => navigate('/learn')}
          className="w-12 h-12 flex items-center justify-center shrink-0">
          <div className="w-9 h-9 bg-surface-input rounded-full flex items-center justify-center">
            <ArrowLeft size={18} className="text-text-white" />
          </div>
        </button>
        <Logo size="sm" />
        <div className="ml-2">
          <p className="text-text-white font-bold text-lg">
            {section?.title ? `Quiz: ${section.title}` : 'Quiz'}
          </p>
          {!showResults && questions.length > 0 && (
            <p className="text-text-disabled text-xs">Q {currentQ + 1} / {questions.length}</p>
          )}
        </div>
      </div>

      {/* Section progress dots */}
      <div className="flex items-center justify-center gap-2 px-5 py-3">
        {Array.from({ length: totalSections }).map((_, i) => {
          const done = i < sectionIndex
          return (
            <div key={i} className="rounded-full transition-all"
              style={{
                width: done ? 14 : 10,
                height: done ? 14 : 10,
                backgroundColor: done ? '#84CC16' : '#2A2A4A',
              }} />
          )
        })}
      </div>

      {/* ── CONTENT ── */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">

        {/* ── LOADING ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 size={36} className="animate-spin text-primary" />
            <p className="text-text-disabled text-sm">Generating quiz questions...</p>
          </div>
        )}

        {/* ── RESULTS ── */}
        {!loading && showResults && (
          <div className="flex flex-col items-center py-4 space-y-4">

            <div className="w-36 h-36 rounded-full flex items-center justify-center"
              style={{
                background: passed
                  ? 'radial-gradient(circle, rgba(132,204,22,0.2), transparent)'
                  : 'radial-gradient(circle, rgba(239,68,68,0.2), transparent)',
              }}>
              {passed
                ? <Trophy size={72} style={{ color: '#84CC16' }} />
                : <RefreshCw size={72} style={{ color: '#EF4444' }} />}
            </div>

            <p className="text-3xl font-bold" style={{ color: passed ? '#84CC16' : '#EF4444' }}>
              {passed ? 'Great Work! 🎉' : 'Keep Going! 💪'}
            </p>

            <p className="text-6xl font-black text-primary">{score}%</p>

            <div className="w-full rounded-xl p-4"
              style={{ backgroundColor: passed ? 'rgba(132,204,22,0.08)' : 'rgba(239,68,68,0.08)' }}>
              <p className="text-sm text-center" style={{ color: passed ? '#84CC16' : '#EF4444' }}>
                {passed
                  ? `You scored ${score}% — you have a solid understanding of this section.`
                  : `You scored ${score}% — you need 70% or above to move on.`}
              </p>
              <p className="text-text-disabled text-xs text-center mt-1.5">
                {passed
                  ? 'You can continue to the next section or strengthen your understanding further.'
                  : 'Try redoing the quiz with new questions or ask the AI to re-explain the section differently.'}
              </p>
            </div>

            <div className="w-full space-y-3">
              {passed ? (
                <>
                  <GradientButton
                    text={sectionIndex + 1 < totalSections ? 'Continue to Next Section →' : 'Finish — Back to Documents'}
                    gradient="linear-gradient(135deg, #84CC16, #65A30D)"
                    textColor="#0A0A1F"
                    onClick={handleNextSection}
                  />
                  <GradientButton
                    text="Redo Quiz"
                    gradient="linear-gradient(135deg, #7C3AED, #6D28D9)"
                    textColor="#F0F0FF"
                    onClick={handleRetryQuiz}
                  />
                  <GradientButton
                    text="Re-explain This Section"
                    gradient="linear-gradient(135deg, #1A1A3A, #1A1A3A)"
                    textColor="#C0C0D8"
                    onClick={handleReExplain}
                  />
                </>
              ) : (
                <>
                  <GradientButton
                    text="Redo Quiz"
                    gradient="linear-gradient(135deg, #F59E0B, #D97706)"
                    textColor="#0A0A1F"
                    onClick={handleRetryQuiz}
                  />
                  <GradientButton
                    text="Re-explain This Section"
                    gradient="linear-gradient(135deg, #7C3AED, #6D28D9)"
                    textColor="#F0F0FF"
                    onClick={handleReExplain}
                  />
                </>
              )}
            </div>

            {quizResults.length > 0 && (
              <div className="w-full">
                <p className="text-text-disabled text-xs font-bold uppercase tracking-wider mb-2.5">
                  RECENT RESULTS
                </p>
                <div className="space-y-2">
                  {quizResults.slice(0, 5).map(r => (
                    <div key={r.quiz_id} className="bg-surface-var rounded-xl px-4 py-3.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-text-white font-medium text-sm truncate">
                          {r.section_title || r.subject || 'Quiz'}
                        </p>
                        <p className="text-text-disabled text-xs">
                          {r.correct_answers}/{r.total_questions} correct • {r.difficulty}
                        </p>
                      </div>
                      <p className="text-base font-bold shrink-0"
                        style={{ color: r.passed ? '#84CC16' : '#EF4444' }}>
                        {r.score}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── QUESTION ── */}
        {!loading && !showResults && currentQuestion && (
          <div className="space-y-5 py-2">

            <div className="bg-surface rounded-2xl p-5">
              <p className="text-primary text-xs font-bold mb-2">
                Question {currentQ + 1}
              </p>
              <p className="text-text-white text-lg font-medium leading-snug">
                {currentQuestion.question}
              </p>
            </div>

            <div className="space-y-2.5">
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedAnswer === index
                const isCorrect = index === currentQuestion.correctIndex

                const bgColor = isAnswered && isCorrect
                  ? 'rgba(132,204,22,0.15)'
                  : isAnswered && isSelected && !isCorrect
                  ? 'rgba(239,68,68,0.15)'
                  : isSelected
                  ? 'rgba(255,184,0,0.1)'
                  : '#1A1A3A'

                const borderColor = isAnswered && isCorrect
                  ? '#84CC16'
                  : isAnswered && isSelected && !isCorrect
                  ? '#EF4444'
                  : isSelected
                  ? '#FFB800'
                  : '#2A2A4A'

                return (
                  <div
                    key={index}
                    onClick={() => !isAnswered && setSelectedAnswer(index)}
                    className="w-full rounded-xl px-4 py-4 flex items-center gap-3 transition-all cursor-pointer"
                    style={{ backgroundColor: bgColor, border: `1.5px solid ${borderColor}` }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{ backgroundColor: `${borderColor}33`, color: borderColor }}>
                      {isAnswered && isCorrect
                        ? <CheckCircle size={16} />
                        : String.fromCharCode(65 + index)}
                    </div>
                    <span className="text-text-white text-base flex-1">{option}</span>
                  </div>
                )
              })}
            </div>

            {/* Submit — shown when answer selected but not yet submitted */}
            {selectedAnswer !== null && !isAnswered && (
              <GradientButton
                text="Submit Answer"
                gradient="linear-gradient(135deg, #F59E0B, #D97706)"
                textColor="#0A0A1F"
                onClick={handleSubmitAnswer}
              />
            )}

            {/* Explanation + Next/Finish — shown after submitting */}
            {isAnswered && (
              <div className="space-y-4">
                <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(124,58,237,0.08)' }}>
                  <p className="text-secondary text-sm font-bold mb-1.5">Explanation</p>
                  <p className="text-text-light text-sm leading-relaxed">
                    {currentQuestion.explanation}
                  </p>
                </div>

                {currentQ < questions.length - 1 ? (
                  <GradientButton
                    text="Next Question →"
                    gradient="linear-gradient(135deg, #7C3AED, #6D28D9)"
                    textColor="#F0F0FF"
                    onClick={() => { setCurrentQ(c => c + 1); setSelectedAnswer(null) }}
                  />
                ) : (
                  <GradientButton
                    text="Finish Quiz 🎉"
                    gradient="linear-gradient(135deg, #84CC16, #65A30D)"
                    textColor="#0A0A1F"
                    onClick={handleFinishQuiz}
                  />
                )}
              </div>
            )}

            <div className="h-8" />
          </div>
        )}
      </div>
    </div>
  )
}
