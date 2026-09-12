import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Users, MessageSquare, FileText, Star, ShieldAlert,
  Shield, ShieldCheck, Trash2, Loader2, CheckCircle2, EyeOff,
  Search, Crown, Activity, TrendingUp, BookOpen, UserCheck, AlertTriangle,
  BarChart2, Sparkles, Clock, ArrowUpRight, ArrowUp, ArrowDown, CalendarDays, Gauge, Zap,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import type { UserProfile, AppReview, RoomMessage, QuizResult } from '@/types'

type Tab = 'overview' | 'reviews' | 'moderation' | 'admins'

const TABS: { id: Tab; label: string; icon: any; hint: string }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart2, hint: 'Platform pulse' },
  { id: 'reviews', label: 'Reviews', icon: Star, hint: 'Ratings & feedback' },
  { id: 'moderation', label: 'Moderation', icon: ShieldAlert, hint: 'Flagged content' },
  { id: 'admins', label: 'Admins', icon: Crown, hint: 'Team access' },
]

const INK = '#0B0A1E'

// ── Shared surfaces ──────────────────────────────────────────────────────────
function Card({ children, className = '', glow = '' }: { children: React.ReactNode; className?: string; glow?: string }) {
  return (
    <div
      className={`relative rounded-2xl overflow-hidden transition-all duration-300 ${className}`}
      style={{
        background: 'linear-gradient(160deg, rgba(18,17,44,0.92), rgba(10,10,30,0.9))',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: glow
          ? `0 0 0 1px rgba(255,255,255,0.02), 0 12px 40px -18px ${glow}`
          : '0 10px 34px -20px rgba(0,0,0,0.9)',
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)' }} />
      {children}
    </div>
  )
}

function GradText({ from, to, children }: { from: string; to: string; children: React.ReactNode }) {
  return (
    <span
      className="bg-clip-text text-transparent"
      style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      {children}
    </span>
  )
}

// ── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, from, to, color, sub, trend }: {
  icon: any; label: string; value: string | number; from: string; to: string; color: string; sub?: string; trend?: string
}) {
  return (
    <Card className="p-4 group hover:-translate-y-0.5" glow={`${color}40`}>
      <div className="flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110"
          style={{
            background: `linear-gradient(135deg, ${from}, ${to})`,
            color: INK,
            boxShadow: `0 10px 24px -8px ${color}66`,
          }}>
          <Icon size={19} strokeWidth={2.4} />
        </div>
        <div className="min-w-0">
          <p className="text-2xl lg:text-[27px] font-black leading-[1.3] tabular-nums tracking-tight">
            <GradText from="#fff" to="#C9C8FF">{value}</GradText>
          </p>
          <p className="text-text-disabled text-[10.5px] font-bold uppercase tracking-[0.14em] mt-1 truncate">{label}</p>
        </div>
        {trend && (
          <span
            className="ml-auto shrink-0 px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-0.5 uppercase tracking-wide"
            style={{ background: `rgba(${color.replace('#', '')}1A)` as any, color, border: `1px solid ${color}33` }}>
            <ArrowUpRight size={11} strokeWidth={2.6} /> {trend}
          </span>
        )}
      </div>
      {sub && (
        <p className="text-[11px] mt-3 pt-2.5 border-t border-white/[0.06] flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.42)' }}>
          <Gauge size={11} style={{ color }} /> {sub}
        </p>
      )}
    </Card>
  )
}

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} size={size}
          fill={n <= rating ? '#FFC107' : 'transparent'}
          style={{ color: n <= rating ? '#FFC107' : 'rgba(255,255,255,0.15)' }} />
      ))}
    </div>
  )
}

function formatDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatRelative(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (isNaN(diff)) return '—'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${Math.max(mins, 0)}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(iso)
}

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #FFB800, #E54800)',
  'linear-gradient(135deg, #00E5FF, #0884FF)',
  'linear-gradient(135deg, #A78BFA, #7C3AED)',
  'linear-gradient(135deg, #34D399, #059669)',
  'linear-gradient(135deg, #F472B6, #DB2777)',
  'linear-gradient(135deg, #FCD34D, #F59E0B)',
]

function Avatar({ name, size = 40, gradient }: { name?: string; size?: number; gradient?: string }) {
  const g = gradient || AVATAR_GRADIENTS[Math.abs(String(name || '?').charCodeAt(0)) % AVATAR_GRADIENTS.length]
  return (
    <div
      className="rounded-full flex items-center justify-center font-black shrink-0"
      style={{
        width: size, height: size, fontSize: size * 0.42, color: INK,
        background: g,
        boxShadow: `0 6px 18px -6px rgba(255,184,0,0.35)`,
      }}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  )
}

