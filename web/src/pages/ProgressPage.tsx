import { useState, useEffect } from 'react'
import { BarChart2, Trophy, Target, BookOpen, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import Layout from '@/components/Layout'
import type { QuizResult } from '@/types'

export default function ProgressPage() {
  const { profile } = useAuth()
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
  const avgScore = total ? Math.round(results.reduce((s, r) => s + r.score, 0) / total) : 0
  const passRate = total ? Math.round((passed / total) * 100) : 0

  const bySubject = results.reduce((acc, r) => {
    const key = r.subject || r.section_title || 'General'
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {} as Record<string, QuizResult[]>)

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
        <h1 className="text-text-white text-2xl font-bold mb-6">Learning Progress</h1>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-60">
            <BarChart2 size={48} className="text-primary" />
            <p className="text-text-white font-semibold">No quiz results yet</p>
            <p className="text-text-disabled text-sm">Complete some quizzes to see your progress here</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { icon: BookOpen, label: 'Total Quizzes', value: total, color: 'text-primary' },
                { icon: Trophy, label: 'Passed', value: passed, color: 'text-lime' },
                { icon: Target, label: 'Avg Score', value: `${avgScore}%`, color: 'text-secondary' },
                { icon: BarChart2, label: 'Pass Rate', value: `${passRate}%`, color: passRate >= 70 ? 'text-lime' : 'text-error' },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="card text-center">
                  <Icon size={24} className={`${color} mx-auto mb-2`} />
                  <p className={`text-2xl font-black ${color}`}>{value}</p>
                  <p className="text-text-disabled text-xs mt-1">{label}</p>
                </div>
              ))}
            </div>

            {/* By subject */}
            <h2 className="text-text-disabled text-xs font-bold uppercase mb-3">By Subject</h2>
            <div className="space-y-3 mb-8">
              {Object.entries(bySubject).map(([subject, subResults]) => {
                const subAvg = Math.round(subResults.reduce((s, r) => s + r.score, 0) / subResults.length)
                const subPassed = subResults.filter(r => r.passed).length
                return (
                  <div key={subject} className="card flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-text-white font-medium truncate">{subject}</p>
                      <p className="text-text-disabled text-xs">{subResults.length} quiz{subResults.length !== 1 ? 'zes' : ''} · {subPassed} passed</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xl font-black ${subAvg >= 70 ? 'text-lime' : 'text-error'}`}>{subAvg}%</p>
                      <p className="text-text-disabled text-xs">avg score</p>
                    </div>
                    {/* Mini bar */}
                    <div className="w-20 h-2 bg-outline rounded-full overflow-hidden shrink-0">
                      <div className={`h-full rounded-full ${subAvg >= 70 ? 'bg-lime' : 'bg-error'}`} style={{ width: `${subAvg}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Recent results */}
            <h2 className="text-text-disabled text-xs font-bold uppercase mb-3">Recent Results</h2>
            <div className="space-y-2">
              {results.slice(0, 20).map(r => (
                <div key={r.quiz_id} className="card flex items-center gap-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-text-white text-sm font-medium truncate">{r.section_title || r.subject || 'Quiz'}</p>
                    <p className="text-text-disabled text-xs">{r.correct_answers}/{r.total_questions} correct · {r.difficulty}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${r.passed ? 'bg-lime/15 text-lime' : 'bg-error/15 text-error'}`}>
                      {r.passed ? 'Passed' : 'Failed'}
                    </span>
                    <span className={`text-lg font-black ${r.passed ? 'text-lime' : 'text-error'}`}>{r.score}%</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
