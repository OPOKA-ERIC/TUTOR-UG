import { useState, useEffect } from 'react'
import { Plus, Trash2, Loader2, Calendar } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { getSubjectsForLevel, DAY_NAMES, formatTime } from '@/lib/constants'
import Layout from '@/components/Layout'
import type { TimetableEntry } from '@/types'

const COLORS = ['#FFB800','#7C3AED','#84CC16','#EF4444','#3B82F6','#F97316','#EC4899']

export default function TimetablePage() {
  const { profile } = useAuth()
  const [entries, setEntries] = useState<TimetableEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const subjects = profile ? getSubjectsForLevel(profile.education_level) : []

  const [form, setForm] = useState({
    subject: '', day_of_week: 1,
    start_hour: 8, start_min: 0,
    end_hour: 9, end_min: 0,
    color_hex: '#FFB800',
  })

  useEffect(() => { if (profile) load() }, [profile])

  async function load() {
    if (!profile) return
    setLoading(true)
    const { data } = await supabase.from('timetable_entries').select('*')
      .eq('user_id', profile.user_id)
      .order('day_of_week').order('start_hour').order('start_min')
    setEntries((data as TimetableEntry[]) || [])
    setLoading(false)
  }

  async function addEntry() {
    if (!profile || !form.subject) { setError('Please select a subject'); return }
    if (form.end_hour * 60 + form.end_min <= form.start_hour * 60 + form.start_min) {
      setError('End time must be after start time'); return
    }
    setSaving(true); setError('')
    const entry: TimetableEntry = {
      entry_id: crypto.randomUUID(), user_id: profile.user_id,
      subject: form.subject, day_of_week: form.day_of_week,
      start_hour: form.start_hour, start_min: form.start_min,
      end_hour: form.end_hour, end_min: form.end_min,
      color_hex: form.color_hex, created_at: new Date().toISOString(),
    }
    const { error: err } = await supabase.from('timetable_entries').insert(entry)
    setSaving(false)
    if (err) { setError(err.message); return }
    setEntries(e => [...e, entry].sort((a, b) => a.day_of_week - b.day_of_week || a.start_hour - b.start_hour))
    setShowForm(false)
    setForm({ subject: '', day_of_week: 1, start_hour: 8, start_min: 0, end_hour: 9, end_min: 0, color_hex: '#FFB800' })
  }

  async function deleteEntry(entryId: string) {
    await supabase.from('timetable_entries').delete().eq('entry_id', entryId)
    setEntries(e => e.filter(x => x.entry_id !== entryId))
  }

  // Group by day
  const byDay = DAY_NAMES.reduce((acc, _, i) => {
    acc[i + 1] = entries.filter(e => e.day_of_week === i + 1)
    return acc
  }, {} as Record<number, TimetableEntry[]>)

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-text-white text-2xl font-bold">Study Timetable</h1>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 py-2 px-4 text-sm">
            <Plus size={16} /> Add Session
          </button>
        </div>

        {/* Add form modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="card w-full max-w-md animate-slide-up">
              <h2 className="text-text-white font-bold text-lg mb-4">New Study Session</h2>
              {error && <div className="bg-error/10 border border-error/30 rounded-xl p-3 mb-4 text-error text-sm">{error}</div>}

              <div className="space-y-4">
                <div>
                  <label className="text-text-light text-sm mb-1.5 block">Subject</label>
                  <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="input-field">
                    <option value="">Select subject</option>
                    {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-text-light text-sm mb-1.5 block">Day</label>
                  <select value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: Number(e.target.value) }))} className="input-field">
                    {DAY_NAMES.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-text-light text-sm mb-1.5 block">Start Time</label>
                    <input type="time" value={`${String(form.start_hour).padStart(2,'0')}:${String(form.start_min).padStart(2,'0')}`}
                      onChange={e => { const [h,m] = e.target.value.split(':'); setForm(f => ({ ...f, start_hour: Number(h), start_min: Number(m) })) }}
                      className="input-field" />
                  </div>
                  <div>
                    <label className="text-text-light text-sm mb-1.5 block">End Time</label>
                    <input type="time" value={`${String(form.end_hour).padStart(2,'0')}:${String(form.end_min).padStart(2,'0')}`}
                      onChange={e => { const [h,m] = e.target.value.split(':'); setForm(f => ({ ...f, end_hour: Number(h), end_min: Number(m) })) }}
                      className="input-field" />
                  </div>
                </div>
                <div>
                  <label className="text-text-light text-sm mb-1.5 block">Color</label>
                  <div className="flex gap-2">
                    {COLORS.map(c => (
                      <button key={c} onClick={() => setForm(f => ({ ...f, color_hex: c }))}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${form.color_hex === c ? 'border-white scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={addEntry} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : null} Save
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-60">
            <Calendar size={48} className="text-primary" />
            <p className="text-text-white font-semibold">No sessions yet</p>
            <p className="text-text-disabled text-sm">Add your first study session to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DAY_NAMES.map((day, i) => {
              const dayEntries = byDay[i + 1]
              if (!dayEntries?.length) return null
              return (
                <div key={day} className="card">
                  <h3 className="text-text-white font-bold mb-3">{day}</h3>
                  <div className="space-y-2">
                    {dayEntries.map(entry => (
                      <div key={entry.entry_id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-var group">
                        <div className="w-3 h-10 rounded-full shrink-0" style={{ backgroundColor: entry.color_hex }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-text-white text-sm font-medium truncate">{entry.subject}</p>
                          <p className="text-text-disabled text-xs">{formatTime(entry.start_hour, entry.start_min)} – {formatTime(entry.end_hour, entry.end_min)}</p>
                        </div>
                        <button onClick={() => deleteEntry(entry.entry_id)}
                          className="opacity-0 group-hover:opacity-100 text-error/60 hover:text-error p-1 rounded transition-all">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