export default function AdminPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [users, setUsers] = useState<UserProfile[]>([])
  const [reviews, setReviews] = useState<AppReview[]>([])
  const [flagged, setFlagged] = useState<RoomMessage[]>([])
  const [quizAll, setQuizAll] = useState<QuizResult[]>([])
  const [msgCount, setMsgCount] = useState(0)
  const [docCount, setDocCount] = useState(0)

  const [adminEmail, setAdminEmail] = useState('')
  const [adminActionLoading, setAdminActionLoading] = useState(false)
  const [adminMsg, setAdminMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    if (!profile || profile.role !== 'admin') { setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      const [u, m, d] = await Promise.all([
        supabase.rpc('admin_list_users'),
        supabase.from('chat_messages').select('*', { count: 'exact', head: true }),
        supabase.from('documents').select('*', { count: 'exact', head: true }),
      ])
      if (u.error) throw u.error
      setUsers((u.data as UserProfile[]) || [])
      setMsgCount(m.count ?? 0)
      setDocCount(d.count ?? 0)

      const r = await supabase.from('reviews').select('*').order('created_at', { ascending: false })
      if (!r.error) setReviews((r.data as AppReview[]) || [])

      const f = await supabase.from('room_messages').select('*').eq('flagged', true).order('created_at', { ascending: false })
      if (!f.error) setFlagged((f.data as RoomMessage[]) || [])

      const q = await supabase.from('quiz_results').select('*')
      if (!q.error) setQuizAll((q.data as QuizResult[]) || [])
    } catch (e: any) {
      setError(e?.message || 'Could not load admin data.')
    } finally {
      setLoading(false)
    }
  }, [profile?.user_id, profile?.role])

  useEffect(() => { load() }, [load])

  if (!profile) return null

  if (profile.role !== 'admin') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <Card className="max-w-sm w-full p-8 text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <ShieldAlert size={26} style={{ color: '#EF4444' }} />
          </div>
          <h1 className="text-text-white text-lg font-bold">Access Restricted</h1>
          <p className="text-text-disabled text-sm mt-2">This area is only available to TutorUG admins.</p>
          <button onClick={() => navigate('/chat')}
            className="mt-6 w-full h-11 rounded-xl font-bold text-sm transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#0A0A1F' }}>
            Back to Chat
          </button>
        </Card>
      </div>
    )
  }

  const now = Date.now()
  const dayMs = 86400000
  const activeToday = users.filter(u => u.last_active && (now - new Date(u.last_active).getTime()) < dayMs).length
  const activeWeek = users.filter(u => u.last_active && (now - new Date(u.last_active).getTime()) < 7 * dayMs).length
  const newWeek = users.filter(u => u.created_at && (now - new Date(u.created_at).getTime()) < 7 * dayMs).length
  const newMonth = users.filter(u => u.created_at && (now - new Date(u.created_at).getTime()) < 30 * dayMs).length

  const eduBreakdown = users.reduce<Record<string, number>>((acc, u) => {
    const k = u.education_level || 'Unknown'
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})
  const eduSorted = Object.entries(eduBreakdown).sort((a, b) => b[1] - a[1])

  const districtBreakdown = users.reduce<Record<string, number>>((acc, u) => {
    const k = u.district || 'Unknown'
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})
  const districtTop = Object.entries(districtBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 8)

  const quizPassed = quizAll.filter(q => q.passed).length
  const quizPassRate = quizAll.length ? Math.round((quizPassed / quizAll.length) * 100) : 0
  const avgScore = quizAll.length ? Math.round(quizAll.reduce((s, q) => s + q.score, 0) / quizAll.length) : 0

  const approvedReviews = reviews.filter(r => r.status !== 'hidden')
  const avgRating = approvedReviews.length
    ? (approvedReviews.reduce((s, r) => s + r.rating, 0) / approvedReviews.length).toFixed(1)
    : '—'

  const reviewStatusCount = {
    pending: reviews.filter(r => r.status === 'pending').length,
    approved: reviews.filter(r => r.status === 'approved').length,
    hidden: reviews.filter(r => r.status === 'hidden').length,
  }

  const admins = users.filter(u => u.role === 'admin')
  const userName = (id: string) => users.find(u => u.user_id === id)

  async function updateReviewStatus(id: string, status: AppReview['status']) {
    await supabase.from('reviews').update({ status }).eq('review_id', id)
    setReviews(rs => rs.map(r => (r.review_id === id ? { ...r, status } : r)))
  }

  async function deleteMessage(id: string) {
    await supabase.from('room_messages').delete().eq('message_id', id)
    setFlagged(m => m.filter(msg => msg.message_id !== id))
  }

  async function promoteByEmail() {
    const email = adminEmail.trim().toLowerCase()
    if (!email) return
    setAdminActionLoading(true)
    setAdminMsg(null)
    const { data } = await supabase.rpc('admin_find_user', { p_email: email })
    const user = Array.isArray(data) ? data[0] : data
    if (!user) {
      setAdminMsg({ ok: false, text: 'No user found with that email.' })
      setAdminActionLoading(false)
      return
    }
    if (user.role === 'admin') {
      setAdminMsg({ ok: true, text: `${user.name || user.email} is already an admin.` })
      setAdminEmail('')
      setAdminActionLoading(false)
      return
    }
    const { error } = await supabase.from('users').update({ role: 'admin' }).eq('user_id', user.user_id)
    setAdminActionLoading(false)
    if (error) {
      setAdminMsg({ ok: false, text: error.message })
      return
    }
    setAdminEmail('')
    setAdminMsg({ ok: true, text: `${user.name || user.email} is now a Super Admin.` })
    await load()
  }

  const currentUserId = profile.user_id

  async function demote(userId: string) {
    if (userId === currentUserId) return
    if (admins.length <= 1) {
      setAdminMsg({ ok: false, text: 'You cannot remove the last admin.' })
      return
    }
    const { error } = await supabase.from('users').update({ role: 'student' }).eq('user_id', userId)
    if (!error) await load()
    else setAdminMsg({ ok: false, text: error.message })
  }

  return (
    <div className="relative min-h-screen" style={{ background: '#060617' }}>
      {/* Ambient background: grid + glows (unique Control Center identity) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,184,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,184,0,0.05) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage: 'radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 75%)',
          }} />
        <div className="absolute -top-40 right-[-10%] w-[640px] h-[640px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,184,0,0.14), transparent 62%)' }} />
        <div className="absolute -bottom-52 left-[-12%] w-[720px] h-[720px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.13), transparent 62%)' }} />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(0,229,255,0.06), transparent 60%)' }} />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="sticky top-0 z-30 border-b"
          style={{ background: 'rgba(6,6,23,0.82)', backdropFilter: 'blur(16px)', borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={() => navigate('/chat')}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors border border-white/[0.08] hover:border-white/20 hover:bg-white/5 shrink-0">
              <ChevronLeft size={18} className="text-text-white" />
            </button>
            <div className="relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg,#1A1A4A,#0B0A1E)', border: '1px solid rgba(255,184,0,0.35)' }}>
              <Crown size={18} style={{ color: '#FFB800' }} />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
                style={{ background: '#00E676', boxShadow: '0 0 8px #00E676' }} />
            </div>
            <div className="min-w-0">
              <p className="text-text-white font-black leading-tight tracking-tight">
                <GradText from="#FFB800" to="#FF7A00">Control Center</GradText>
              </p>
              <p className="text-text-disabled text-[11px] font-medium">TutorUG · Super Admin</p>
            </div>
            <div className="flex-1" />
            <span className="hidden sm:flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider items-center gap-1.5"
              style={{ background: 'rgba(0,230,118,0.08)', color: '#00E676', border: '1px solid rgba(0,230,118,0.18)' }}>
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: '#00E676' }} />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#00E676' }} />
              </span>
              Live
            </span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
              style={{ background: 'rgba(255,184,0,0.12)', color: '#FFB800', border: '1px solid rgba(255,184,0,0.25)' }}>
              <Crown size={11} /> {profile.name || 'Admin'}
            </span>
          </div>

          {/* Segmented tab nav */}
          <div className="max-w-6xl mx-auto px-4 pb-2.5 flex gap-1.5 overflow-x-auto">
            {TABS.map(t => {
              const active = tab === t.id
              const count = t.id === 'reviews' ? reviewStatusCount.pending
                : t.id === 'moderation' ? flagged.length : undefined
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className="px-3.5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all duration-200 active:scale-[0.97]"
                  style={{
                    background: active ? 'linear-gradient(135deg,#FFB800,#FF7A00)' : 'rgba(255,255,255,0.03)',
                    color: active ? INK : 'rgba(255,255,255,0.5)',
                    border: active ? '1px solid rgba(255,138,0,0.6)' : '1px solid rgba(255,255,255,0.07)',
                    boxShadow: active ? '0 8px 20px -8px rgba(255,184,0,0.55)' : 'none',
                  }}>
                  <t.icon size={15} strokeWidth={2.4} />
                  {t.label}
                  {count !== undefined && count > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none"
                      style={{
                        background: active ? 'rgba(11,10,30,0.9)' : 'rgba(239,68,68,0.9)',
                        color: active ? '#FFB800' : '#fff',
                      }}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="max-w-6xl mx-auto px-4 py-6 pb-24">
          {loading ? (
            <div className="flex items-center justify-center py-28 gap-3 text-text-disabled">
              <Loader2 size={20} className="animate-spin" style={{ color: '#FFB800' }} />
              <span className="font-semibold">Loading admin data…</span>
            </div>
          ) : error ? (
            <Card className="p-8 text-center">
              <AlertTriangle size={28} style={{ color: '#EF4444' }} className="mx-auto mb-3" />
              <p className="text-text-white font-bold">Failed to load data</p>
              <p className="text-text-disabled text-sm mt-1">{error}</p>
              <p className="text-text-disabled text-xs mt-3">Make sure the admin migration SQL has been run in Supabase.</p>
              <button onClick={() => load()}
                className="mt-5 px-5 h-10 rounded-xl font-bold text-sm"
                style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#0A0A1F' }}>
                Retry
              </button>
            </Card>
          ) : tab === 'overview' ? (
            <OverviewTab
              users={users} reviews={reviews} flaggedCount={flagged.length}
              msgCount={msgCount} docCount={docCount} quizCount={quizAll.length}
              activeToday={activeToday} activeWeek={activeWeek}
              newWeek={newWeek} newMonth={newMonth}
              eduSorted={eduSorted} districtTop={districtTop}
              quizPassRate={quizPassRate} avgScore={avgScore} avgRating={avgRating}
              adminName={profile.name || ''} />
          ) : tab === 'reviews' ? (
            <ReviewsTab
              reviews={reviews} userName={userName} users={users}
              avgRating={avgRating} counts={reviewStatusCount}
              onStatus={updateReviewStatus} />
          ) : tab === 'moderation' ? (
            <ModerationTab messages={flagged} userName={userName} onDelete={deleteMessage} />
          ) : (
            <AdminsTab
              admins={admins} users={users} currentUserId={profile.user_id}
              email={adminEmail} setEmail={setAdminEmail}
              loading={adminActionLoading} msg={adminMsg}
              onPromote={promoteByEmail} onDemote={demote} />
          )}
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ icon, color, from, to, children }: { icon: any; color: string; from: string; to: string; children: React.ReactNode }) {
  return (
    <p className="text-text-disabled text-xs font-black uppercase tracking-[0.16em] mb-3.5 flex items-center gap-2">
      <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `linear-gradient(135deg, ${from}, ${to})`, color: INK, boxShadow: `0 6px 14px -6px ${color}` }}>
        {icon}
      </span>
      {children}
    </p>
  )
}

function MetricBar({ label, value, pct, grad, delay = 0 }: { label: string; value: string; pct: number; grad: string; delay?: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="text-text-white font-semibold">{label}</span>
        <span className="text-text-disabled text-xs font-medium tabular-nums">{value}</span>
      </div>
      <div className="h-[7px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, background: grad, boxShadow: '0 0 12px rgba(255,184,0,0.35)', transitionDelay: `${delay}ms` }} />
      </div>
    </div>
  )
}

// ── Charts (dependency-free SVG) ────────────────────────────────────────────
const CHART_COLORS = ['#FFB800', '#00E5FF', '#A78BFA', '#34D399', '#F472B6', '#F59E0B', '#60A5FA', '#FB923C']

function signupTrend(users: UserProfile[]) {
  if (users.length === 0) return []
  const oldest = users.reduce((m, u) => u.created_at ? Math.min(m, new Date(u.created_at).getTime()) : m, Date.now())
  const spanDays = (Date.now() - oldest) / 86400000
  if (spanDays <= 21) {
    const out: { label: string; value: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      const dayKey = Math.floor(d.getTime() / 86400000)
      out.push({
        label: d.toLocaleDateString('en', { day: 'numeric', month: 'short' }),
        value: users.filter(u => {
          if (!u.created_at) return false
          return Math.floor(new Date(u.created_at).getTime() / 86400000) === dayKey
        }).length,
      })
    }
    return out
  }
  const now = new Date()
  const out: { label: string; value: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({
      label: d.toLocaleDateString('en', { month: 'short' }),
      value: users.filter(u => {
        if (!u.created_at) return false
        const t = new Date(u.created_at)
        return t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth()
      }).length,
    })
  }
  return out
}

function activitySplit(users: UserProfile[]) {
  const now = Date.now()
  const d = 86400000
  const day = users.filter(u => u.last_active && now - new Date(u.last_active).getTime() < d).length
  const week = users.filter(u => u.last_active && now - new Date(u.last_active).getTime() >= d && now - new Date(u.last_active).getTime() < 7 * d).length
  const month = users.filter(u => u.last_active && now - new Date(u.last_active).getTime() >= 7 * d && now - new Date(u.last_active).getTime() < 30 * d).length
  const idle = users.length - day - week - month
  return [
    { label: 'Active today', value: day, color: '#34D399' },
    { label: 'This week', value: week, color: '#00E5FF' },
    { label: 'This month', value: month, color: '#FFB800' },
    { label: '30d+ inactive', value: idle, color: '#9CA3AF' },
  ]
}

function AreaChart({ data }: { data: { label: string; value: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 600, H = 210, L = 34, R = 8, T = 14, B = 26
  if (data.length === 0) return <EmptyHint icon={TrendingUp} text="No signup data yet." />
  const max = Math.max(1, ...data.map(d => d.value))
  const iw = W - L - R, ih = H - T - B
  const x = (i: number) => L + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw)
  const y = (v: number) => T + ih - (v / max) * ih
  const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.value).toFixed(1)}`)
  const areaPath = `M${x(0).toFixed(1)},${(T + ih).toFixed(1)} L${pts.join(' L')} L${x(data.length - 1).toFixed(1)},${(T + ih).toFixed(1)} Z`
  const gridTicks = [0, 0.5, 1].map(f => T + ih - f * ih)

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const idx = Math.min(data.length - 1, Math.max(0, Math.round(((px - L) / iw) * (data.length - 1))))
    setHover(idx)
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFB800" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FF7A00" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="areaLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FFB800" />
            <stop offset="100%" stopColor="#FF7A00" />
          </linearGradient>
        </defs>
        {gridTicks.map((gy, i) => (
          <g key={i}>
            <line x1={L} x2={W - R} y1={gy} y2={gy} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={L - 7} y={gy + 3.5} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.35)">
              {Math.round(max * (i / 2))}
            </text>
          </g>
        ))}
        <path d={areaPath} fill="url(#areaFill)" />
        <polyline points={pts.join(' ')} fill="none" stroke="url(#areaLine)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(data[i].value)} r={hover === i ? 4.5 : 3}
            fill={hover === i ? '#FFD166' : '#FFB800'} stroke="#0B0A1E" strokeWidth="1.5"
            style={{ transition: 'r 120ms ease' }} />
        ))}
        {data.map((d, i) => {
          const skip = data.length > 8 && i % Math.ceil(data.length / 6) !== 0
          if (skip) return null
          return (
            <text key={`l${i}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.4)">
              {d.label}
            </text>
          )
        })}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={T + ih} stroke="rgba(255,184,0,0.35)" strokeWidth="1" strokeDasharray="3 3" />
            <rect x={Math.min(W - 96, Math.max(0, x(hover) - 48))} y={T - 22} width="96" height="20" rx="6"
              fill="#1A1A3A" stroke="rgba(255,184,0,0.35)" />
            <text x={Math.min(W - 96, Math.max(0, x(hover) - 48)) + 48} y={T - 8} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#FFD166">
              {data[hover].value} · {data[hover].label}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}

