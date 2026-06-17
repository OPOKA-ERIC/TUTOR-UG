import { useState, useEffect } from 'react'
import { Plus, Trash2, Loader2, BookOpen, Clock, Info, ChevronDown } from 'lucide-react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { getSubjectsForLevel, DAY_NAMES, formatTime } from '@/lib/constants'
import Logo from '@/components/Logo'
import type { TimetableEntry } from '@/types'

const FULL_DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const COLORS = ['#FFB800','#7C3AED','#84CC16','#EF4444','#3B82F6','#F97316','#EC4899','#00BCD4','#8BC34A','#F06292']

export default function TimetableModal({ onClose }: { onClose?: () => void }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [entries, setEntries] = useState<TimetableEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selectedDay, setSelectedDay] = useState(0) // 0-indexed
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const isUniversityOrPro = profile?.education_level === 'University' || profile?.education_level === 'Professional'
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
    setDeleteConfirmId(null)
  }

  const dayEntries = entries.filter(e => e.day_of_week === selectedDay + 1)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="w-full max-w-2xl h-[85vh] rounded-2xl overflow-hidden flex flex-col bg-gradient-to-b from-surface to-bg relative"
        style={{
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        }}>

      {/* Decorative glow */}
      <div className="absolute -top-8 -right-8 w-56 h-56 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,184,0,0.08), transparent)' }} />

      {/* ── TOP BAR ── */}
      <div className="bg-gradient-to-r from-surface to-surface-var px-2 py-2 flex items-center gap-1 shrink-0">
        <button onClick={onClose}
          className="w-12 h-12 flex items-center justify-center shrink-0">
          <div className="w-9 h-9 bg-surface-input rounded-full flex items-center justify-center">
            <ArrowLeft size={18} className="text-text-white" />
          </div>
        </button>
        <Logo size="sm" />
        <div className="flex-1 ml-2">
          <p className="text-text-white font-bold text-lg">Study Timetable</p>
          <p className="text-text-disabled text-xs">Plan your week</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="w-10 h-10 rounded-full flex items-center justify-center mr-2 shrink-0"
          style={{ backgroundColor: 'rgba(255,184,0,0.15)' }}>
          <Plus size={22} className="text-primary" />
        </button>
      </div>

      {/* ── DAY TABS ── */}
      <div className="flex gap-1 px-2 py-2 bg-surface-card shrink-0">
        {DAY_NAMES.map((day, idx) => {
          const isSelected = idx === selectedDay
          const hasDot = entries.some(e => e.day_of_week === idx + 1)
          return (
            <button key={day} onClick={() => setSelectedDay(idx)}
              className="flex-1 flex flex-col items-center py-1.5 rounded-xl transition-all"
              style={{ backgroundColor: isSelected ? '#FFB800' : 'rgba(255,255,255,0.05)' }}>
              <span className="text-xs font-bold" style={{ color: isSelected ? '#000' : '#888' }}>{day}</span>
              {hasDot && (
                <div className="w-1.5 h-1.5 rounded-full mt-0.5"
                  style={{ backgroundColor: isSelected ? 'rgba(0,0,0,0.5)' : '#FFB800' }} />
              )}
            </button>
          )
        })}
      </div>

      {/* ── ENTRIES ── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : dayEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-60">
            <BookOpen size={56} className="text-primary" />
            <p className="text-text-white font-semibold">No sessions on {FULL_DAY_NAMES[selectedDay]}</p>
            <p className="text-text-disabled text-sm">Tap + to add a study session</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {dayEntries.map(entry => {
              const color = entry.color_hex || '#FFB800'
              return (
                <div key={entry.entry_id}>
                  {deleteConfirmId === entry.entry_id && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
                      <div className="bg-surface-card rounded-2xl p-6 w-full max-w-sm">
                        <p className="text-text-white font-bold text-base mb-2">Delete Session?</p>
                        <p className="text-text-disabled text-sm mb-5">Remove {entry.subject} from your timetable?</p>
                        <div className="flex gap-3">
                          <button onClick={() => setDeleteConfirmId(null)} className="flex-1 btn-secondary py-2 text-sm">Cancel</button>
                          <button onClick={() => deleteEntry(entry.entry_id)} className="flex-1 bg-error text-white font-bold py-2 rounded-xl text-sm">Delete</button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="bg-surface-card rounded-2xl flex items-center gap-3 p-4">
                    {/* Color bar */}
                    <div className="w-1 h-14 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${color}26` }}>
                      <BookOpen size={24} style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-text-white font-bold text-base truncate">{entry.subject}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock size={13} style={{ color }} />
                        <span className="text-sm font-medium" style={{ color }}>
                          {formatTime(entry.start_hour, entry.start_min)} – {formatTime(entry.end_hour, entry.end_min)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Info size={12} className="text-text-disabled" />
                        <span className="text-text-disabled text-xs">Reminder 15 min before • Alarm at start</span>
                      </div>
                    </div>
                    <button onClick={() => setDeleteConfirmId(entry.entry_id)}
                      className="w-9 h-9 flex items-center justify-center shrink-0">
                      <Trash2 size={18} style={{ color: 'rgba(239,68,68,0.7)' }} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── ADD FORM MODAL ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-card rounded-2xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(255,184,0,0.15)' }}>
                <Plus size={20} className="text-primary" />
              </div>
              <p className="text-text-white font-bold text-lg">Add Study Session</p>
            </div>

            {error && <div className="bg-error/10 border border-error/30 rounded-xl p-3 mb-4 text-error text-sm">{error}</div>}

            <div className="space-y-4">
              {/* Subject */}
              <div>
                <label className="text-text-disabled text-xs font-semibold uppercase mb-1.5 block">Subject</label>
                {isUniversityOrPro ? (
                  <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    placeholder={profile?.education_level === 'University' ? 'e.g. Calculus, Data Structures...' : 'e.g. Project Management, Excel...'}
                    className="input-field" />
                ) : (
                  <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="input-field">
                    <option value="">Select subject</option>
                    {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>

              {/* Day */}
              <div>
                <label className="text-text-disabled text-xs font-semibold uppercase mb-1.5 block">Day</label>
                <div className="flex gap-1">
                  {DAY_NAMES.map((day, idx) => (
                    <button key={day} type="button"
                      onClick={() => setForm(f => ({ ...f, day_of_week: idx + 1 }))}
                      className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{
                        backgroundColor: form.day_of_week === idx + 1 ? '#FFB800' : 'rgba(255,255,255,0.05)',
                        color: form.day_of_week === idx + 1 ? '#000' : '#888',
                      }}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-text-disabled text-xs font-semibold uppercase mb-1.5 block">Start Time</label>
                  <input type="time"
                    value={`${String(form.start_hour).padStart(2,'0')}:${String(form.start_min).padStart(2,'0')}`}
                    onChange={e => { const [h,m] = e.target.value.split(':'); setForm(f => ({ ...f, start_hour: Number(h), start_min: Number(m) })) }}
                    className="input-field" />
                </div>
                <div>
                  <label className="text-text-disabled text-xs font-semibold uppercase mb-1.5 block">End Time</label>
                  <input type="time"
                    value={`${String(form.end_hour).padStart(2,'0')}:${String(form.end_min).padStart(2,'0')}`}
                    onChange={e => { const [h,m] = e.target.value.split(':'); setForm(f => ({ ...f, end_hour: Number(h), end_min: Number(m) })) }}
                    className="input-field" />
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="text-text-disabled text-xs font-semibold uppercase mb-1.5 block">Colour</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color_hex: c }))}
                      className="w-7 h-7 rounded-full transition-all"
                      style={{
                        backgroundColor: c,
                        border: form.color_hex === c ? '2.5px solid white' : '2px solid transparent',
                        transform: form.color_hex === c ? 'scale(1.15)' : 'scale(1)',
                      }} />
                  ))}
                </div>
              </div>

              {/* Info note */}
              <div className="flex items-start gap-2 rounded-xl p-3" style={{ backgroundColor: 'rgba(255,184,0,0.08)' }}>
                <Info size={16} className="text-primary shrink-0 mt-0.5" />
                <p className="text-text-disabled text-xs">You'll get a reminder 15 min before & an alarm when it's time to study.</p>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowForm(false); setError('') }}
                className="flex-1 btn-secondary py-2.5">Cancel</button>
              <button onClick={addEntry} disabled={saving}
                className="flex-1 h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#0A0A1F' }}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  )
}
