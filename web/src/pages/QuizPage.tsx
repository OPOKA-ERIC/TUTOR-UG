import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2, Trophy, RefreshCw, ArrowLeft,
  CheckCircle, XCircle, Clock, BarChart2, ChevronRight
} from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { SUPABASE_URL, SUPABASE_ANON } from '@/lib/supabase'
import Layout from '@/components/Layout'
import Logo from '@/components/Logo'
import type { QuizQuestion, DocumentSection, QuizResult } from '@/types'

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
  const [timeSec, setTimeSec] = useState(0)
  const [recentResults, setRecentResults] = useState<QuizResult[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
    if (profile) loadRecentResults()
  }, [])

  // Timer
  useEffect(() => {
    if (!loading && !showResults) {
      timerRef.current = setInterval(() => setTimeSec(t => t + 1), 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [loading, showResults])

  async function loadRecentResults() {
    if (!profile) return
    const { data } = await supabase
      .from('quiz_results').select('*')
      .eq('user_id', profile.user_id)
      .order('taken_at', { ascending: false })
      .limit(5)
    setRecentResults((data as QuizResult[]) || [])
  }

  async function generateQuiz(sec: DocumentSection) {
    if (!profile) return
    setLoading(true)
    setQuestions([])
    setAnswers({})
    setAnswered(new Set())
    setCurrentQ(0)
    setShowResults(false)
    setTimeSec(0)

    const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-quiz`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`,
      },
      body: JSON.stringify({
        sectionContent: sec.content,
        userProfile: {
          name: profile.name,
          district: profile.district,
          educationLevel: profile.education_level,
        },
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
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = correct ? 880 : 220
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.3)
    } catch {}
  }

  function submitAnswer(qIdx: number, aIdx: number) {
    const correct = questions[qIdx]?.correctIndex === aIdx
    playSound(correct)
    setAnswers(a => ({ ...a, [qIdx]: aIdx }))
    setAnswered(s => new Set([...s, qIdx]))
  }

  function calculateScore(): number {
    if (!questions.length) return 0
    const correct = Object.entries(answers)
      .filter(([i, a]) => questions[Number(i)]?.correctIndex === a).length
    return Math.round((correct / questions.length) * 100)
  }

  function countCorrect(): number {
    return Object.entries(answers)
      .filter(([i, a]) => questions[Number(i)]?.correctIndex === a).length
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  async function finishQuiz() {
    if (!profile || !section) return
    if (timerRef.current) clearInterval(timerRef.current)

    const score = calculateScore()
    const passed = score >= 70
    const correct = countCorrect()

    await supabase.from('quiz_results').insert({
      quiz_id: crypto.randomUUID(),
      user_id: profile.user_id,
      document_id: docId || null,
      section_id: section.section_id,
      section_title: section.title,
      subject: section.title,
      education_level: profile.education_level,
      score,
      total_questions: questions.length,
      correct_answers: correct,
      passed,
      difficulty: 'adaptive',
      time_taken_sec: timeSec,
      taken_at: new Date().toISOString(),
    })

    await supabase.from('document_sections')
      .update({
        quiz_passed: passed,
        best_score: score,
        attempt_count: (section.attempt_count || 0) + 1,
      })
      .eq('section_id', section.section_id)

    await loadRecentResults()
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
      // All sections done!
      navigate('/documents')
    }
  }

  const score = calculateScore()
  const passed = score >= 70
  const q = questions[currentQ]
  const isLastSection = sectionIndex + 1 >= totalSections

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-6">

          {/* Top bar */}
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={() => navigate('/learn')}
              className="flex items-center gap-1.5 text-text-disabled hover:text-text-light text-sm transition-colors">
              <ArrowLeft size={15} /> Back to Learning
            </button>
            <div className="flex items-center gap-3">
              {!loading && !showResults && (
                <div className="flex items-center gap-1.5 text-text-disabled text-sm">
                  <Clock size={14} />
                  <span className="font-mono">{formatTime(timeSec)}</span>
                </div>
              )}
              {section && (
                <span className="text-text-disabled text-sm">
                  Section {sectionIndex + 1} / {totalSections}
                </span>
              )}
            </div>
          </div>

          {/* Section title */}
          {section && (
            <div className="mb-5">
              <p className="text-text-disabled text-xs font-bold uppercase tracking-wider mb-1">Quiz</p>
              <h2 className="text-text-white text-xl font-bold">{section.title}</h2>
            </div>
          )}

          {/* Progress dots */}
          <div className="flex items-center gap-2 mb-6 justify-center">
            {Array.from({ length: totalSections }).map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all ${
                  i < sectionIndex ? 'w-4 h-4 bg-lime' :
                  i === sectionIndex ? 'w-4 h-4 bg-primary' :
                  'w-3 h-3 bg-outline'}`}
              />
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 size={32} className="animate-spin text-primary" />
                </div>
              </div>
              <p className="text-text-light font-medium">Generating quiz questions...</p>
              <p className="text-text-disabled text-sm">Claude AI is creating localised questions for {profile?.district}</p>
            </div>
          )}

          {/* Results */}
          {!loading && showResults && (
            <div className="text-center animate-fade-in space-y-6">
              {/* Score circle */}
              <div className={`w-36 h-36 rounded-full mx-auto flex items-center justify-center border-4 ${
                passed ? 'border-lime bg-lime/10' : 'border-error bg-error/10'}`}>
                {passed
                  ? <Trophy size={60} className="text-lime" />
                  : <RefreshCw size={60} className="text-error" />}
              </div>

              <div>
                <h2 className={`text-3xl font-black mb-1 ${passed ? 'text-lime' : 'text-error'}`}>
                  {passed ? 'Great Work! 🎉' : 'Keep Going! 💪'}
                </h2>
                <p className="text-7xl font-black text-primary">{score}%</p>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Correct', value: `${countCorrect()}/${questions.length}`, color: 'text-lime' },
                  { label: 'Score', value: `${score}%`, color: passed ? 'text-lime' : 'text-error' },
                  { label: 'Time', value: formatTime(timeSec), color: 'text-primary' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="card text-center py-3">
                    <p className={`text-xl font-black ${color}`}>{value}</p>
                    <p className="text-text-disabled text-xs mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Feedback card */}
              <div className={`rounded-xl p-4 text-left ${
                passed ? 'bg-lime/8 border border-lime/20' : 'bg-error/8 border border-error/20'}`}>
                <p className={`text-sm font-medium ${passed ? 'text-lime' : 'text-error'}`}>
                  {passed
                    ? `You scored ${score}% — you have a solid understanding of this section.`
                    : `You scored ${score}% — you need 70% or above to move on.`}
                </p>
                <p className="text-text-disabled text-xs mt-1">
                  {passed
                    ? 'You can continue to the next section or redo the quiz to strengthen your understanding.'
                    : 'Try redoing the quiz with new questions, or ask the AI to re-explain the section differently.'}
                </p>
              </div>

              {/* Action buttons */}
              <div className="space-y-3">
                {passed && (
                  <button
                    onClick={nextSection}
                    className="w-full bg-grad-lime text-ink font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                    {isLastSection ? '🎓 Complete — Back to Documents' : 'Continue to Next Section →'}
                  </button>
                )}
                <button
                  onClick={() => section && generateQuiz(section)}
                  className="w-full bg-grad-violet text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                  <RefreshCw size={17} /> Redo Quiz with New Questions
                </button>
                <button
                  onClick={() => navigate('/learn')}
                  className="w-full bg-surface-var text-text-light font-medium py-3.5 rounded-xl hover:bg-surface-card transition-colors">
                  Re-explain This Section
                </button>
              </div>

              {/* Answer Review */}
              {questions.length > 0 && (
                <div className="text-left">
                  <h3 className="text-text-disabled text-xs font-bold uppercase tracking-wider mb-3">
                    Answer Review
                  </h3>
                  <div className="space-y-3">
                    {questions.map((q, i) => {
                      const userAns = answers[i]
                      const correct = userAns === q.correctIndex
                      return (
                        <div key={i} className={`card border ${correct ? 'border-lime/30 bg-lime/5' : 'border-error/30 bg-error/5'}`}>
                          <div className="flex items-start gap-2 mb-2">
                            {correct
                              ? <CheckCircle size={16} className="text-lime shrink-0 mt-0.5" />
                              : <XCircle size={16} className="text-error shrink-0 mt-0.5" />}
                            <p className="text-text-white text-sm font-medium">{q.question}</p>
                          </div>
                          {!correct && (
                            <p className="text-xs text-text-disabled ml-6">
                              Your answer: <span className="text-error">{q.options[userAns] ?? 'Not answered'}</span>
                              {' · '}
                              Correct: <span className="text-lime">{q.options[q.correctIndex]}</span>
                            </p>
                          )}
                          <p className="text-xs text-text-disabled ml-6 mt-1 italic">{q.explanation}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Recent results */}
              {recentResults.length > 0 && (
                <div className="text-left">
                  <h3 className="text-text-disabled text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                    <BarChart2 size={13} /> Recent Results
                  </h3>
                  <div className="space-y-2">
                    {recentResults.map(r => (
                      <div key={r.quiz_id} className="card flex items-center gap-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-text-white text-sm font-medium truncate">
                            {r.section_title || r.subject || 'Quiz'}
                          </p>
                          <p className="text-text-disabled text-xs">
                            {r.correct_answers}/{r.total_questions} correct · {r.difficulty}
                          </p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                          r.passed ? 'bg-lime/15 text-lime' : 'bg-error/15 text-error'}`}>
                          {r.passed ? 'Passed' : 'Failed'}
                        </span>
                        <span className={`text-lg font-black ${r.passed ? 'text-lime' : 'text-error'}`}>
                          {r.score}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Question */}
          {!loading && !showResults && q && (
            <div className="animate-fade-in space-y-4">

              {/* Question progress */}
              <div className="flex items-center justify-between text-xs text-text-disabled mb-1">
                <span>Question {currentQ + 1} of {questions.length}</span>
                <span>{answered.size} answered</span>
              </div>
              <div className="h-1 bg-outline rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
                />
              </div>

              {/* Question card */}
              <div className="card">
                <p className="text-primary text-xs font-bold uppercase tracking-wider mb-3">
                  Question {currentQ + 1}
                </p>
                <p className="text-text-white text-lg font-semibold leading-relaxed">{q.question}</p>
              </div>

              {/* Options */}
              <div className="space-y-2.5">
                {q.options.map((opt, i) => {
                  const isSelected = answers[currentQ] === i
                  const isAnswered = answered.has(currentQ)
                  const isCorrect = i === q.correctIndex

                  let cls = 'card cursor-pointer border-2 transition-all active:scale-[0.99] '
                  if (isAnswered) {
                    if (isCorrect) cls += 'border-lime bg-lime/10 '
                    else if (isSelected) cls += 'border-error bg-error/10 '
                    else cls += 'border-outline opacity-40 cursor-default '
                  } else {
                    cls += isSelected
                      ? 'border-primary bg-primary/10 '
                      : 'border-outline hover:border-primary/50 hover:bg-surface-var '
                  }

                  return (
                    <div
                      key={i}
                      onClick={() => !isAnswered && setAnswers(a => ({ ...a, [currentQ]: i }))}
                      className={cls}>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
                          isAnswered && isCorrect ? 'bg-lime/20 text-lime' :
                          isAnswered && isSelected && !isCorrect ? 'bg-error/20 text-error' :
                          isSelected ? 'bg-primary/20 text-primary' :
                          'bg-surface-var text-text-disabled'}`}>
                          {isAnswered && isCorrect
                            ? <CheckCircle size={16} />
                            : isAnswered && isSelected && !isCorrect
                            ? <XCircle size={16} />
                            : String.fromCharCode(65 + i)}
                        </div>
                        <span className="text-text-white text-sm flex-1">{opt}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Submit button */}
              {answers[currentQ] !== undefined && !answered.has(currentQ) && (
                <button
                  onClick={() => submitAnswer(currentQ, answers[currentQ])}
                  className="btn-primary w-full py-3">
                  Submit Answer
                </button>
              )}

              {/* Explanation + Next */}
              {answered.has(currentQ) && (
                <div className="space-y-3 animate-slide-up">
                  <div className="card bg-secondary/8 border-secondary/20">
                    <p className="text-secondary text-xs font-bold uppercase tracking-wider mb-2">
                      Explanation
                    </p>
                    <p className="text-text-light text-sm leading-relaxed">{q.explanation}</p>
                  </div>

                  {currentQ < questions.length - 1 ? (
                    <button
                      onClick={() => setCurrentQ(c => c + 1)}
                      className="btn-primary w-full py-3 flex items-center justify-center gap-2">
                      Next Question <ChevronRight size={17} />
                    </button>
                  ) : (
                    <button
                      onClick={finishQuiz}
                      className="w-full bg-grad-lime text-ink font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                      Finish Quiz 🎉
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