function DonutSplit({ data, centerValue, centerLabel }: {
  data: { label: string; value: number; color: string }[]; centerValue: number | string; centerLabel: string
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <EmptyHint icon={BarChart2} text="No data yet." />
  const r = 58, thick = 20, C = 2 * Math.PI * r
  const gap = data.length > 1 ? Math.min(2.2, C * 0.005) : 0
  let acc = 0
  const segs = data.map(s => {
    const len = (s.value / total) * C
    const seg = { ...s, len, dash: Math.max(len - (len > gap ? gap : 0), 0.5), offset: -acc }
    acc += len
    return seg
  })
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg width="170" height="170" viewBox="0 0 170 170">
          <g transform="rotate(-90 85 85)">
            {segs.map((s, i) => (
              <circle key={i} cx="85" cy="85" r={r} fill="none"
                stroke={s.color} strokeWidth={thick}
                strokeDasharray={`${s.dash} ${C - s.dash}`}
                strokeDashoffset={s.offset}
                strokeLinecap="butt"
                style={{ filter: `drop-shadow(0 0 6px ${s.color}55)`, transition: 'stroke-dasharray 500ms ease' }} />
            ))}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-text-white text-2xl font-black leading-[1.3] tabular-nums">{centerValue}</p>
          <p className="text-text-disabled text-[10px] font-bold uppercase tracking-widest mt-1">{centerLabel}</p>
        </div>
      </div>
      <div className="w-full grid grid-cols-2 gap-x-4 gap-y-1.5">
        {segs.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color, boxShadow: `0 0 6px ${s.color}` }} />
            <span className="text-text-white font-medium truncate">{s.label}</span>
            <span className="ml-auto text-text-disabled tabular-nums">{Math.round((s.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RatingChart({ reviews }: { reviews: AppReview[] }) {
  const counts = [5, 4, 3, 2, 1].map(r => ({ rating: r, value: reviews.filter(x => x.rating === r).length }))
  const max = Math.max(1, ...counts.map(c => c.value))
  if (reviews.length === 0) return <EmptyHint icon={Star} text="No ratings yet." />
  return (
    <div className="space-y-2.5">
      {counts.map(c => {
        const pct = (c.value / max) * 100
        return (
          <div key={c.rating} className="flex items-center gap-3"
            title={`${c.rating}★ · ${c.value} of ${reviews.length} rating${reviews.length === 1 ? '' : 's'}`}>
            <span className="w-9 text-sm font-bold text-text-white flex items-center gap-1 shrink-0">
              {c.rating} <Star size={12} fill="#FFC107" style={{ color: '#FFC107' }} />
            </span>
            <div className="flex-1 h-[9px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              {c.value > 0 && (
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.max(5, pct)}%`, background: 'linear-gradient(90deg,#FFB800,#FF7A00)', boxShadow: '0 0 10px rgba(255,184,0,0.3)' }} />
              )}
            </div>
            <span className="w-7 text-right text-text-disabled text-xs tabular-nums shrink-0">{c.value}</span>
          </div>
        )
      })}
      <p className="text-text-disabled text-center text-[11px] pt-1.5">
        {reviews.length} rating{reviews.length === 1 ? '' : 's'} · avg {avgOf(reviews)} · scale = max {max}
      </p>
    </div>
  )
}

function avgOf(reviews: AppReview[]) {
  if (!reviews.length) return '0'
  const s = reviews.reduce((t, r) => t + r.rating, 0)
  return (s / reviews.length).toFixed(1)
}

function OverviewTab(props: {
  users: UserProfile[]; reviews: AppReview[]; flaggedCount: number
  msgCount: number; docCount: number; quizCount: number
  activeToday: number; activeWeek: number; newWeek: number; newMonth: number
  eduSorted: [string, number][]; districtTop: [string, number][]
  quizPassRate: number; avgScore: number; avgRating: string; adminName: string
}) {
  const {
    users, reviews, flaggedCount, msgCount, docCount, quizCount,
    activeToday, activeWeek, newWeek, newMonth, eduSorted, districtTop,
    quizPassRate, avgScore, avgRating, adminName,
  } = props

  const recentUsers = users.slice(0, 7)
  const pendingReviews = reviews.filter(r => r.status === 'pending').length

  const dayW = 86400000
  const _nowW = nowMs()
  const prevWeek = users.filter(u => {
    if (!u.created_at) return false
    const t = _nowW - new Date(u.created_at).getTime()
    return t >= 7 * dayW && t < 14 * dayW
  }).length
  const wkDelta = newWeek - prevWeek
  const wkUp = wkDelta >= 0
  const activePct = users.length ? Math.round((activeWeek / users.length) * 100) : 0

  function jumpTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const OVERVIEW_NAV = [
    { id: 'ov-stats', label: 'Stats', icon: BarChart2 },
    { id: 'ov-growth', label: 'Growth', icon: TrendingUp },
    { id: 'ov-demographics', label: 'Demographics', icon: Users },
    { id: 'ov-activity', label: 'Activity', icon: Activity },
    { id: 'ov-ratings', label: 'Ratings', icon: Star },
    { id: 'ov-signups', label: 'Signups', icon: UserCheck },
  ]

  return (
    <div className="space-y-5">
      {/* Hero strip */}
      <Card className="p-5" glow="rgba(255,184,0,0.25)">
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#FFB800,#FF7A00)', color: INK, boxShadow: '0 12px 30px -10px rgba(255,184,0,0.7)' }}>
            <Zap size={22} strokeWidth={2.4} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-text-white text-lg font-black tracking-tight">
              Hey, <GradText from="#FFB800" to="#FF7A00">{adminName || 'Admiral'}</GradText> — the platform looks healthy.
            </p>
            <p className="text-text-disabled text-sm mt-0.5 flex items-center gap-1.5 flex-wrap">
              <TrendingUp size={13} style={{ color: '#00E676' }} />
              <span>{users.length} learners · {(users.length ? Math.round((activeWeek / users.length) * 100) : 0)}% active this week ·</span>
              <span>{newWeek} new signups in 7 days</span>
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2.5">
            <div className="px-3.5 py-2 rounded-xl text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${wkUp ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
              <p className="font-black text-lg leading-tight tabular-nums flex items-center justify-center gap-1"
                style={{ color: wkUp ? '#34D399' : '#F87171' }}>
                {wkUp ? '▲' : '▼'} {Math.abs(wkDelta)}
              </p>
              <p className="text-text-disabled text-[9.5px] font-bold uppercase tracking-widest mt-1">Vs prev 7d</p>
            </div>
            <div className="px-3.5 py-2 rounded-xl text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-text-white font-black text-lg leading-tight tabular-nums">{activePct}%</p>
              <p className="text-text-disabled text-[9.5px] font-bold uppercase tracking-widest mt-1">Active / wk</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Section jump nav */}
      <div className="sticky z-20 -mx-1 px-1 pb-1.5 flex gap-1.5 overflow-x-auto"
        style={{ top: 100, background: 'rgba(6,6,23,0.88)', backdropFilter: 'blur(10px)' }}>
        {OVERVIEW_NAV.map(s => (
          <button key={s.id} onClick={() => jumpTo(s.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all active:scale-[0.96] hover:text-text-white"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <s.icon size={12} />
            {s.label}
          </button>
        ))}
      </div>

      <section id="ov-stats" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 scroll-mt-40">
        <StatCard icon={Users} label="Total Users" value={users.length} from="#FFB800" to="#FF7A00" color="#FFB800" sub={`${newMonth} new this month`} />
        <StatCard icon={Activity} label="Active Today" value={activeToday} from="#00E5FF" to="#0884FF" color="#00E5FF" sub={`${activeWeek} active this week`} />
        <StatCard icon={TrendingUp} label="New This Week" value={newWeek} from="#34D399" to="#059669" color="#34D399" sub="New signups (7 days)" />
        <StatCard icon={MessageSquare} label="Chat Messages" value={msgCount.toLocaleString()} from="#A78BFA" to="#7C3AED" color="#A78BFA" sub="Across all users" />
        <StatCard icon={BookOpen} label="Quizzes Taken" value={quizCount.toLocaleString()} from="#00E5FF" to="#0884FF" color="#00E5FF" sub={`Pass rate ${quizPassRate}%`} />
        <StatCard icon={FileText} label="Documents" value={docCount.toLocaleString()} from="#FCD34D" to="#F59E0B" color="#F59E0B" sub="Uploaded by users" />
        <StatCard icon={Star} label="Avg Rating" value={avgRating} from="#FFC107" to="#FF8A00" color="#FFC107" sub={`${pendingReviews} review${pendingReviews === 1 ? '' : 's'} pending`} />
        <StatCard icon={ShieldAlert} label="Flagged Messages" value={flaggedCount} from="#F87171" to="#DC2626" color="#F87171" sub="Awaiting moderation" />
      </section>

      {/* Growth chart */}
      <section id="ov-growth" className="scroll-mt-40">
      <Card className="p-5" glow="rgba(255,184,0,0.12)">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <SectionTitle icon={<TrendingUp size={13} />} color="#FFB800" from="#FFB800" to="#FF7A00">Growth — New Learners</SectionTitle>
          <span className="px-2.5 py-1 rounded-lg text-[10.5px] font-bold uppercase tracking-wider flex items-center gap-1.5"
            style={{ background: 'rgba(255,184,0,0.08)', color: '#FFB800', border: '1px solid rgba(255,184,0,0.2)' }}>
            <Zap size={11} /> Signups over time
          </span>
        </div>
        <AreaChart data={signupTrend(users)} />
      </Card>
      </section>

      <section id="ov-demographics" className="grid lg:grid-cols-2 gap-5 scroll-mt-40">
        <Card className="p-5">
          <div className="p-1">
            <SectionTitle icon={<Users size={13} />} color="#FFB800" from="#FFB800" to="#FF7A00">Learners by Education Level</SectionTitle>
            <DonutSplit
              data={eduSorted.map(([label, value], i) => ({ label: label || 'Unknown', value, color: CHART_COLORS[i % CHART_COLORS.length] }))}
              centerValue={users.length}
              centerLabel="learners" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="p-1">
            <SectionTitle icon={<MapPinIcon />} color="#00E5FF" from="#00E5FF" to="#0884FF">Top Districts</SectionTitle>
            {districtTop.length === 0 ? <EmptyHint /> : (
              <div className="space-y-3">
                {districtTop.map(([d, count], i) => {
                  const pct = users.length ? Math.round((count / users.length) * 100) : 0
                  return (
                    <MetricBar key={d} label={d || 'Unknown'} value={`${count}`} pct={pct}
                      grad="linear-gradient(90deg,#00E5FF,#7C3AED)" delay={i * 60} />
                  )
                })}
              </div>
            )}
          </div>
        </Card>
      </section>

      <div className="grid lg:grid-cols-2 gap-5">
        <section id="ov-activity" className="scroll-mt-40">
        <Card className="p-5">
          <div className="p-1">
            <SectionTitle icon={<Activity size={13} />} color="#00E5FF" from="#00E5FF" to="#0884FF">Learner Activity</SectionTitle>
            <DonutSplit data={activitySplit(users)} centerValue={activeWeek} centerLabel="active / 7d" />
          </div>
        </Card>
        </section>

        <section id="ov-ratings" className="scroll-mt-40">
        <Card className="p-5">
          <div className="p-1">
            <SectionTitle icon={<Star size={13} />} color="#FFC107" from="#FFC107" to="#FF8A00">Rating Distribution</SectionTitle>
            <RatingChart reviews={reviews} />
          </div>
        </Card>
        </section>
      </div>

      <section id="ov-signups" className="grid lg:grid-cols-2 gap-5 scroll-mt-40">
        <Card className="p-5">
          <div className="p-1">
            <SectionTitle icon={<UserCheck size={13} />} color="#34D399" from="#34D399" to="#059669">Recent Signups</SectionTitle>
            {recentUsers.length === 0 ? <EmptyHint /> : (
              <div className="space-y-1">
                {recentUsers.map(u => {
                  const isActive = u.last_active && (nowMs() - new Date(u.last_active).getTime()) < 86400000
                  return (
                    <div key={u.user_id}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.04] transition-colors group">
                      <div className="relative">
                        <Avatar name={u.name || undefined} />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 ${isActive ? 'opacity-100' : 'opacity-30'}`}
                          style={{ background: isActive ? '#00E676' : 'rgba(255,255,255,0.25)', borderColor: '#0B0A1E', boxShadow: isActive ? '0 0 8px #00E676' : 'none' }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-text-white text-sm font-bold truncate">{u.name || 'Student'}</p>
                        <p className="text-text-disabled text-[11px] truncate">{u.email || ''} {u.district ? `· ${u.district}` : ''}</p>
                      </div>
                      <span className="text-text-disabled text-[11px] shrink-0 font-medium">{formatRelative(u.created_at)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="p-1">
            <SectionTitle icon={<Sparkles size={13} />} color="#A78BFA" from="#A78BFA" to="#7C3AED">Learning Health</SectionTitle>
            <div className="grid grid-cols-3 gap-2.5 mb-4">
              {[
                { icon: BookOpen, label: 'Quiz Pass', value: `${quizPassRate}%`, from: '#34D399', to: '#059669', color: '#34D399' },
                { icon: BarChart2, label: 'Avg Score', value: `${avgScore}%`, from: '#00E5FF', to: '#0884FF', color: '#00E5FF' },
                { icon: Star, label: 'Rating', value: avgRating, from: '#FFC107', to: '#FF8A00', color: '#FFC107' },
              ].map(i => (
                <div key={i.label} className="p-3 rounded-xl text-center transition-transform duration-200 hover:-translate-y-0.5"
                  style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${i.color}22` }}>
                  <div className="w-8 h-8 rounded-lg mx-auto mb-1.5 flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg,${i.from},${i.to})`, color: INK, boxShadow: `0 8px 16px -8px ${i.color}` }}>
                    <i.icon size={15} strokeWidth={2.4} />
                  </div>
                  <p className="text-text-white text-lg font-black leading-tight tabular-nums">{i.value}</p>
                  <p className="text-text-disabled text-[9.5px] mt-1 font-bold uppercase tracking-widest">{i.label}</p>
                </div>
              ))}
            </div>
            <div className="p-3.5 rounded-xl flex items-center gap-3"
              style={{ background: 'linear-gradient(90deg, rgba(124,58,237,0.12), rgba(255,184,0,0.06))', border: '1px solid rgba(124,58,237,0.18)' }}>
              <Clock size={16} style={{ color: '#FFB800' }} />
              <p className="text-text-light text-xs leading-relaxed">
                <span className="text-text-white font-bold">{activeWeek}</span> of {users.length} learners active in the last 7 days ({users.length ? Math.round((activeWeek / users.length) * 100) : 0}% engagement).
              </p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  )
}

// helpers used by OverviewTab
function nowMs() { return Date.now() }

function MapPinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function EmptyHint({ icon: Icon = Sparkles, text = 'No data yet.' }: { icon?: any; text?: string }) {
  return (
    <div className="py-8 text-center">
      <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <Icon size={20} style={{ color: 'rgba(255,255,255,0.25)' }} />
      </div>
      <p className="text-text-disabled text-sm">{text}</p>
    </div>
  )
}

function ReviewsTab(props: {
  reviews: AppReview[]; userName: (id: string) => UserProfile | undefined
  users: UserProfile[]; avgRating: string
  counts: { pending: number; approved: number; hidden: number }
  onStatus: (id: string, status: AppReview['status']) => Promise<void>
}) {
  const { reviews, userName, avgRating, counts, onStatus } = props
  const [statusFilter, setStatusFilter] = useState<'all' | AppReview['status']>('all')
  const [sort, setSort] = useState<'newest' | 'oldest' | 'ratingAsc'>('newest')
  const [page, setPage] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)

  const PAGE = 6

  useEffect(() => { setPage(0) }, [statusFilter, sort])

  const filtered = reviews.filter(r => statusFilter === 'all' || r.status === statusFilter)
  const ts = (iso: string) => { const t = new Date(iso || '').getTime(); return isNaN(t) ? 0 : t }
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'oldest') return ts(a.created_at) - ts(b.created_at)
    if (sort === 'ratingAsc') return a.rating - b.rating
    return ts(b.created_at) - ts(a.created_at)
  })
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE))
  const safePage = Math.min(page, totalPages - 1)
  const pageRows = sorted.slice(safePage * PAGE, safePage * PAGE + PAGE)

  async function act(id: string, status: AppReview['status']) {
    setBusy(id)
    await onStatus(id, status)
    setBusy(null)
  }

  const EMPTY: Record<string, { icon: any; text: string }> = {
    all: { icon: Star, text: 'No reviews yet — students have not left any.' },
    pending: { icon: Clock, text: 'No pending reviews — everything has been reviewed.' },
    approved: { icon: CheckCircle2, text: 'No approved reviews yet.' },
    hidden: { icon: EyeOff, text: 'No hidden reviews — nothing has been hidden.' },
  }

  return (
    <div className="space-y-5">
      {/* Avg rating header */}
      <Card className="p-4" glow="rgba(255,193,7,0.2)">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#FFC107,#FF8A00)', color: INK, boxShadow: '0 10px 22px -8px #FFC107' }}>
            <Star size={20} strokeWidth={2.4} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <div className="min-w-0">
                <p className="text-3xl font-black leading-[1.3] tracking-tight">
                  <GradText from="#FFC107" to="#FF8A00">{avgRating}</GradText>
                </p>
                <p className="text-text-disabled text-[11px] font-bold uppercase tracking-widest mt-1">Average Rating</p>
              </div>
              <div className="ml-auto shrink-0">
                <StarRow rating={Math.round(Number(avgRating) || 0)} size={16} />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Filters + sort */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="flex gap-1.5 overflow-x-auto">
          {(['all', 'pending', 'approved', 'hidden'] as const).map(s => {
            const active = statusFilter === s
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-200 active:scale-[0.97] flex items-center"
                style={{
                  background: active ? 'linear-gradient(135deg,#FFB800,#FF7A00)' : 'rgba(255,255,255,0.03)',
                  color: active ? INK : 'rgba(255,255,255,0.5)',
                  border: `1px solid ${active ? 'rgba(255,138,0,0.5)' : 'rgba(255,255,255,0.07)'}`,
                }}>
                {s === 'all' ? 'All' : s}
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none"
                  style={{
                    background: active ? 'rgba(11,10,30,0.85)' : 'rgba(255,255,255,0.08)',
                    color: active ? '#FFB800' : 'rgba(255,255,255,0.45)',
                  }}>
                  {s === 'all' ? reviews.length : counts[s]}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-text-disabled text-[11px] font-bold uppercase tracking-wider shrink-0">Sort</span>
          <select value={sort} onChange={e => setSort(e.target.value as typeof sort)}
            className="h-9 px-2.5 rounded-lg text-sm outline-none cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#fff' }}>
            <option value="newest" style={{ background: '#141336' }}>Newest first</option>
            <option value="oldest" style={{ background: '#141336' }}>Oldest first</option>
            <option value="ratingAsc" style={{ background: '#141336' }}>Lowest rating</option>
          </select>
        </div>
      </div>

      {sorted.length === 0 ? (
        <Card className="p-8">
          <EmptyHint icon={EMPTY[statusFilter].icon} text={EMPTY[statusFilter].text} />
        </Card>
      ) : (
        <div className="space-y-3">
          {pageRows.map(r => {
            const u = userName(r.user_id)
            const district = u?.district || r.user_district
            const level = u?.education_level || r.user_education_level
            return (
              <Card key={r.review_id} className="p-4 hover:border-white/[0.12]" glow="rgba(255,184,0,0.06)">
                <div className="flex flex-wrap items-start gap-3">
                  <Avatar name={u?.name || r.user_name || 'S'} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-text-white text-sm font-bold">{u?.name || r.user_name || 'User'}</p>
                      <StarRow rating={r.rating} />
                      <span className="text-text-disabled text-[11px] flex items-center gap-1"><CalendarDays size={11} /> {formatDate(r.created_at)}</span>
                    </div>
                    <p className="text-text-disabled text-[11px] truncate">
                      {u?.email || ''}{district ? ` · ${district}` : ''}{level ? ` · ${level}` : ''}
                    </p>
                    {r.title && <p className="text-text-white text-sm font-semibold mt-2">“{r.title}”</p>}
                    {r.comment ? (
                      <p className="text-text-white/80 text-[13px] mt-1 leading-relaxed break-words">{r.comment}</p>
                    ) : (
                      <p className="text-text-disabled text-[12px] mt-1.5 italic">No comment left — rating only.</p>
                    )}
                  </div>
                  <div className="ml-auto flex flex-wrap items-center gap-1.5 shrink-0">
                    {r.status === 'pending' && (
                      <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                        style={{ background: 'rgba(255,184,0,0.12)', color: '#FFB800', border: '1px solid rgba(255,184,0,0.25)' }}>
                        Pending
                      </span>
                    )}
                    {r.status !== 'approved' && (
                      <button onClick={() => act(r.review_id, 'approved')} disabled={busy !== null}
                        className="h-8 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all hover:opacity-90 disabled:opacity-50 active:scale-[0.97]"
                        style={{ background: 'rgba(0,230,118,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.3)' }}>
                        {busy === r.review_id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Approve
                      </button>
                    )}
                    {r.status !== 'hidden' && (
                      <button onClick={() => act(r.review_id, 'hidden')} disabled={busy !== null}
                        className="h-8 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all hover:opacity-90 disabled:opacity-50 active:scale-[0.97]"
                        style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <EyeOff size={12} /> Hide
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {sorted.length > PAGE && (
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[0.06]">
          <p className="text-text-disabled text-[11px]">
            Showing {safePage * PAGE + 1}–{Math.min(sorted.length, (safePage + 1) * PAGE)} of {sorted.length}
          </p>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0} aria-label="Previous page"
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 hover:bg-white/[0.06]"
              style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
              <ChevronLeft size={15} />
            </button>
            <span className="text-text-disabled text-[11px] tabular-nums px-1.5">{safePage + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage === totalPages - 1} aria-label="Next page"
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 hover:bg-white/[0.06]"
              style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ModerationTab(props: { messages: RoomMessage[]; userName: (id: string) => UserProfile | undefined; onDelete: (id: string) => Promise<void> }) {
  const { messages, userName, onDelete } = props
  const [busy, setBusy] = useState<string | null>(null)

  async function remove(id: string) {
    setBusy(id)
    await onDelete(id)
    setBusy(null)
  }

  if (messages.length === 0) {
    return (
      <Card className="p-8" glow="rgba(52,211,153,0.12)">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(52,211,153,0.3)' }}>
            <ShieldCheck size={26} style={{ color: '#34D399' }} />
          </div>
          <div>
            <p className="text-text-white font-black">All clear!</p>
            <p className="text-text-disabled text-sm mt-0.5">No flagged messages right now — the community is behaving well.</p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <Card className="p-4 flex items-center gap-3" glow="rgba(239,68,68,0.15)">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg,#F87171,#DC2626)', color: INK, boxShadow: '0 10px 20px -8px #EF4444' }}>
          <ShieldAlert size={18} strokeWidth={2.4} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-text-white text-sm font-black flex items-center gap-2">
            Flagged Room Messages
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black leading-none"
              style={{ background: 'rgba(239,68,68,0.2)', color: '#F87171' }}>
              {messages.length} live
            </span>
          </p>
          <p className="text-text-disabled text-xs mt-0.5">Messages reported as inappropriate in study rooms. Review and delete if necessary.</p>
        </div>
      </Card>

      {messages.map(m => {
        const u = userName(m.user_id)
        return (
          <Card key={m.message_id} className="p-4 hover:border-red-500/20" glow="rgba(239,68,68,0.08)">
            <div className="flex items-start gap-3">
              <Avatar name={m.user_name || u?.name || 'U'} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-text-white text-sm font-bold">{m.user_name || u?.name || 'User'}</p>
                  <span className="text-text-disabled text-[11px] flex items-center gap-1"><CalendarDays size={11} /> {formatDate(m.created_at)}</span>
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                    style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                    Flagged
                  </span>
                </div>
                <p className="text-text-white/80 text-sm mt-1.5 leading-relaxed break-words">{m.content}</p>
              </div>
              <button onClick={() => remove(m.message_id)} disabled={busy !== null}
                className="h-9 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all hover:opacity-90 disabled:opacity-50 active:scale-[0.97]"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.35)' }}>
                {busy === m.message_id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Delete
              </button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function AdminsTab(props: {
  admins: UserProfile[]; users: UserProfile[]; currentUserId: string
  email: string; setEmail: (v: string) => void
  loading: boolean; msg: { ok: boolean; text: string } | null
  onPromote: () => Promise<void>; onDemote: (id: string) => Promise<void>
}) {
  const { admins, users, currentUserId, email, setEmail, loading, msg, onPromote, onDemote } = props

  const [confirm, setConfirm] = useState<{ kind: 'promote' | 'demote'; userId?: string; name?: string } | null>(null)

  const [query, setQuery] = useState('')
  const [districtFilter, setDistrictFilter] = useState('all')
  const [levelFilter, setLevelFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [incompleteOnly, setIncompleteOnly] = useState(false)
  const [sortKey, setSortKey] = useState<'name' | 'district' | 'level' | 'lastActive' | 'role'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)

  const PAGE = 12

  useEffect(() => { setPage(0) }, [query, districtFilter, levelFilter, roleFilter, incompleteOnly])

  const districts = Array.from(new Set(users.map(u => u.district).filter((d): d is string => !!d))).sort((a, b) => a.localeCompare(b))
  const levels = Array.from(new Set(users.map(u => u.education_level).filter((l): l is string => !!l))).sort((a, b) => a.localeCompare(b))

  const q = query.trim().toLowerCase()
  const rows = users.filter(u => {
    if (q && !(u.name || '').toLowerCase().includes(q) && !(u.email || '').toLowerCase().includes(q)) return false
    if (districtFilter !== 'all' && u.district !== districtFilter) return false
    if (levelFilter !== 'all' && u.education_level !== levelFilter) return false
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    if (incompleteOnly && (u.district && u.education_level)) return false
    return true
  })

  const sorted = [...rows].sort((a, b) => {
    let r: number
    if (sortKey === 'lastActive') {
      const at = a.last_active ? new Date(a.last_active).getTime() : 0
      const bt = b.last_active ? new Date(b.last_active).getTime() : 0
      r = at - bt
    } else if (sortKey === 'name') {
      r = (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase())
    } else if (sortKey === 'district') {
      r = (a.district || '\uffff').localeCompare(b.district || '\uffff')
    } else if (sortKey === 'level') {
      r = (a.education_level || '\uffff').localeCompare(b.education_level || '\uffff')
    } else {
      r = (a.role || '').localeCompare(b.role || '')
    }
    return sortDir === 'asc' ? r : -r
  })

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE))
  const safePage = Math.min(page, totalPages - 1)
  const pageRows = sorted.slice(safePage * PAGE, safePage * PAGE + PAGE)

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const arrow = (k: typeof sortKey) => {
    if (sortKey !== k) return null
    return sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
  }

  const controlStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#fff' }

  function runConfirm() {
    if (!confirm) return
    const c = confirm
    setConfirm(null)
    if (c.kind === 'promote') onPromote()
    else if (c.userId) onDemote(c.userId)
  }

  return (
    <div className="space-y-5">
      <Card className="p-5" glow="rgba(255,184,0,0.15)">
        <p className="text-text-white font-black text-lg flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#FFB800,#FF7A00)', color: INK, boxShadow: '0 8px 18px -8px #FFB800' }}>
            <Crown size={17} strokeWidth={2.4} />
          </span>
          Promote a Super Admin
        </p>
        <p className="text-text-disabled text-sm mt-2 mb-4">
          Grant trusted team members full dashboard access. Enter the email of an existing registered user.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }} />
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com"
              onKeyDown={e => { if (e.key === 'Enter' && email.trim()) setConfirm({ kind: 'promote' }) }}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm outline-none transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#fff', caretColor: '#FFB800' }} />
          </div>
          <button onClick={() => setConfirm({ kind: 'promote' })} disabled={loading || !email.trim()}
            className="h-11 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.97] hover:opacity-90 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#FFB800,#FF7A00)', color: INK, boxShadow: '0 12px 26px -10px rgba(255,184,0,0.7)' }}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Crown size={15} strokeWidth={2.4} />}
            Make Admin
          </button>
        </div>
        {msg && (
          <div className={`mt-3 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 animate-fade-in`}
            style={{
              background: msg.ok ? 'rgba(0,230,118,0.1)' : 'rgba(239,68,68,0.1)',
              color: msg.ok ? '#34D399' : '#EF4444',
              border: `1px solid ${msg.ok ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.25)'}`,
            }}>
            {msg.ok ? <CheckCircle2 size={14} /> : <ShieldAlert size={14} />}
            {msg.text}
          </div>
        )}
      </Card>

      <Card>
        <div className="p-4">
          <SectionTitle icon={<Shield size={13} />} color="#FFB800" from="#FFB800" to="#FF7A00">
            Current Super Admins ({admins.length})
          </SectionTitle>
          {admins.length === 0 ? <EmptyHint icon={Crown} text="No admins yet. Promote someone to get started." /> : (
            <div className="space-y-2">
              {admins.map(a => {
                const isMe = a.user_id === currentUserId
                const canDemote = admins.length > 1 && !isMe
                return (
                  <div key={a.user_id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isMe ? '' : 'hover:bg-white/[0.03]'}`}
                    style={{
                      background: isMe ? 'linear-gradient(90deg, rgba(255,184,0,0.1), rgba(255,184,0,0.02))' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isMe ? 'rgba(255,184,0,0.25)' : 'rgba(255,255,255,0.06)'}`,
                    }}>
                    <Avatar name={a.name || undefined} />
                    <div className="min-w-0 flex-1">
                      <p className="text-text-white text-sm font-bold flex items-center gap-1.5">
                        {a.name || 'Admin'}
                        {isMe && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF' }}>You</span>}
                      </p>
                      <p className="text-text-disabled text-[11px] truncate">{a.email}</p>
                    </div>
                    <span className="text-text-disabled text-[11px] hidden sm:flex items-center gap-1"><CalendarDays size={11} /> Since {formatDate(a.created_at)}</span>
                    {canDemote && (
                      <button onClick={() => setConfirm({ kind: 'demote', userId: a.user_id, name: a.name || a.email })}
                        className="h-8 px-3 rounded-lg text-[11px] font-bold transition-all hover:opacity-90 active:scale-[0.97]"
                        style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                        Remove
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="p-4">
          <SectionTitle icon={<Users size={13} />} color="#00E5FF" from="#00E5FF" to="#0884FF">
            All Users ({users.length})
          </SectionTitle>

          <div className="flex flex-col lg:flex-row gap-2 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or email…"
                className="w-full pl-9 pr-9 py-2 rounded-xl text-sm outline-none transition-colors"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#fff', caretColor: '#FFB800' }} />
              {query && (
                <button onClick={() => setQuery('')} aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-text-disabled hover:text-text-white">
                  ✕
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={districtFilter} onChange={e => setDistrictFilter(e.target.value)}
                className="h-10 px-3 rounded-xl text-sm outline-none cursor-pointer"
                style={controlStyle}>
                <option value="all" style={{ background: '#141336' }}>All districts</option>
                {districts.map(d => <option key={d} value={d} style={{ background: '#141336' }}>{d}</option>)}
              </select>
              <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)}
                className="h-10 px-3 rounded-xl text-sm outline-none cursor-pointer"
                style={controlStyle}>
                <option value="all" style={{ background: '#141336' }}>All levels</option>
                {levels.map(l => <option key={l} value={l} style={{ background: '#141336' }}>{l}</option>)}
              </select>
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                className="h-10 px-3 rounded-xl text-sm outline-none cursor-pointer"
                style={controlStyle}>
                <option value="all" style={{ background: '#141336' }}>All roles</option>
                <option value="student" style={{ background: '#141336' }}>Students</option>
                <option value="admin" style={{ background: '#141336' }}>Admins</option>
              </select>
              <button onClick={() => setIncompleteOnly(v => !v)}
                className={`h-10 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-[0.97] ${incompleteOnly ? '' : 'opacity-70'}`}
                style={{
                  background: incompleteOnly ? 'rgba(255,184,0,0.14)' : 'rgba(255,255,255,0.04)',
                  color: incompleteOnly ? '#FFB800' : 'rgba(255,255,255,0.55)',
                  border: `1px solid ${incompleteOnly ? 'rgba(255,184,0,0.35)' : 'rgba(255,255,255,0.09)'}`,
                }}>
                <AlertTriangle size={13} /> Incomplete
              </button>
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold tabular-nums"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.45)' }}>
                {sorted.length} result{sorted.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {sorted.length === 0 ? <EmptyHint icon={Users} text="No users match these filters." /> : (
            <div className="max-h-[560px] overflow-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="text-left text-text-disabled text-[11px] uppercase tracking-[0.12em]"
                    style={{ background: 'rgba(13,13,36,1)', boxShadow: '0 1px 0 rgba(255,255,255,0.08)' }}>
                    <th className="py-3 pr-3 font-bold">
                      <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-text-white transition-colors">
                        User {arrow('name')}
                      </button>
                    </th>
                    <th className="py-3 pr-3 font-bold hidden md:table-cell">
                      <button onClick={() => toggleSort('district')} className="flex items-center gap-1 hover:text-text-white transition-colors">
                        District {arrow('district')}
                      </button>
                    </th>
                    <th className="py-3 pr-3 font-bold hidden sm:table-cell">
                      <button onClick={() => toggleSort('level')} className="flex items-center gap-1 hover:text-text-white transition-colors">
                        Level {arrow('level')}
                      </button>
                    </th>
                    <th className="py-3 pr-3 font-bold">
                      <button onClick={() => toggleSort('lastActive')} className="flex items-center gap-1 hover:text-text-white transition-colors">
                        Last Active {arrow('lastActive')}
                      </button>
                    </th>
                    <th className="py-3 font-bold">
                      <button onClick={() => toggleSort('role')} className="flex items-center gap-1 hover:text-text-white transition-colors">
                        Role {arrow('role')}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(u => {
                    const active = u.last_active && (nowMs() - new Date(u.last_active).getTime()) < 86400000
                    const incomplete = !u.district || !u.education_level
                    return (
                      <tr key={u.user_id} className="border-b border-white/[0.03] hover:bg-white/[0.025] transition-colors">
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={u.name || undefined} size={30} />
                            <div className="min-w-0">
                              <p className="text-text-white font-semibold truncate max-w-[160px]">{u.name || 'Student'}</p>
                              <p className="text-text-disabled text-[11px] truncate max-w-[160px]">{u.email}</p>
                              {incomplete && (
                                <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-px rounded-full text-[9px] font-black uppercase tracking-wide"
                                  style={{ background: 'rgba(255,184,0,0.12)', color: '#FFB800', border: '1px solid rgba(255,184,0,0.25)' }}>
                                  <AlertTriangle size={8} /> Needs profile
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 text-text-disabled hidden md:table-cell">{u.district || '—'}</td>
                        <td className="py-2.5 pr-3 text-text-disabled hidden sm:table-cell">{u.education_level || '—'}</td>
                        <td className="py-2.5 pr-3">
                          <span className="flex items-center gap-1.5 text-text-disabled text-[12px]">
                            {active && <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#00E676', boxShadow: '0 0 6px #00E676' }} />}
                            {formatRelative(u.last_active)}
                          </span>
                        </td>
                        <td className="py-2.5">
                          {u.role === 'admin' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit"
                              style={{ background: 'rgba(255,184,0,0.12)', color: '#FFB800', border: '1px solid rgba(255,184,0,0.3)' }}>
                              <Crown size={9} /> Admin
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.09)' }}>
                              Student
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {sorted.length > PAGE && (
            <div className="flex items-center justify-between gap-3 pt-3 mt-3 border-t border-white/[0.06]">
              <p className="text-text-disabled text-[11px]">
                Showing {safePage * PAGE + 1}–{Math.min(sorted.length, (safePage + 1) * PAGE)} of {sorted.length}
              </p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0} aria-label="Previous page"
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 hover:bg-white/[0.06]"
                  style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
                  <ChevronLeft size={15} />
                </button>
                <span className="text-text-disabled text-[11px] tabular-nums px-1.5">{safePage + 1} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage === totalPages - 1} aria-label="Next page"
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 hover:bg-white/[0.06]"
                  style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(6,6,23,0.7)', backdropFilter: 'blur(6px)' }}
          onClick={() => setConfirm(null)}>
          <div className="w-full max-w-md rounded-2xl p-6 relative"
            style={{ background: 'linear-gradient(160deg,#12112C,#0A0A1E)', border: '1px solid rgba(255,184,0,0.2)', boxShadow: '0 30px 80px -30px rgba(0,0,0,0.9)' }}
            onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: confirm.kind === 'promote' ? 'rgba(255,184,0,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${confirm.kind === 'promote' ? 'rgba(255,184,0,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
              {confirm.kind === 'promote'
                ? <Crown size={22} style={{ color: '#FFB800' }} />
                : <ShieldAlert size={22} style={{ color: '#EF4444' }} />}
            </div>
            <p className="text-text-white text-lg font-black">
              {confirm.kind === 'promote' ? `Grant admin access to ${email.trim()}?` : `Remove ${confirm.name || 'this admin'}?`}
            </p>
            <p className="text-text-disabled text-sm mt-2 leading-relaxed">
              {confirm.kind === 'promote'
                ? `${email.trim()} will immediately gain full dashboard access — including user data review, moderation tools, and the ability to promote others. Only grant this to team members you fully trust.`
                : `This user will immediately lose elevated dashboard access and revert to a standard student account. You can restore them later from the promote panel.`}
            </p>
            <div className="flex gap-2.5 mt-6">
              <button onClick={() => setConfirm(null)}
                className="flex-1 h-11 rounded-xl text-sm font-bold transition-colors hover:opacity-90 active:scale-[0.98]"
                style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.04)' }}>
                Cancel
              </button>
              <button onClick={runConfirm}
                className="flex-1 h-11 rounded-xl text-sm font-black transition-all active:scale-[0.98]"
                style={{ background: confirm.kind === 'promote' ? 'linear-gradient(135deg,#FFB800,#FF7A00)' : 'linear-gradient(135deg,#F87171,#DC2626)', color: '#0A0A1F' }}>
                {confirm.kind === 'promote' ? 'Yes, Grant Access' : 'Yes, Remove Access'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}