import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Video, Clock, Users, Calendar, X, Loader2, Zap } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { SUPABASE_URL, SUPABASE_ANON } from '@/lib/supabase'
import Logo from '@/components/Logo'
import type { Meeting } from '@/types'

export default function MeetingsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', subject: '', description: '', scheduled_at: '', duration_mins: 60 })

  useEffect(() => { if (profile) loadMeetings() }, [profile])

  async function loadMeetings() {
    setLoading(true)
    const { data } = await supabase
      .from('meetings').select('*')
      .in('status', ['scheduled', 'live'])
      .order('scheduled_at', { ascending: true })
    setMeetings((data as Meeting[]) || [])
    setLoading(false)
  }

  async function createMeeting() {
    if (!profile || !form.title || !form.scheduled_at) return
    setCreating(true)
    try {
      const meetingId = crypto.randomUUID()
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token || SUPABASE_ANON
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-meeting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          meetingId,
          hostId: profile.user_id,
          title: form.title,
          subject: form.subject,
          scheduledAt: form.scheduled_at,
          durationMins: form.duration_mins,
        }),
      })
      if (!res.ok) throw new Error(`Edge function error: ${res.status}`)
      const { roomUrl, hostToken } = await res.json()

      const { error: dbErr } = await supabase.from('meetings').insert({
        meeting_id: meetingId,
        host_id: profile.user_id,
        title: form.title,
        subject: form.subject,
        description: form.description,
        room_url: roomUrl || '',
        room_token: hostToken || '',
        scheduled_at: form.scheduled_at,
        duration_mins: form.duration_mins,
        status: 'scheduled',
        created_at: new Date().toISOString(),
      })
      if (dbErr) throw new Error(dbErr.message)

      setShowCreate(false)
      setForm({ title: '', subject: '', description: '', scheduled_at: '', duration_mins: 60 })
      loadMeetings()
    } catch (e: any) {
      alert('Failed to create meeting: ' + (e.message || 'Unknown error'))
    } finally {
      setCreating(false)
    }
  }

  async function joinMeeting(meeting: Meeting) {
    if (!profile) return
    const isHost = meeting.host_id === profile.user_id

    let roomUrl = meeting.room_url
    if (!roomUrl || roomUrl.includes('tutorug.daily.co')) {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token || SUPABASE_ANON
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-meeting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ meetingId: meeting.meeting_id, hostId: meeting.host_id, title: meeting.title, subject: meeting.subject, scheduledAt: meeting.scheduled_at, durationMins: meeting.duration_mins }),
      })
      const data = await res.json()
      roomUrl = data.roomUrl
      await supabase.from('meetings').update({ room_url: roomUrl }).eq('meeting_id', meeting.meeting_id)
    }

    if (isHost) {
      await supabase.from('meetings').update({ status: 'live' }).eq('meeting_id', meeting.meeting_id)
    }
    window.open(roomUrl, '_blank', 'noopener,noreferrer')
    loadMeetings()
  }

  function formatDateTime(iso: string) {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = d.getTime() - now.getTime()
    const diffHrs = Math.round(diffMs / 3600000)

    const dateStr = d.toLocaleDateString('en-UG', { weekday: 'short', month: 'short', day: 'numeric' })
    const timeStr = d.toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })

    if (diffMs < 0 && diffMs > -3600000) return { date: dateStr, time: timeStr, label: 'Starting soon', urgent: true }
    if (diffHrs < 1 && diffHrs >= 0) return { date: dateStr, time: timeStr, label: 'In less than 1 hour', urgent: true }
    if (diffHrs < 24 && diffHrs >= 0) return { date: dateStr, time: timeStr, label: `In ${diffHrs}h`, urgent: false }
    return { date: dateStr, time: timeStr, label: '', urgent: false }
  }

  if (!profile) return null

  const liveMeetings = meetings.filter(m => m.status === 'live')
  const scheduledMeetings = meetings.filter(m => m.status === 'scheduled')

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-surface to-bg relative overflow-hidden">
      <div className="w-full flex flex-col h-full">

        {/* ── DECORATIVE GLOW ── */}
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.08), transparent)' }} />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,184,0,0.06), transparent)' }} />

        {/* ── TOP BAR ── */}
        <div className="bg-gradient-to-r from-surface to-surface-var px-2 py-2 flex items-center gap-2 shrink-0 z-10">
          <button onClick={() => navigate('/chat')}
            className="w-12 h-12 flex items-center justify-center shrink-0">
            <div className="w-9 h-9 bg-surface-input rounded-full flex items-center justify-center">
              <ArrowLeft size={18} className="text-text-white" />
            </div>
          </button>
          <Logo size="sm" />
          <span className="text-text-white text-xl font-bold ml-1">Meetings</span>
          <div className="ml-auto">
            <button onClick={() => setShowCreate(true)}
              className="w-12 h-12 flex items-center justify-center rounded-full transition-transform active:scale-90"
              style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)' }}>
              <Plus size={22} style={{ color: '#0A0A1F' }} />
            </button>
          </div>
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5">

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-primary" />
            </div>
          ) : meetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center animate-fade-in">
              <div className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,184,0,0.1)' }}>
                <Video size={40} style={{ color: '#FFB800' }} />
              </div>
              <p className="text-text-white font-bold text-xl">No meetings yet</p>
              <p className="text-text-disabled text-sm max-w-xs">
                Schedule a study session, tutoring class, or group discussion with your peers.
              </p>
              <button onClick={() => setShowCreate(true)}
                className="mt-2 h-12 px-8 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95"
                style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#0A0A1F' }}>
                <Plus size={18} /> Schedule a Meeting
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in">
              {/* ── LIVE MEETINGS ── */}
              {liveMeetings.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-error animate-pulse" />
                    <span className="text-error text-xs font-bold uppercase tracking-wider">Live Now</span>
                  </div>
                  <div className="space-y-3">
                    {liveMeetings.map((m, i) => (
                      <MeetingCard
                        key={m.meeting_id}
                        meeting={m}
                        isHost={m.host_id === profile.user_id}
                        onJoin={joinMeeting}
                        index={i}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ── UPCOMING MEETINGS ── */}
              {scheduledMeetings.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar size={14} className="text-primary" />
                    <span className="text-primary text-xs font-bold uppercase tracking-wider">
                      Upcoming {liveMeetings.length > 0 ? 'Meetings' : `(${scheduledMeetings.length})`}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {scheduledMeetings.map((m, i) => (
                      <MeetingCard
                        key={m.meeting_id}
                        meeting={m}
                        isHost={m.host_id === profile.user_id}
                        onJoin={joinMeeting}
                        index={i}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── CREATE MEETING MODAL ── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-5 animate-fade-in">
          <div className="bg-surface-card rounded-3xl p-6 w-full max-w-md shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)' }}>
                  <Video size={18} style={{ color: '#0A0A1F' }} />
                </div>
                <p className="text-text-white font-bold text-lg">Schedule Meeting</p>
              </div>
              <button onClick={() => setShowCreate(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
                <X size={18} className="text-text-disabled" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-text-disabled text-xs mb-1.5 block font-medium">Meeting Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Trigonometry Revision"
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none transition-all focus:border-primary/50"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
              </div>

              <div>
                <label className="text-text-disabled text-xs mb-1.5 block font-medium">Subject</label>
                <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="e.g. Mathematics"
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none transition-all focus:border-primary/50"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
              </div>

              <div>
                <label className="text-text-disabled text-xs mb-1.5 block font-medium">Description (optional)</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What will this meeting cover?"
                  rows={2}
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none transition-all focus:border-primary/50"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-text-disabled text-xs mb-1.5 block font-medium">Date & Time *</label>
                  <input type="datetime-local" value={form.scheduled_at}
                    onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                    className="w-full rounded-2xl px-4 py-3 text-sm outline-none transition-all focus:border-primary/50"
                    style={{ ...{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', colorScheme: 'dark' }, color: '#fff' }} />
                </div>
                <div>
                  <label className="text-text-disabled text-xs mb-1.5 block font-medium">Duration (mins)</label>
                  <input type="number" value={form.duration_mins} min={15} max={180}
                    onChange={e => setForm(f => ({ ...f, duration_mins: +e.target.value }))}
                    className="w-full rounded-2xl px-4 py-3 text-sm outline-none transition-all focus:border-primary/50"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreate(false)}
                className="flex-1 py-3 rounded-2xl text-sm font-medium transition-all hover:bg-white/5"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#C0C0D8' }}>
                Cancel
              </button>
              <button onClick={createMeeting} disabled={creating || !form.title || !form.scheduled_at}
                className="flex-1 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 active:scale-95"
                style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#0A0A1F' }}>
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                {creating ? 'Creating…' : 'Create Meeting'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MeetingCard({
  meeting, isHost, onJoin, index,
}: {
  meeting: Meeting; isHost: boolean; onJoin: (m: Meeting) => void; index: number
}) {
  const isLive = meeting.status === 'live'
  const dt = new Date(meeting.scheduled_at)
  const info = formatDateTimeStatic(meeting.scheduled_at)

  return (
    <div
      className="rounded-2xl p-5 transition-all duration-200 hover:scale-[1.01]"
      style={{
        animation: `slideUp 0.3s ease-out ${index * 0.05}s both`,
        background: 'linear-gradient(135deg, #12122A, #1A1A3A)',
        border: isLive
          ? '1.5px solid rgba(239,68,68,0.5)'
          : '1px solid rgba(255,184,0,0.12)',
        boxShadow: isLive
          ? '0 0 30px rgba(239,68,68,0.08)'
          : '0 4px 20px rgba(0,0,0,0.2)',
      }}>
      {/* Status badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isLive ? (
            <>
              <div className="w-2 h-2 rounded-full bg-error animate-pulse" />
              <span className="text-error text-xs font-bold">LIVE NOW</span>
            </>
          ) : info.urgent ? (
            <>
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-primary text-xs font-medium">{info.label}</span>
            </>
          ) : null}
        </div>
        {isHost && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(255,184,0,0.12)', color: '#FFB800' }}>
            Host
          </span>
        )}
      </div>

      {/* Title & subject */}
      <p className="text-text-white font-bold text-lg leading-tight">{meeting.title}</p>
      {meeting.subject && (
        <p className="text-primary text-xs font-semibold mt-1 uppercase tracking-wider">{meeting.subject}</p>
      )}
      {meeting.description && (
        <p className="text-text-disabled text-sm mt-2 line-clamp-2">{meeting.description}</p>
      )}

      {/* Meta info */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4">
        <div className="flex items-center gap-1.5 text-text-disabled text-xs">
          <Calendar size={13} className="text-primary/60" />
          {info.date}
        </div>
        <div className="flex items-center gap-1.5 text-text-disabled text-xs">
          <Clock size={13} className="text-primary/60" />
          {info.time}
        </div>
        <div className="flex items-center gap-1.5 text-text-disabled text-xs">
          <Users size={13} className="text-primary/60" />
          {meeting.duration_mins} min
        </div>
      </div>

      {/* CTA */}
      <button onClick={() => onJoin(meeting)}
        className="mt-4 w-full h-11 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        style={{
          background: isLive
            ? 'linear-gradient(135deg,#EF4444,#DC2626)'
            : 'linear-gradient(135deg,#F59E0B,#D97706)',
          color: isLive ? '#fff' : '#0A0A1F',
        }}>
        <Video size={16} />
        {isLive ? 'Join Now' : 'Join Meeting'}
      </button>
    </div>
  )
}

function formatDateTimeStatic(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffHrs = Math.round(diffMs / 3600000)

  const date = d.toLocaleDateString('en-UG', { weekday: 'short', month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })

  if (diffMs < 0 && diffMs > -3600000) return { date, time, label: 'Starting soon', urgent: true }
  if (diffHrs < 1 && diffHrs >= 0) return { date, time, label: 'In less than 1 hour', urgent: true }
  if (diffHrs < 24 && diffHrs >= 0) return { date, time, label: `In ${diffHrs}h`, urgent: false }
  return { date, time, label: '', urgent: false }
}
