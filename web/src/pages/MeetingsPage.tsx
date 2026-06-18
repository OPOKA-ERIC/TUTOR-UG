import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Video, Clock, Users, Calendar, X, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { SUPABASE_URL, SUPABASE_ANON } from '@/lib/supabase'
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

    // If room_url is a mock/invalid Daily URL, regenerate it with Jitsi
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


  const inputStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
  }

  if (!profile) return null



  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-surface to-bg overflow-hidden items-center">
      <div className="max-w-3xl mx-auto w-full flex flex-col h-full">

      {/* TOP BAR */}
      <div className="bg-gradient-to-r from-surface to-surface-var px-2 py-2 flex items-center gap-2 shrink-0">
        <button onClick={() => navigate('/chat')} className="w-10 h-10 flex items-center justify-center shrink-0">
          <div className="w-8 h-8 bg-surface-input rounded-full flex items-center justify-center">
            <ArrowLeft size={16} className="text-text-white" />
          </div>
        </button>
        <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0"
          style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#0A0A1F' }}>T</div>
        <p className="text-text-white font-bold text-lg flex-1">Meetings</p>
        <button onClick={() => setShowCreate(true)}
          className="w-10 h-10 flex items-center justify-center rounded-full"
          style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)' }}>
          <Plus size={20} style={{ color: '#0A0A1F' }} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Create meeting form */}
        {showCreate && (
          <div className="rounded-2xl p-5 space-y-3" style={{ background: '#12122A' }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-text-white font-bold">Schedule a Meeting</p>
              <button onClick={() => setShowCreate(false)}><X size={18} className="text-text-disabled" /></button>
            </div>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Meeting title *" className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle} />
            <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="Subject (e.g. Mathematics)" className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle} />
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)" rows={2}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
              style={inputStyle} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-text-disabled text-xs mb-1 block">Date & Time *</label>
                <input type="datetime-local" value={form.scheduled_at}
                  onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>
              <div>
                <label className="text-text-disabled text-xs mb-1 block">Duration (mins)</label>
                <input type="number" value={form.duration_mins} min={15} max={180}
                  onChange={e => setForm(f => ({ ...f, duration_mins: +e.target.value }))}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={inputStyle} />
              </div>
            </div>
            <button onClick={createMeeting} disabled={creating || !form.title || !form.scheduled_at}
              className="w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#0A0A1F' }}>
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />}
              {creating ? 'Creating room…' : 'Create Meeting'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-primary" />
          </div>
        ) : meetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Video size={48} className="text-text-disabled" />
            <p className="text-text-white font-bold text-lg">No upcoming meetings</p>
            <p className="text-text-disabled text-sm">Tap + to schedule a meeting with your students or teachers</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-text-disabled text-xs font-bold uppercase tracking-wider">UPCOMING & LIVE</p>
            {meetings.map(m => {
              const isHost = m.host_id === profile.user_id
              const isLive = m.status === 'live'
              const dt = new Date(m.scheduled_at)
              return (
                <div key={m.meeting_id} className="rounded-2xl p-4" style={{ background: '#12122A', border: isLive ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,184,0,0.15)' }}>
                  {isLive && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="w-2 h-2 rounded-full bg-error animate-pulse" />
                      <span className="text-error text-xs font-bold">LIVE NOW</span>
                    </div>
                  )}
                  <p className="text-text-white font-bold text-base">{m.title}</p>
                  {m.subject && <p className="text-primary text-xs mt-0.5">{m.subject}</p>}
                  {m.description && <p className="text-text-disabled text-xs mt-1">{m.description}</p>}
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1.5 text-text-disabled text-xs">
                      <Calendar size={12} />
                      {dt.toLocaleDateString('en-UG', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                    <div className="flex items-center gap-1.5 text-text-disabled text-xs">
                      <Clock size={12} />
                      {dt.toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="flex items-center gap-1.5 text-text-disabled text-xs">
                      <Users size={12} />
                      {m.duration_mins} min
                    </div>
                    {isHost && <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(255,184,0,0.15)', color: '#FFB800' }}>Host</span>}
                  </div>
                  <button onClick={() => joinMeeting(m)}
                    className="mt-3 w-full h-10 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                    style={{ background: isLive ? 'linear-gradient(135deg,#EF4444,#DC2626)' : 'linear-gradient(135deg,#F59E0B,#D97706)', color: isLive ? '#fff' : '#0A0A1F' }}>
                    <Video size={15} />
                    {isLive ? 'Join Now' : 'Join Meeting'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
    </div>
  )
}
