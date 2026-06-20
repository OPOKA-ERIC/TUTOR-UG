import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, Users, BookOpen, Loader2, ShieldAlert } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { apiUrl } from '@/lib/api'
import { SUPABASE_ANON } from '@/lib/supabase'
import type { StudyRoom, RoomMessage } from '@/types'

export default function StudyRoomsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<StudyRoom[]>([])
  const [activeRoom, setActiveRoom] = useState<StudyRoom | null>(null)
  const [messages, setMessages] = useState<RoomMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadRooms() }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    if (!activeRoom) return
    loadMessages(activeRoom.room_id)
    const channel = supabase
      .channel(`room:${activeRoom.room_id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'room_messages',
        filter: `room_id=eq.${activeRoom.room_id}`,
      }, payload => {
        setMessages(m => [...m, payload.new as RoomMessage])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeRoom])

  async function loadRooms() {
    const { data } = await supabase.from('study_rooms').select('*').order('subject')
    setRooms((data as StudyRoom[]) || [])
  }

  async function loadMessages(roomId: string) {
    const { data } = await supabase
      .from('room_messages').select('*')
      .eq('room_id', roomId).eq('flagged', false)
      .order('created_at', { ascending: true }).limit(100)
    setMessages((data as RoomMessage[]) || [])
  }

  async function sendMessage() {
    if (!input.trim() || !profile || !activeRoom || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    setBlocked(false)

    // Moderate first
    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token || SUPABASE_ANON
    const modRes = await fetch(apiUrl('moderate-message'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ message: text, subject: activeRoom.subject, userName: profile.name }),
    })
    const { allowed } = await modRes.json()

    if (!allowed) {
      setBlocked(true)
      setSending(false)
      setTimeout(() => setBlocked(false), 4000)
      return
    }

    await supabase.from('room_messages').insert({
      room_id: activeRoom.room_id,
      user_id: profile.user_id,
      user_name: profile.name,
      user_avatar: profile.avatar_url || '',
      content: text,
      flagged: false,
      created_at: new Date().toISOString(),
    })
    setSending(false)
  }

  const inputStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }

  if (!profile) return null

  // ── CHAT VIEW ──────────────────────────────────────────────────────────────
  if (activeRoom) {
    return (
      <div className="flex flex-col h-full bg-bg items-center">
        <div className="max-w-3xl mx-auto w-full flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: '#12122A', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={() => { setActiveRoom(null); setMessages([]) }}
            className="w-8 h-8 bg-surface-input rounded-full flex items-center justify-center">
            <ArrowLeft size={16} className="text-text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-text-white font-bold text-sm truncate">{activeRoom.subject}</p>
            <p className="text-text-disabled text-xs truncate">{activeRoom.education_level || 'All levels'} · Academic chat</p>
          </div>
          <div className="flex items-center gap-1 text-text-disabled text-xs">
            <Users size={13} />
            <span>{activeRoom.member_count || 0}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
              <BookOpen size={36} className="text-text-disabled" />
              <p className="text-text-white font-semibold">Start the discussion!</p>
              <p className="text-text-disabled text-xs">Only academic messages are allowed.</p>
            </div>
          )}
          {messages.map(msg => {
            const isMe = msg.user_id === profile.user_id
            return (
              <div key={msg.message_id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#0A0A1F' }}>
                  {msg.user_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="max-w-[72%]">
                  {!isMe && <p className="text-primary text-xs font-semibold mb-0.5 ml-1">{msg.user_name}</p>}
                  <div className="px-3 py-2 rounded-2xl text-sm"
                    style={isMe
                      ? { background: 'linear-gradient(135deg,#F59E0B80,#D97706)', color: '#1A1A1A' }
                      : { background: '#1A1A3A', border: '1px solid rgba(255,184,0,0.2)', color: '#F0F0FF' }}>
                    {msg.content}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {blocked && (
          <div className="mx-4 mb-2 px-3 py-2 rounded-xl flex items-center gap-2 text-xs font-medium"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
            <ShieldAlert size={14} />
            Message blocked — only academic topics are allowed in study rooms.
          </div>
        )}

        <div className="px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 rounded-full"
            style={{ background: 'linear-gradient(135deg,#1A1A3A,#12122A)', border: '1.5px solid rgba(255,184,0,0.6)' }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
              placeholder="Ask an academic question…"
              className="flex-1 bg-transparent outline-none text-sm text-text-white placeholder-text-disabled" />
            <button onClick={sendMessage} disabled={!input.trim() || sending}
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}>
              {sending ? <Loader2 size={15} className="animate-spin text-white" /> : <Send size={15} className="text-white" />}
            </button>
          </div>
        </div>
      </div>
      </div>
    )
  }

  // ── ROOM LIST ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-surface to-bg overflow-hidden items-center">
      <div className="max-w-3xl mx-auto w-full flex flex-col h-full">
      <div className="bg-gradient-to-r from-surface to-surface-var px-2 py-2 flex items-center gap-2 shrink-0">
        <button onClick={() => navigate('/chat')} className="w-10 h-10 flex items-center justify-center shrink-0">
          <div className="w-8 h-8 bg-surface-input rounded-full flex items-center justify-center">
            <ArrowLeft size={16} className="text-text-white" />
          </div>
        </button>
        <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0"
          style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#0A0A1F' }}>T</div>
        <p className="text-text-white font-bold text-lg flex-1">Study Rooms</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <p className="text-text-disabled text-xs font-bold uppercase tracking-wider">ACADEMIC DISCUSSION ROOMS</p>
        <p className="text-text-disabled text-xs mb-3">All messages are moderated — academic topics only.</p>
        {rooms.map(room => (
          <button key={room.room_id} onClick={() => setActiveRoom(room)}
            className="w-full text-left rounded-2xl p-4 transition-all"
            style={{ background: '#12122A', border: '1px solid rgba(255,184,0,0.15)' }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-text-white font-bold">{room.subject}</p>
                {room.education_level && <p className="text-primary text-xs mt-0.5">{room.education_level}</p>}
                {room.description && <p className="text-text-disabled text-xs mt-1">{room.description}</p>}
              </div>
              <div className="flex items-center gap-1 text-text-disabled text-xs shrink-0 mt-1">
                <Users size={13} />
                <span>{room.member_count || 0}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
    </div>
  )
}
