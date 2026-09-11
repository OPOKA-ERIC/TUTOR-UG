import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Video, Clock, Users, Calendar, X, Loader2,
  Zap, Share2, StopCircle, CheckCircle2, UserCheck, ChevronDown,
  ChevronUp, Bell, History, Copy, ExternalLink, Trash2, Mail,
  Check, Ban, Send, UserPlus
} from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { apiUrl } from '@/lib/api'
import { SUPABASE_ANON } from '@/lib/supabase'
import Logo from '@/components/Logo'
import type { Meeting, MeetingParticipant, MeetingInvite } from '@/types'

interface Notification {
  id: string
  message: string
  type: 'info' | 'live' | 'success' | 'error'
}

export default function MeetingsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [endedMeetings, setEndedMeetings] = useState<Meeting[]>([])
  const [invitedMeetings, setInvitedMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showEnded, setShowEnded] = useState(false)
  const [showParticipants, setShowParticipants] = useState<string | null>(null)
  const [showInvites, setShowInvites] = useState<string | null>(null)
  const [showInviteForm, setShowInviteForm] = useState<string | null>(null)
  const [inviteEmails, setInviteEmails] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)
  const [participants, setParticipants] = useState<Record<string, MeetingParticipant[]>>({})
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({})
  const [invites, setInvites] = useState<Record<string, MeetingInvite[]>>({})
  const [notification, setNotification] = useState<Notification | null>(null)
  const [form, setForm] = useState({ title: '', subject: '', description: '', scheduled_at: '', duration_mins: 60 })
  const notifTimer = useRef<ReturnType<typeof setTimeout>>()

  const showNotif = useCallback((message: string, type: Notification['type']) => {
    if (notifTimer.current) clearTimeout(notifTimer.current)
    setNotification({ id: crypto.randomUUID(), message, type })
    notifTimer.current = setTimeout(() => setNotification(null), 5000)
  }, [])

  useEffect(() => { if (profile) { loadMeetings(); loadEndedMeetings(); loadInvitedMeetings() } }, [profile])

  // ── REALTIME SUBSCRIPTION ──
  useEffect(() => {
    if (!profile) return

    const channel = supabase
      .channel('meetings-live')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'meetings' },
        (payload) => {
          const changed = payload.new as Meeting | null
          if (!changed) return

          if (payload.eventType === 'INSERT') {
            setMeetings(prev => [changed, ...prev])
            showNotif(`New meeting scheduled: ${changed.title}`, 'info')
          }

          if (payload.eventType === 'UPDATE') {
            const old = payload.old as Meeting
            setMeetings(prev => prev.map(m => m.meeting_id === changed.meeting_id ? changed : m))
            setEndedMeetings(prev => prev.filter(m => m.meeting_id !== changed.meeting_id))
            setInvitedMeetings(prev => prev.map(m => m.meeting_id === changed.meeting_id ? changed : m).filter(m => m.status !== 'ended'))

            if (old.status === 'scheduled' && changed.status === 'live') {
              showNotif(`🔴 ${changed.title} is live now!`, 'live')
            }
            if (changed.status === 'ended') {
              setEndedMeetings(prev => {
                if (prev.find(m => m.meeting_id === changed.meeting_id)) return prev
                return [changed, ...prev]
              })
              showNotif(`Meeting ended: ${changed.title}`, 'success')
            }
          }

          if (payload.eventType === 'DELETE') {
            setMeetings(prev => prev.filter(m => m.meeting_id !== payload.old.meeting_id))
            setInvitedMeetings(prev => prev.filter(m => m.meeting_id !== payload.old.meeting_id))
          }
        })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'meeting_participants' },
        async (payload) => {
          const p = payload.new as MeetingParticipant
          if (payload.eventType === 'INSERT' && p.status === 'pending') {
            showNotif('New join request!', 'info')
          }
          if (payload.eventType === 'UPDATE') {
            const old = payload.old as MeetingParticipant
            if (old.status === 'pending' && p.status === 'approved') {
              showNotif('Join request approved!', 'success')
            }
            if (old.status === 'pending' && p.status === 'refused') {
              showNotif('Join request refused', 'info')
            }
          }
          setParticipants(prev => {
            const existing = prev[p.meeting_id] || []
            const updated = existing.map(x => x.id === p.id ? p : x)
            if (!existing.find(x => x.id === p.id)) updated.push(p)
            return { ...prev, [p.meeting_id]: updated }
          })
          if (!participantNames[p.user_id]) {
            const { data } = await supabase.from('users').select('name').eq('user_id', p.user_id).single()
            if (data) setParticipantNames(prev => ({ ...prev, [p.user_id]: data.name }))
          }
        })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'meeting_invites' },
        (payload) => {
          const inv = payload.new as MeetingInvite
          if (inv.user_id === profile.user_id) {
            showNotif('You have been invited to a meeting!', 'info')
            loadInvitedMeetings()
          }
        })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile])

  // Check for meetings starting soon on mount
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      meetings.forEach(m => {
        if (m.status !== 'scheduled') return
        const diff = new Date(m.scheduled_at).getTime() - now.getTime()
        if (diff > 0 && diff < 600000) {
          showNotif(`⏰ ${m.title} starts in ${Math.round(diff / 60000)} minutes`, 'info')
        }
      })
    }, 60000)
    return () => clearInterval(interval)
  }, [meetings])

  async function fetchParticipantName(userId: string) {
    if (participantNames[userId]) return
    const { data } = await supabase.from('users').select('name').eq('user_id', userId).single()
    if (data) setParticipantNames(prev => ({ ...prev, [userId]: data.name }))
  }

  async function loadParticipants(meetingId: string) {
    const { data } = await supabase
      .from('meeting_participants')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('joined_at', { ascending: true })
    const list = (data as MeetingParticipant[]) || []
    setParticipants(prev => ({ ...prev, [meetingId]: list }))
    list.forEach(p => fetchParticipantName(p.user_id))
  }

  async function loadInvites(meetingId: string) {
    const { data } = await supabase
      .from('meeting_invites')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('invited_at', { ascending: true })
    const list = (data as MeetingInvite[]) || []
    setInvites(prev => ({ ...prev, [meetingId]: list }))
  }

  async function loadMeetings() {
    setLoading(true)
    const { data } = await supabase
      .from('meetings')
      .select('*')
      .in('status', ['scheduled', 'live'])
      .order('scheduled_at', { ascending: true })
    setMeetings((data as Meeting[]) || [])
    setLoading(false)
  }

  async function loadEndedMeetings() {
    const { data } = await supabase
      .from('meetings')
      .select('*')
      .eq('status', 'ended')
      .order('scheduled_at', { ascending: false })
      .limit(20)
    setEndedMeetings((data as Meeting[]) || [])
  }

  async function loadInvitedMeetings() {
    if (!profile) return
    const { data: inviteData } = await supabase
      .from('meeting_invites')
      .select('meeting_id')
      .eq('user_id', profile.user_id)
      .in('status', ['pending', 'accepted'])
    if (!inviteData?.length) { setInvitedMeetings([]); return }
    const ids = inviteData.map(i => i.meeting_id)
    const { data } = await supabase
      .from('meetings')
      .select('*')
      .in('meeting_id', ids)
      .in('status', ['scheduled', 'live'])
    setInvitedMeetings((data as Meeting[]) || [])
  }

  async function createMeeting() {
    if (!profile || !form.title || !form.scheduled_at) return
    setCreating(true)
    try {
      const meetingId = crypto.randomUUID()
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token || SUPABASE_ANON
      const res = await fetch(apiUrl('create-meeting'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          meetingId,
          hostId: profile.user_id,
          title: form.title,
          subject: form.subject,
          scheduledAt: form.scheduled_at,
          durationMins: form.duration_mins,
          userName: profile.name || profile.user_id,
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
        host_name: profile.name || '',
        created_at: new Date().toISOString(),
      })
      if (dbErr) throw new Error(dbErr.message)

      setShowCreate(false)
      setForm({ title: '', subject: '', description: '', scheduled_at: '', duration_mins: 60 })
      showNotif('Meeting created successfully!', 'success')
    } catch (e: any) {
      alert('Failed to create meeting: ' + (e.message || 'Unknown error'))
    } finally {
      setCreating(false)
    }
  }

  async function deleteMeeting(meeting: Meeting) {
    if (!confirm(`Delete "${meeting.title}"? This cannot be undone.`)) return
    const { error } = await supabase.from('meetings').delete().eq('meeting_id', meeting.meeting_id)
    if (error) { showNotif('Failed to delete meeting', 'error'); return }
    setMeetings(prev => prev.filter(m => m.meeting_id !== meeting.meeting_id))
    setEndedMeetings(prev => prev.filter(m => m.meeting_id !== meeting.meeting_id))
    setInvitedMeetings(prev => prev.filter(m => m.meeting_id !== meeting.meeting_id))
    showNotif('Meeting deleted', 'success')
  }

  async function joinMeeting(meeting: Meeting) {
    if (!profile) return
    const isHost = meeting.host_id === profile.user_id

    let roomUrl = meeting.room_url
    if (!roomUrl || roomUrl.includes('tutorug.daily.co')) {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token || SUPABASE_ANON
      const res = await fetch(apiUrl('create-meeting'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          meetingId: meeting.meeting_id, hostId: meeting.host_id, title: meeting.title,
          subject: meeting.subject, scheduledAt: meeting.scheduled_at, durationMins: meeting.duration_mins,
          userName: profile.name || profile.user_id,
        }),
      })
      const data = await res.json()
      roomUrl = data.roomUrl
      await supabase.from('meetings').update({ room_url: roomUrl }).eq('meeting_id', meeting.meeting_id)
    }

    // If not host, check approval status
    if (!isHost) {
      const { data: existing } = await supabase
        .from('meeting_participants')
        .select('status')
        .eq('meeting_id', meeting.meeting_id)
        .eq('user_id', profile.user_id)
        .single()

      if (existing && existing.status === 'refused') {
        showNotif('Your join request was refused by the host', 'error')
        return
      }

      if (existing && existing.status === 'pending') {
        showNotif('Your join request is pending host approval', 'info')
        return
      }

      if (!existing) {
        await supabase.from('meeting_participants').upsert({
          meeting_id: meeting.meeting_id,
          user_id: profile.user_id,
          join_token: '',
          status: 'pending',
          joined_at: new Date().toISOString(),
        }, { onConflict: 'meeting_id, user_id' })
        showNotif('Join request sent! Waiting for host approval.', 'info')
        return
      }
    }

    if (isHost) {
      await supabase.from('meetings').update({ status: 'live' }).eq('meeting_id', meeting.meeting_id)
    }

    window.open(roomUrl, '_blank', 'noopener,noreferrer')
  }

  async function approveParticipant(participant: MeetingParticipant) {
    await supabase.from('meeting_participants').update({ status: 'approved', join_token: '' }).eq('id', participant.id)
    setParticipants(prev => {
      const list = prev[participant.meeting_id] || []
      return { ...prev, [participant.meeting_id]: list.map(p => p.id === participant.id ? { ...p, status: 'approved' as const } : p) }
    })
    showNotif('Participant approved', 'success')
  }

  async function refuseParticipant(participant: MeetingParticipant) {
    await supabase.from('meeting_participants').update({ status: 'refused' }).eq('id', participant.id)
    setParticipants(prev => {
      const list = prev[participant.meeting_id] || []
      return { ...prev, [participant.meeting_id]: list.map(p => p.id === participant.id ? { ...p, status: 'refused' as const } : p) }
    })
    showNotif('Participant refused', 'info')
  }

  async function endMeeting(meeting: Meeting) {
    await supabase.from('meetings').update({ status: 'ended' }).eq('meeting_id', meeting.meeting_id)
    showNotif(`"${meeting.title}" has ended`, 'success')
  }

  async function shareMeeting(meeting: Meeting) {
    const text = [
      `📚 *${meeting.title}*`,
      meeting.subject ? `Subject: ${meeting.subject}` : '',
      meeting.description ? `Description: ${meeting.description}` : '',
      `Scheduled: ${new Date(meeting.scheduled_at).toLocaleString('en-UG')}`,
      `Duration: ${meeting.duration_mins} min`,
      `Status: ${meeting.status === 'live' ? '🔴 Live Now' : '📅 Scheduled'}`,
      '',
      `Join: ${window.location.origin}/meetings`,
      `Room: ${meeting.room_url || 'TutorUG Video'}`,
    ].filter(Boolean).join('\n')

    if (navigator.share) {
      try { await navigator.share({ title: meeting.title, text }) } catch {}
    } else {
      await navigator.clipboard.writeText(text)
      showNotif('Meeting details copied to clipboard!', 'success')
    }
  }

  async function sendInvites(meetingId: string) {
    if (!inviteEmails.trim()) return
    setSendingInvite(true)
    try {
      const emailList = inviteEmails.split(',').map(e => e.trim()).filter(Boolean)
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token || SUPABASE_ANON
      const res = await fetch(apiUrl('invite-to-meeting'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          meetingId,
          emails: emailList,
          hostName: profile?.name || 'A TutorUG user',
        }),
      })
      if (!res.ok) throw new Error('Failed to send invites')
      const data = await res.json()
      showNotif(`Invited ${data.invited?.length || 0} people!`, 'success')
      setInviteEmails('')
      setShowInviteForm(null)
      loadInvites(meetingId)
    } catch (e: any) {
      showNotif('Failed to send invites: ' + (e.message || 'Unknown error'), 'error')
    } finally {
      setSendingInvite(false)
    }
  }

  function viewParticipants(meetingId: string) {
    if (showParticipants === meetingId) {
      setShowParticipants(null)
      return
    }
    setShowParticipants(meetingId)
    setShowInvites(null)
    if (!participants[meetingId]) loadParticipants(meetingId)
  }

  function viewInvites(meetingId: string) {
    if (showInvites === meetingId) {
      setShowInvites(null)
      return
    }
    setShowInvites(meetingId)
    setShowParticipants(null)
    if (!invites[meetingId]) loadInvites(meetingId)
  }

  if (!profile) return null

  const liveMeetings = meetings.filter(m => m.status === 'live')
  const scheduledMeetings = meetings.filter(m => m.status === 'scheduled')
  const myInvited = invitedMeetings.filter(m => m.host_id !== profile.user_id)

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-surface to-bg relative overflow-hidden">
      <div className="w-full flex flex-col h-full">

        {/* ── DECORATIVE GLOW ── */}
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.08), transparent)' }} />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,184,0,0.06), transparent)' }} />

        {/* ── NOTIFICATION TOAST ── */}
        {notification && (
          <div
            className="absolute top-2 left-4 right-4 z-50 animate-slide-up"
            style={{ zIndex: 100 }}>
            <div className={`rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl backdrop-blur-sm ${
              notification.type === 'live'
                ? 'bg-error/20 border border-error/40'
                : notification.type === 'success'
                ? 'bg-lime/20 border border-lime/40'
                : notification.type === 'error'
                ? 'bg-error/20 border border-error/40'
                : 'bg-primary/20 border border-primary/40'
            }`}
            style={{
              background: notification.type === 'live' || notification.type === 'error'
                ? 'rgba(239,68,68,0.15)'
                : notification.type === 'success'
                ? 'rgba(132,204,22,0.15)'
                : 'rgba(255,184,0,0.15)',
            }}>
              <Bell size={18} className={
                notification.type === 'live' || notification.type === 'error' ? 'text-error shrink-0'
                : notification.type === 'success' ? 'text-lime shrink-0'
                : 'text-primary shrink-0'
              } />
              <span className="text-text-white text-sm flex-1">{notification.message}</span>
              <button onClick={() => setNotification(null)}
                className="text-text-disabled hover:text-text-white transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

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
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setShowEnded(!showEnded)}
              className="w-10 h-10 flex items-center justify-center rounded-full transition-colors hover:bg-white/5"
              title="Meeting history">
              <History size={20} className={showEnded ? 'text-primary' : 'text-text-disabled'} />
            </button>
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
          ) : meetings.length === 0 && !showEnded && myInvited.length === 0 ? (
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
              {/* ── MY MEETINGS ── */}
              {(liveMeetings.length > 0 || scheduledMeetings.length > 0) && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Video size={14} className="text-primary" />
                    <span className="text-primary text-xs font-bold uppercase tracking-wider">My Meetings</span>
                  </div>

                  {liveMeetings.length > 0 && (
                    <div className="space-y-3 mb-3">
                      {liveMeetings.map((m, i) => (
                        <MeetingCard
                          key={m.meeting_id}
                          meeting={m}
                          isHost={m.host_id === profile.user_id}
                          participantCount={participants[m.meeting_id]?.length || 0}
                          onJoin={joinMeeting}
                          onEnd={endMeeting}
                          onShare={shareMeeting}
                          onDelete={deleteMeeting}
                          onViewParticipants={viewParticipants}
                          showParticipants={showParticipants === m.meeting_id}
                          participantList={participants[m.meeting_id] || []}
                          participantNames={participantNames}
                          onInvite={() => setShowInviteForm(m.meeting_id)}
                          showInviteForm={showInviteForm === m.meeting_id}
                          inviteEmails={inviteEmails}
                          onInviteEmailsChange={setInviteEmails}
                          onSendInvites={() => sendInvites(m.meeting_id)}
                          sendingInvite={sendingInvite}
                          invites={invites[m.meeting_id] || []}
                          showInvites={showInvites === m.meeting_id}
                          onViewInvites={() => viewInvites(m.meeting_id)}
                          onApprove={approveParticipant}
                          onRefuse={refuseParticipant}
                          index={i}
                        />
                      ))}
                    </div>
                  )}

                  {scheduledMeetings.length > 0 && (
                    <div className="space-y-3">
                      {scheduledMeetings.map((m, i) => (
                        <MeetingCard
                          key={m.meeting_id}
                          meeting={m}
                          isHost={m.host_id === profile.user_id}
                          participantCount={participants[m.meeting_id]?.length || 0}
                          onJoin={joinMeeting}
                          onEnd={endMeeting}
                          onShare={shareMeeting}
                          onDelete={deleteMeeting}
                          onViewParticipants={viewParticipants}
                          showParticipants={showParticipants === m.meeting_id}
                          participantList={participants[m.meeting_id] || []}
                          participantNames={participantNames}
                          onInvite={() => setShowInviteForm(m.meeting_id)}
                          showInviteForm={showInviteForm === m.meeting_id}
                          inviteEmails={inviteEmails}
                          onInviteEmailsChange={setInviteEmails}
                          onSendInvites={() => sendInvites(m.meeting_id)}
                          sendingInvite={sendingInvite}
                          invites={invites[m.meeting_id] || []}
                          showInvites={showInvites === m.meeting_id}
                          onViewInvites={() => viewInvites(m.meeting_id)}
                          onApprove={approveParticipant}
                          onRefuse={refuseParticipant}
                          index={i + liveMeetings.length}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── INVITED MEETINGS ── */}
              {myInvited.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Mail size={14} className="text-lime" />
                    <span className="text-lime text-xs font-bold uppercase tracking-wider">
                      Invited to ({myInvited.length})
                    </span>
                  </div>
                  <div className="space-y-3">
                    {myInvited.map((m, i) => (
                      <MeetingCard
                        key={m.meeting_id}
                        meeting={m}
                        isHost={false}
                        participantCount={participants[m.meeting_id]?.length || 0}
                        onJoin={joinMeeting}
                        onEnd={endMeeting}
                        onShare={shareMeeting}
                        onDelete={deleteMeeting}
                        onViewParticipants={viewParticipants}
                        showParticipants={showParticipants === m.meeting_id}
                        participantList={participants[m.meeting_id] || []}
                        participantNames={participantNames}
                        invites={[]}
                        showInvites={false}
                        onViewInvites={() => {}}
                        onApprove={approveParticipant}
                        onRefuse={refuseParticipant}
                        index={i}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ── ENDED MEETINGS ── */}
              {showEnded && endedMeetings.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <History size={14} className="text-text-disabled" />
                    <span className="text-text-disabled text-xs font-bold uppercase tracking-wider">
                      Past Meetings ({endedMeetings.length})
                    </span>
                  </div>
                  <div className="space-y-3">
                    {endedMeetings.map((m, i) => (
                      <MeetingCard
                        key={m.meeting_id}
                        meeting={m}
                        isHost={m.host_id === profile.user_id}
                        participantCount={participants[m.meeting_id]?.length || 0}
                        onJoin={joinMeeting}
                        onEnd={endMeeting}
                        onShare={shareMeeting}
                        onDelete={deleteMeeting}
                        onViewParticipants={viewParticipants}
                        showParticipants={showParticipants === m.meeting_id}
                        participantList={participants[m.meeting_id] || []}
                        participantNames={participantNames}
                        invites={[]}
                        showInvites={false}
                        onViewInvites={() => {}}
                        onApprove={approveParticipant}
                        onRefuse={refuseParticipant}
                        index={i}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ── SHOW HISTORY HINT ── */}
              {!showEnded && endedMeetings.length > 0 && (
                <button onClick={() => setShowEnded(true)}
                  className="w-full py-3 rounded-2xl text-sm font-medium transition-all hover:bg-white/5 flex items-center justify-center gap-2"
                  style={{ color: '#C0C0D8', background: 'rgba(255,255,255,0.03)' }}>
                  <History size={15} />
                  View past meetings ({endedMeetings.length})
                </button>
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
                  placeholder="What will this meeting cover?" rows={2}
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
  meeting, isHost, participantCount, onJoin, onEnd, onShare, onDelete,
  onViewParticipants, showParticipants, participantList, participantNames,
  onInvite, showInviteForm, inviteEmails, onInviteEmailsChange, onSendInvites,
  sendingInvite, invites, showInvites, onViewInvites, onApprove, onRefuse, index,
}: {
  meeting: Meeting; isHost: boolean; participantCount: number
  onJoin: (m: Meeting) => void; onEnd: (m: Meeting) => void
  onShare: (m: Meeting) => void; onDelete: (m: Meeting) => void
  onViewParticipants: (id: string) => void
  showParticipants: boolean
  participantList: MeetingParticipant[]
  participantNames: Record<string, string>
  onInvite?: () => void; showInviteForm?: boolean
  inviteEmails?: string; onInviteEmailsChange?: (v: string) => void
  onSendInvites?: () => void; sendingInvite?: boolean
  invites?: MeetingInvite[]; showInvites?: boolean; onViewInvites?: () => void
  onApprove: (p: MeetingParticipant) => void
  onRefuse: (p: MeetingParticipant) => void
  index: number
}) {
  const isLive = meeting.status === 'live'
  const isEnded = meeting.status === 'ended'
  const info = formatDateTimeStatic(meeting.scheduled_at)
  const pendingParticipants = participantList.filter(p => p.status === 'pending')
  const approvedParticipants = participantList.filter(p => p.status !== 'refused')

  return (
    <div
      className="rounded-2xl p-5 transition-all duration-200 hover:scale-[1.01]"
      style={{
        animation: `slideUp 0.3s ease-out ${index * 0.05}s both`,
        background: 'linear-gradient(135deg, #12122A, #1A1A3A)',
        border: isLive
          ? '1.5px solid rgba(239,68,68,0.5)'
          : isEnded
          ? '1px solid rgba(96,96,128,0.2)'
          : '1px solid rgba(255,184,0,0.12)',
        boxShadow: isLive
          ? '0 0 30px rgba(239,68,68,0.08)'
          : '0 4px 20px rgba(0,0,0,0.2)',
        opacity: isEnded ? 0.65 : 1,
      }}>
      {/* Status badge + action buttons row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isLive ? (
            <>
              <div className="w-2 h-2 rounded-full bg-error animate-pulse" />
              <span className="text-error text-xs font-bold">LIVE NOW</span>
            </>
          ) : isEnded ? (
            <>
              <CheckCircle2 size={13} className="text-text-disabled" />
              <span className="text-text-disabled text-xs font-medium">Ended</span>
            </>
          ) : info.urgent ? (
            <>
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-primary text-xs font-medium">{info.label}</span>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {isHost && !isEnded && (
            <button onClick={(e) => { e.stopPropagation(); onShare(meeting) }}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
              title="Share meeting">
              <Share2 size={14} className="text-text-disabled" />
            </button>
          )}
          {isHost && !isEnded && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(meeting) }}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-error/20 transition-colors"
              title="Delete meeting">
              <Trash2 size={14} className="text-error" />
            </button>
          )}
          {isHost && isLive && (
            <button onClick={(e) => { e.stopPropagation(); onEnd(meeting) }}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-error/20 transition-colors"
              title="End meeting">
              <StopCircle size={15} className="text-error" />
            </button>
          )}
          {isHost && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(255,184,0,0.12)', color: '#FFB800' }}>
              Host
            </span>
          )}
        </div>
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
        {!isEnded && (
          <button onClick={(e) => { e.stopPropagation(); onViewParticipants(meeting.meeting_id) }}
            className="flex items-center gap-1.5 text-xs transition-colors"
            style={{ color: participantCount > 0 ? '#84CC16' : '#606080' }}>
            <UserCheck size={13} />
            <span>{participantCount} joined</span>
            {showParticipants ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
        {isHost && !isEnded && onViewInvites && (
          <button onClick={(e) => { e.stopPropagation(); onViewInvites() }}
            className="flex items-center gap-1.5 text-xs transition-colors"
            style={{ color: '#606080' }}>
            <Mail size={13} />
            <span>Invited</span>
            {showInvites ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>

      {/* ── PARTICIPANT ROSTER ── */}
      {showParticipants && (
        <div className="mt-3 pt-3 animate-fade-in"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-text-disabled text-xs font-medium mb-2">Participants</p>

          {/* Pending requests (host only) */}
          {isHost && pendingParticipants.length > 0 && (
            <div className="mb-2">
              <p className="text-primary text-[10px] font-bold uppercase mb-1">Pending Approval</p>
              {pendingParticipants.map(p => (
                <div key={p.id} className="flex items-center gap-2 mb-1.5 p-1.5 rounded-lg"
                  style={{ background: 'rgba(255,184,0,0.06)' }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#0A0A1F' }}>
                    {(participantNames[p.user_id] || '?').charAt(0).toUpperCase()}
                  </div>
                  <span className="text-text-white text-xs font-medium flex-1">
                    {participantNames[p.user_id] || 'Loading...'}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); onApprove(p) }}
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-lime/20 transition-colors"
                    title="Approve">
                    <Check size={14} className="text-lime" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onRefuse(p) }}
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-error/20 transition-colors"
                    title="Refuse">
                    <Ban size={14} className="text-error" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {approvedParticipants.length === 0 ? (
            <p className="text-text-disabled text-xs">No one has joined yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {approvedParticipants.map(p => (
                <div key={p.id} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#0A0A1F' }}>
                    {(participantNames[p.user_id] || '?').charAt(0).toUpperCase()}
                  </div>
                  <span className="text-text-white text-xs font-medium">
                    {participantNames[p.user_id] || 'Loading...'}
                  </span>
                  {p.user_id === meeting.host_id && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                      style={{ background: 'rgba(255,184,0,0.12)', color: '#FFB800' }}>
                      Host
                    </span>
                  )}
                  {p.status === 'pending' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                      style={{ background: 'rgba(255,184,0,0.12)', color: '#FFB800' }}>
                      Pending
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── INVITE FORM (host only) ── */}
      {isHost && showInviteForm && (
        <div className="mt-3 pt-3 animate-fade-in"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-text-disabled text-xs font-medium mb-2">Invite by Email</p>
          <div className="flex gap-2">
            <input
              value={inviteEmails || ''}
              onChange={e => onInviteEmailsChange?.(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
              className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
            />
            <button onClick={onSendInvites} disabled={sendingInvite || !inviteEmails?.trim()}
              className="h-9 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#0A0A1F' }}>
              {sendingInvite ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Invite
            </button>
          </div>
          <p className="text-text-disabled text-[10px] mt-1.5">Separate multiple emails with commas</p>
        </div>
      )}

      {/* ── INVITED LIST (host only) ── */}
      {isHost && showInvites && invites && (
        <div className="mt-3 pt-3 animate-fade-in"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-text-disabled text-xs font-medium">Invited People</p>
            {onInvite && (
              <button onClick={(e) => { e.stopPropagation(); onInvite() }}
                className="flex items-center gap-1 text-[10px] font-bold"
                style={{ color: '#FFB800' }}>
                <UserPlus size={11} /> Add More
              </button>
            )}
          </div>
          {invites.length === 0 ? (
            <p className="text-text-disabled text-xs">No invites sent yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {invites.map(inv => (
                <div key={inv.id} className="flex items-center gap-2">
                  <Mail size={12} className="text-text-disabled shrink-0" />
                  <span className="text-text-white text-xs font-medium flex-1">{inv.email}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    inv.status === 'accepted' ? 'bg-lime/20 text-lime'
                    : inv.status === 'refused' ? 'bg-error/20 text-error'
                    : 'bg-primary/20 text-primary'
                  }`}>
                    {inv.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CTA row */}
      {!isEnded ? (
        <div className="flex gap-2 mt-4">
          <button onClick={() => onShare(meeting)}
            className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all active:scale-90 shrink-0"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            title="Copy meeting details">
            {typeof navigator.share === 'function' ? <Share2 size={16} className="text-text-disabled" /> : <Copy size={16} className="text-text-disabled" />}
          </button>
          {isHost && onInvite && (
            <button onClick={(e) => { e.stopPropagation(); onInvite() }}
              className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all active:scale-90 shrink-0"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              title="Invite people">
              <UserPlus size={16} className="text-text-disabled" />
            </button>
          )}
          <button onClick={() => onJoin(meeting)}
            className="flex-1 h-11 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
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
      ) : (
        <div className="flex gap-2 mt-4">
          <button onClick={() => onShare(meeting)}
            className="flex-1 h-11 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#C0C0D8' }}>
            <ExternalLink size={15} />
            View Details
          </button>
          {isHost && onDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(meeting) }}
              className="h-11 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
      )}
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
