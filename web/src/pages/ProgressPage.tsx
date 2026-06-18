import { useState, useEffect } from 'react'
import { ArrowLeft, BarChart2, Trophy, Target, BookOpen, Loader2, CheckCircle, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { useSettings } from '@/lib/SettingsContext'
import { supabase } from '@/lib/supabase'
import Logo from '@/components/Logo'
import type { QuizResult } from '@/types'

export default function ProgressPage() {
  const { profile } = useAuth()
  const { openSettings } = useSettings()
  const navigate = useNavigate()
  const [results, setResults] = useState<QuizResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (profile) load() }, [profile])

  async function load() {
    if (!profile) return
    const { data } = await supabase.from('quiz_results').select('*')
      .eq('user_id', profile.user_id)
      .order('taken_at', { ascending: false })
      .limit(100)
    setResults((data as QuizResult[]) || [])
    setLoading(false)
  }

  const total = results.length
  const passed = results.filter(r => r.passed).length
  const failed = total - passed
  const avgScore = total ? Math.round(results.reduce((s, r) => s + r.score, 0) / total) : 0
  const bestScore = results.length ? Math.max(...results.map(r => r.score)) : 0
  const passRate = total ? Math.round((passed / total) * 100) : 0

  const bySubject = results.reduce((acc, r) => {
    const key = r.subject || r.section_title || 'General'
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {} as Record<string, QuizResult[]>)

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-surface to-bg items-center">
      <div className="max-w-3xl mx-auto w-full flex flex-col h-full">

      {/* ── TOP BAR ── */}
      <div className="bg-gradient-to-r from-surface to-surface-var px-2 py-2 flex items-center gap-1 shrink-0">
        <button onClick={openSettings}
          className="w-12 h-12 flex items-center justify-center shrink-0">
          <div className="w-9 h-9 bg-surface-input rounded-full flex items-center justify-center">
            <ArrowLeft size={18} className="text-text-white" />
          </div>
        </button>
        <Logo size="sm" />
        <div className="ml-2">
          <p className="text-text-white font-bold text-xl">Learning Progress</p>
          <p className="text-text-disabled text-xs">{profile?.name || 'Student'}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* ── OVERVIEW STATS ── */}
            <div>
              <p className="text-text-disabled text-xs font-bold uppercase tracking-wider mb-3">OVERVIEW</p>
              <div className="grid grid-cols-3 gap-3 mb-3">
                {[
                  { icon: BookOpen, label: 'Total Quizzes', value: String(total), color: '#F59E0B' },
                  { icon: CheckCircle, label: 'Passed', value: String(passed), color: '#84CC16' },
                  { icon: RefreshCw, label: 'Failed', value: String(failed), color: '#EF4444' },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="bg-surface-card rounded-2xl p-3 flex flex-col items-center gap-1">
                    <Icon size={22} style={{ color }} />
                    <p className="text-xl font-black text-text-white">{value}</p>
                    <p className="text-text-disabled text-xs text-center">{label}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: BarChart2, label: 'Avg Score', value: `${avgScore}%`, color: '#00BCD4' },
                  { icon: Trophy, label: 'Best Score', value: `${bestScore}%`, color: '#F59E0B' },
                  { icon: Target, label: 'Pass Rate', value: `${passRate}%`, color: passRate >= 70 ? '#84CC16' : '#EF4444' },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="bg-surface-card rounded-2xl p-3 flex flex-col items-center gap-1">
                    <Icon size={22} style={{ color }} />
                    <p className="text-xl font-black text-text-white">{value}</p>
                    <p className="text-text-disabled text-xs text-center">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── BY SUBJECT ── */}
            {Object.keys(bySubject).length > 0 && (
              <div>
                <p className="text-text-disabled text-xs font-bold uppercase tracking-wider mb-3">BY SUBJECT</p>
                <div className="bg-surface-card rounded-2xl p-4 space-y-3">
                  {Object.entries(bySubject).map(([subject, subResults], idx, arr) => {
                    const subAvg = Math.round(subResults.reduce((s, r) => s + r.score, 0) / subResults.length)
                    const subPassed = subResults.filter(r => r.passed).length
                    return (
                      <div key={subject}>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-text-white font-medium text-sm truncate">{subject}</p>
                            <p className="text-text-disabled text-xs">{subResults.length} quiz{subResults.length !== 1 ? 'zes' : ''} · {subPassed} passed</p>
                          </div>
                          <span className="text-sm font-bold px-3 py-1 rounded-full shrink-0"
                            style={{
                              backgroundColor: subAvg >= 70 ? 'rgba(132,204,22,0.15)' : 'rgba(239,68,68,0.15)',
                              color: subAvg >= 70 ? '#84CC16' : '#EF4444',
                            }}>
                            {subAvg}%
                          </span>
                        </div>
                        {idx < arr.length - 1 && <div className="h-px bg-white/5 mt-3" />}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── QUIZ HISTORY ── */}
            <div>
              <p className="text-text-disabled text-xs font-bold uppercase tracking-wider mb-3">QUIZ HISTORY</p>
              {results.length === 0 ? (
                <div className="flex flex-col items-center py-12 gap-3 opacity-60">
                  <span className="text-5xl">📚</span>
                  <p className="text-text-white font-semibold">No quizzes taken yet</p>
                  <p className="text-text-disabled text-sm text-center">Complete a quiz to see your progress here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {results.slice(0, 20).map(r => (
                    <div key={r.quiz_id} className="bg-surface-card rounded-2xl flex items-center gap-3 p-4">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: r.passed ? 'rgba(132,204,22,0.15)' : 'rgba(239,68,68,0.15)' }}>
                        {r.passed
                          ? <CheckCircle size={22} style={{ color: '#84CC16' }} />
                          : <RefreshCw size={22} style={{ color: '#EF4444' }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-text-white text-sm font-medium truncate">{r.section_title || r.subject || 'Quiz'}</p>
                        <p className="text-text-disabled text-xs">{r.correct_answers}/{r.total_questions} correct · {r.difficulty}</p>
                      </div>
                      <p className="text-lg font-black shrink-0"
                        style={{ color: r.passed ? '#84CC16' : '#EF4444' }}>
                        {r.score}%
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
    </div>
  )
}
