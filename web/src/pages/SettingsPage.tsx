import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera, Loader2, MapPin, GraduationCap, MessageSquare, FileText,
  BookOpen, ChevronRight, Mic, Volume2, Bell, BellRing,
  Calendar, Download, Info, Shield, FileCheck, Star, Share2,
  Lock, LogOut, Eye, EyeOff, School, Briefcase, Sparkles,
  ChevronLeft, Palette, Headphones, Brain, BarChart2, CheckCircle,
} from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { useTheme } from '@/lib/ThemeContext'
import { supabase } from '@/lib/supabase'
import { SUPABASE_URL } from '@/lib/supabase'
import { EDUCATION_LEVELS } from '@/lib/constants'
import type { UserSettings } from '@/types'

const THEMES = ['DEEP_SPACE', 'MIDNIGHT', 'FOREST', 'OCEAN', 'SUNSET']
const DIFFICULTIES = ['adaptive', 'easy', 'medium', 'hard']

const THEME_COLORS: Record<string, [string, string, string, string]> = {
  DEEP_SPACE: ['#0F0F2E', '#FFC107', '#7C4DFF', '#12122A'],
  MIDNIGHT:   ['#000000', '#FFC107', '#00E5FF', '#0D0D0D'],
  FOREST:     ['#050F05', '#00E676', '#FFC107', '#0A1A0A'],
  OCEAN:      ['#020D1A', '#00E5FF', '#FFC107', '#051525'],
  SUNSET:     ['#100500', '#FF6B6B', '#FFC107', '#1A0A00'],
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className="w-11 h-6 rounded-full transition-all duration-300 relative shrink-0"
      style={{ background: value ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'rgba(255,255,255,0.1)' }}>
      <div className="bg-white rounded-full absolute top-[3px] transition-all duration-300 shadow-sm"
        style={{ width: '18px', height: '18px', left: value ? '26px' : '3px' }} />
    </button>
  )
}

function SectionLabel({ icon: Icon, color, children }: { icon?: any; color?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-0.5 mb-2">
      {Icon && <Icon size={14} style={{ color: color || '#F59E0B' }} />}
      <p className="text-text-disabled text-xs font-bold uppercase tracking-widest">{children}</p>
      <div className="flex-1 h-px ml-1.5" style={{ background: 'linear-gradient(90deg, rgba(255,184,0,0.25), transparent)' }} />
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl overflow-hidden ${className}`}
      style={{
        background: 'linear-gradient(135deg, rgba(18,18,42,0.9), rgba(26,26,58,0.8))',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
      {children}
    </div>
  )
}

function Divider() {
  return <div className="h-px mx-3" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)' }} />
}

function IconBox({ icon: Icon, color }: { icon: any; color: string }) {
  return (
    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
      style={{ background: `${color}15` }}>
      <Icon size={15} style={{ color }} />
    </div>
  )
}

function ToggleRow({ icon, color, title, subtitle, value, onChange }: {
  icon: any; color: string; title: string; subtitle: string
  value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-3 cursor-pointer hover:bg-white/[0.015] transition-colors" onClick={() => onChange(!value)}>
      <IconBox icon={icon} color={color} />
      <div className="flex-1 min-w-0">
        <p className="text-text-white text-sm font-medium">{title}</p>
        <p className="text-text-disabled text-xs mt-0.5">{subtitle}</p>
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  )
}

function NavRow({ icon, color, title, subtitle, onClick, badge }: {
  icon: any; color: string; title: string; subtitle: string
  onClick: () => void; badge?: string
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-3 cursor-pointer hover:bg-white/[0.015] transition-colors" onClick={onClick}>
      <IconBox icon={icon} color={color} />
      <div className="flex-1 min-w-0">
        <p className="text-text-white text-sm font-medium">{title}</p>
        <p className="text-text-disabled text-xs mt-0.5">{subtitle}</p>
      </div>
      {badge
        ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.15)' }}>{badge}</span>
        : <ChevronRight size={14} className="text-text-disabled/40" />}
    </div>
  )
}

function StatItem({ icon: Icon, color, label, value }: { icon: any; color: string; label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-white/[0.03]">
      <Icon size={15} style={{ color }} />
      <p className="text-text-white text-base font-bold leading-none">{value}</p>
      <p className="text-text-disabled text-[10px] uppercase tracking-wider font-medium">{label}</p>
    </div>
  )
}

function Input({ placeholder, value, onChange, type = 'text', className = '' }: {
  placeholder?: string; value: string; onChange: (v: string) => void; type?: string; className?: string
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-lg px-3 py-2 text-sm outline-none transition-all duration-200 focus:border-primary ${className}`}
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }} />
  )
}

function Select({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder?: string
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all duration-200 focus:border-primary appearance-none cursor-pointer"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: value ? '#fff' : 'rgba(255,255,255,0.4)',
        backgroundImage: `url("data:image/svg+xml,%3Csvg width=10 height=5 viewBox=0 0 10 5 fill=none xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cpath d=%27M1 1L5 4L9 1%27 stroke=%27rgba(255,255,255,0.3)%27 stroke-width=%271.2%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
        paddingRight: '28px',
      }}>
      {placeholder && <option value="" disabled style={{ background: '#12122A' }}>{placeholder}</option>}
      {options.map(o => <option key={o} value={o} style={{ background: '#12122A' }}>{o}</option>)}
    </select>
  )
}

export default function SettingsModal({ onClose }: { onClose?: () => void }) {
  const { profile, logout, refreshProfile } = useAuth()
  const { theme: activeTheme, setTheme } = useTheme()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [settings, setSettings] = useState<Partial<UserSettings>>({})
  const [loading, setLoading] = useState(true)
  const [avatarUploading, setAvatarUploading] = useState(false)

  const [districtInput, setDistrictInput] = useState('')
  const [savingDistrict, setSavingDistrict] = useState(false)

  const [eduForm, setEduForm] = useState({ level: '', school: '', combination: '', course: '', profession: '' })
  const [savingEdu, setSavingEdu] = useState(false)
  const [eduSaved, setEduSaved] = useState(false)

  const [pwdForm, setPwdForm] = useState({ newPwd: '', confirm: '' })
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [pwdSuccess, setPwdSuccess] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  const [showLogout, setShowLogout] = useState(false)
  const [activeSection, setActiveSection] = useState('profile')

  const SECTIONS = [
    { id: 'profile', icon: Camera, label: 'Profile', color: '#F59E0B' },
    { id: 'education', icon: GraduationCap, label: 'Education', color: '#F59E0B' },
    { id: 'learning', icon: Brain, label: 'Learning', color: '#7C4DFF' },
    { id: 'appearance', icon: Palette, label: 'Appearance', color: '#7C4DFF' },
    { id: 'audio', icon: Headphones, label: 'Audio', color: '#00E5FF' },
    { id: 'notifications', icon: BellRing, label: 'Notifications', color: '#F59E0B' },
    { id: 'links', icon: Share2, label: 'Links', color: '#00E5FF' },
    { id: 'account', icon: Lock, label: 'Account', color: '#EF4444' },
  ]

  useEffect(() => {
    if (profile) {
      setDistrictInput(profile.district)
      setEduForm({ level: profile.education_level, school: profile.school, combination: profile.combination, course: profile.course, profession: profile.profession })
      loadSettings()
    }
  }, [profile])

  async function loadSettings() {
    if (!profile) return
    const { data } = await supabase.from('user_settings').select('*').eq('user_id', profile.user_id).single()
    if (data) setSettings(data as UserSettings)
    setLoading(false)
  }

  async function saveSetting(field: string, value: any) {
    if (!profile) return
    setSettings(s => ({ ...s, [field]: value }))
    await supabase.from('user_settings').upsert({ [field]: value, user_id: profile.user_id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (field === 'app_theme') setTheme(value)
  }

  async function saveDistrict() {
    if (!profile || !districtInput.trim()) return
    setSavingDistrict(true)
    await supabase.from('users').update({ district: districtInput.trim() }).eq('user_id', profile.user_id)
    await refreshProfile()
    setSavingDistrict(false)
  }

  async function saveEducation() {
    if (!profile) return
    setSavingEdu(true)
    await supabase.from('users').update({
      education_level: eduForm.level, school: eduForm.school,
      combination: eduForm.combination, course: eduForm.course,
      profession: eduForm.profession,
    }).eq('user_id', profile.user_id)
    await refreshProfile()
    setEduSaved(true)
    setSavingEdu(false)
    setTimeout(() => setEduSaved(false), 2000)
  }

  async function uploadAvatar(file: File) {
    if (!profile) return
    setAvatarUploading(true)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${profile.user_id}/avatar_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!error) {
      const url = `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}`
      await supabase.from('users').update({ avatar_url: url }).eq('user_id', profile.user_id)
      await refreshProfile()
    }
    setAvatarUploading(false)
  }

  async function changePassword() {
    if (pwdForm.newPwd !== pwdForm.confirm) { setPwdError('Passwords do not match'); return }
    if (pwdForm.newPwd.length < 6) { setPwdError('Password must be at least 6 characters'); return }
    setPwdError(''); setPwdLoading(true)
    const { error } = await supabase.auth.updateUser({ password: pwdForm.newPwd })
    setPwdLoading(false)
    if (error) setPwdError(error.message)
    else { setPwdSuccess(true); setPwdForm({ newPwd: '', confirm: '' }) }
  }

  async function handleLogout() {
    await logout()
    onClose?.()
    navigate('/login')
  }

  if (!profile) return null

  const isALevel = ['S5', 'S6'].includes(eduForm.level)
  const isUniversity = eduForm.level === 'University'
  const isProfessional = eduForm.level === 'Professional'
  const showSchool = !isUniversity && !isProfessional
  const eduChanged = eduForm.level !== profile.education_level || eduForm.school !== profile.school ||
    eduForm.combination !== profile.combination || eduForm.course !== profile.course ||
    eduForm.profession !== profile.profession

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="w-full max-w-3xl h-[85vh] rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: '#0A0A1F',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        }}>

      {/* ── TOP BAR ── */}
      <div className="px-3 py-2.5 flex items-center gap-2 shrink-0 border-b border-white/[0.04]"
        style={{ background: 'rgba(10,10,31,0.9)' }}>
        <button onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 hover:bg-white/10 transition-colors">
          <ChevronLeft size={18} className="text-text-white" />
        </button>
        <div className="w-7 h-7 rounded-full flex items-center justify-center font-black text-[10px] shrink-0"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#0A0A1F' }}>T</div>
        <p className="text-text-white font-bold text-base">Settings</p>
        <div className="flex-1" />
        <div className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
          style={{ background: 'rgba(255,184,0,0.1)', color: '#FFB800', border: '1px solid rgba(255,184,0,0.15)' }}>
          v1.0.0
        </div>
      </div>

      {/* ── SIDEBAR + PANEL ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── SIDEBAR ── */}
        <div className="w-44 shrink-0 border-r border-white/[0.04] py-3 overflow-y-auto"
          style={{ background: 'rgba(12,12,35,0.95)' }}>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-200"
              style={{
                background: activeSection === s.id ? 'rgba(255,184,0,0.08)' : 'transparent',
                color: activeSection === s.id ? '#FFB800' : 'rgba(255,255,255,0.45)',
                borderRight: activeSection === s.id ? '2px solid #FFB800' : '2px solid transparent',
              }}>
              <s.icon size={16} style={{ color: activeSection === s.id ? s.color : 'rgba(255,255,255,0.25)' }} />
              <span className="font-medium">{s.label}</span>
            </button>
          ))}
        </div>

        {/* ── PANEL ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* ── PROFILE ── */}
          {activeSection === 'profile' && (
            <div className="max-w-xl">
              {/* Avatar + Name header */}
              <div className="flex items-center gap-4 mb-5">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                      boxShadow: '0 0 24px rgba(245,158,11,0.25)',
                    }}>
                    {profile.avatar_url
                      ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />
                      : <span className="text-2xl font-black" style={{ color: '#0A0A1F' }}>{profile.name.charAt(0).toUpperCase()}</span>}
                  </div>
                  <button onClick={() => fileRef.current?.click()}
                    className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                    style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
                    {avatarUploading ? <Loader2 size={11} className="animate-spin" style={{ color: '#0A0A1F' }} /> : <Camera size={11} style={{ color: '#0A0A1F' }} />}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={e => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-text-white text-xl font-bold truncate flex items-center gap-2">
                    {profile.name || 'Student'}
                    <Sparkles size={15} style={{ color: '#F59E0B' }} />
                  </p>
                  <p className="text-text-disabled text-sm truncate">{profile.email}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>
                      {profile.education_level || 'Student'}
                    </span>
                    {profile.district && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.15)' }}>
                        📍 {profile.district}
                      </span>
                    )}
                    <span className="text-[11px] text-text-disabled/50">
                      Joined {new Date(profile.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="flex flex-col items-center gap-1.5 p-4 rounded-xl"
                  style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.1)' }}>
                  <MessageSquare size={18} style={{ color: '#F59E0B' }} />
                  <p className="text-text-white text-xl font-bold leading-none">{profile.total_messages}</p>
                  <p className="text-text-disabled text-[10px] font-semibold uppercase tracking-wider">Messages</p>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-4 rounded-xl"
                  style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.1)' }}>
                  <BookOpen size={18} style={{ color: '#00E5FF' }} />
                  <p className="text-text-white text-xl font-bold leading-none">{profile.total_quizzes}</p>
                  <p className="text-text-disabled text-[10px] font-semibold uppercase tracking-wider">Quizzes</p>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-4 rounded-xl"
                  style={{ background: 'rgba(124,77,255,0.06)', border: '1px solid rgba(124,77,255,0.1)' }}>
                  <FileText size={18} style={{ color: '#7C4DFF' }} />
                  <p className="text-text-white text-xl font-bold leading-none">{profile.total_documents}</p>
                  <p className="text-text-disabled text-[10px] font-semibold uppercase tracking-wider">Docs</p>
                </div>
              </div>

              {/* Details */}
              <Card>
                <div className="p-4 space-y-3">
                  <p className="text-text-disabled text-xs font-bold uppercase tracking-widest">Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <p className="text-text-disabled text-[10px] uppercase tracking-wider mb-1">Education</p>
                      <p className="text-text-white text-sm font-medium">{profile.education_level || 'Not set'}</p>
                    </div>
                    <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <p className="text-text-disabled text-[10px] uppercase tracking-wider mb-1">District</p>
                      <p className="text-text-white text-sm font-medium">{profile.district || 'Not set'}</p>
                    </div>
                    {isALevel && profile.combination && (
                      <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <p className="text-text-disabled text-[10px] uppercase tracking-wider mb-1">Combination</p>
                        <p className="text-text-white text-sm font-medium">{profile.combination}</p>
                      </div>
                    )}
                    {profile.school && (
                      <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <p className="text-text-disabled text-[10px] uppercase tracking-wider mb-1">School</p>
                        <p className="text-text-white text-sm font-medium">{profile.school}</p>
                      </div>
                    )}
                    {isUniversity && profile.course && (
                      <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <p className="text-text-disabled text-[10px] uppercase tracking-wider mb-1">Course</p>
                        <p className="text-text-white text-sm font-medium">{profile.course}</p>
                      </div>
                    )}
                    {isProfessional && profile.profession && (
                      <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <p className="text-text-disabled text-[10px] uppercase tracking-wider mb-1">Profession</p>
                        <p className="text-text-white text-sm font-medium">{profile.profession}</p>
                      </div>
                    )}
                    <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <p className="text-text-disabled text-[10px] uppercase tracking-wider mb-1">Member Since</p>
                      <p className="text-text-white text-sm font-medium">
                        {new Date(profile.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* ── EDUCATION ── */}
          {activeSection === 'education' && (
            <div className="max-w-xl space-y-4">
              {/* Current status */}
              <Card>
                <div className="p-4">
                  <p className="text-text-disabled text-xs font-bold uppercase tracking-widest mb-3">Current Education</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.1)' }}>
                      <p className="text-text-disabled text-[10px] uppercase tracking-wider mb-1">Level</p>
                      <p className="text-text-white text-sm font-bold flex items-center gap-1.5">
                        <GraduationCap size={14} style={{ color: '#F59E0B' }} />
                        {profile.education_level || 'Not set'}
                      </p>
                    </div>
                    {profile.school && (
                      <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <p className="text-text-disabled text-[10px] uppercase tracking-wider mb-1">School</p>
                        <p className="text-text-white text-sm font-medium">{profile.school}</p>
                      </div>
                    )}
                    {isALevel && profile.combination && (
                      <div className="p-3 rounded-lg" style={{ background: 'rgba(124,77,255,0.06)', border: '1px solid rgba(124,77,255,0.1)' }}>
                        <p className="text-text-disabled text-[10px] uppercase tracking-wider mb-1">Combination</p>
                        <p className="text-text-white text-sm font-medium">{profile.combination}</p>
                      </div>
                    )}
                    {isUniversity && profile.course && (
                      <div className="p-3 rounded-lg" style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.1)' }}>
                        <p className="text-text-disabled text-[10px] uppercase tracking-wider mb-1">Course</p>
                        <p className="text-text-white text-sm font-medium">{profile.course}</p>
                      </div>
                    )}
                    {isProfessional && profile.profession && (
                      <div className="p-3 rounded-lg" style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.1)' }}>
                        <p className="text-text-disabled text-[10px] uppercase tracking-wider mb-1">Profession</p>
                        <p className="text-text-white text-sm font-medium">{profile.profession}</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Edit form */}
              <Card>
                <div className="p-4 space-y-3">
                  <p className="text-text-disabled text-xs font-bold uppercase tracking-widest">Update Education</p>
                  <Select value={eduForm.level} onChange={v => { setEduForm(f => ({ ...f, level: v, school: '', combination: '', course: '', profession: '' })); setEduSaved(false) }}
                    options={EDUCATION_LEVELS} placeholder="Select level…" />
                  <div className="grid grid-cols-2 gap-3">
                    {isALevel && <Input value={eduForm.combination} onChange={v => setEduForm(f => ({ ...f, combination: v }))} placeholder="Combination (e.g. PCB)" />}
                    {isUniversity && <Input value={eduForm.course} onChange={v => setEduForm(f => ({ ...f, course: v }))} placeholder="Course" />}
                    {isProfessional && <Input value={eduForm.profession} onChange={v => setEduForm(f => ({ ...f, profession: v }))} placeholder="Profession" />}
                    {showSchool && <Input value={eduForm.school} onChange={v => setEduForm(f => ({ ...f, school: v }))} placeholder="School (Optional)" />}
                  </div>
                  {eduChanged && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(245,158,11,0.06)' }}>
                      <Info size={12} style={{ color: '#F59E0B' }} className="shrink-0 mt-0.5" />
                      <p className="text-text-disabled">Updates your subjects, AI context and timetable.</p>
                    </div>
                  )}
                  <button onClick={saveEducation} disabled={!eduChanged || savingEdu}
                    className="w-full py-2.5 rounded-lg text-sm font-bold disabled:opacity-30 transition-all hover:brightness-110 flex items-center justify-center gap-1.5"
                    style={{
                      background: eduChanged ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'rgba(255,255,255,0.05)',
                      color: eduChanged ? '#0A0A1F' : '#666',
                      boxShadow: eduChanged ? '0 3px 10px rgba(245,158,11,0.25)' : 'none',
                    }}>
                    {savingEdu ? <Loader2 size={11} className="animate-spin" /> : null}
                    {eduSaved ? '✓ Saved!' : eduChanged ? 'Save Changes' : 'No Changes'}
                  </button>
                </div>
              </Card>
            </div>
          )}

          {/* ── LEARNING ── */}
          {activeSection === 'learning' && (
            <div className="max-w-lg space-y-4">
              {/* Current setting */}
              <Card>
                <div className="p-4">
                  <p className="text-text-disabled text-xs font-bold uppercase tracking-widest mb-3">Quiz Difficulty</p>
                  <div className="p-3 rounded-lg flex items-center gap-3"
                    style={{ background: 'rgba(124,77,255,0.06)', border: '1px solid rgba(124,77,255,0.1)' }}>
                    <Brain size={20} style={{ color: '#7C4DFF' }} />
                    <div>
                      <p className="text-text-white text-sm font-bold capitalize">
                        {settings.quiz_difficulty || 'adaptive'}
                      </p>
                      <p className="text-text-disabled text-xs mt-0.5">
                        {settings.quiz_difficulty === 'adaptive' && 'Adjusts to your performance automatically'}
                        {settings.quiz_difficulty === 'easy' && 'Simple questions to build confidence'}
                        {settings.quiz_difficulty === 'medium' && 'Moderate questions to challenge you'}
                        {settings.quiz_difficulty === 'hard' && 'Tough questions to push your limits'}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Change difficulty */}
              <Card>
                <div className="p-4 space-y-3">
                  <p className="text-text-disabled text-xs font-bold uppercase tracking-widest">Change Difficulty</p>
                  <div className="grid grid-cols-2 gap-2">
                    {DIFFICULTIES.map(d => {
                      const active = (settings.quiz_difficulty || 'adaptive') === d
                      return (
                        <button key={d} onClick={() => saveSetting('quiz_difficulty', d)}
                          className={`p-3 rounded-lg text-left transition-all ${
                            active ? 'ring-2' : 'hover:bg-white/[0.03]'
                          }`}
                          style={{
                            background: active ? 'rgba(124,77,255,0.1)' : 'rgba(255,255,255,0.03)',
                            borderColor: active ? '#7C4DFF' : 'rgba(255,255,255,0.06)',
                            borderWidth: 1,
                            borderStyle: 'solid',
                          }}>
                          <p className={`text-sm font-bold capitalize ${active ? 'text-white' : 'text-text-disabled'}`}>{d}</p>
                          <p className="text-[10px] mt-0.5" style={{ color: active ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)' }}>
                            {d === 'adaptive' && 'Auto-adjust to your skill'}
                            {d === 'easy' && 'For beginners'}
                            {d === 'medium' && 'Balanced challenge'}
                            {d === 'hard' && 'Expert level'}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* ── APPEARANCE ── */}
          {activeSection === 'appearance' && (
            <div className="max-w-lg space-y-4">
              {/* Current theme */}
              <Card>
                <div className="p-4">
                  <p className="text-text-disabled text-xs font-bold uppercase tracking-widest mb-3">Active Theme</p>
                  <div className="p-4 rounded-lg flex items-center gap-4"
                    style={{ background: THEME_COLORS[activeTheme][3], border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="w-10 h-10 rounded-xl overflow-hidden relative shrink-0" style={{ background: THEME_COLORS[activeTheme][0] }}>
                      <div className="absolute bottom-1 left-1 w-3 h-3 rounded-full" style={{ background: THEME_COLORS[activeTheme][1] }} />
                      <div className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full" style={{ background: THEME_COLORS[activeTheme][2] }} />
                    </div>
                    <div>
                      <p className="text-text-white text-sm font-bold">{activeTheme.split('_')[0]}</p>
                      <p className="text-text-disabled text-xs mt-0.5">
                        {activeTheme === 'DEEP_SPACE' && 'Dark purple cosmic theme'}
                        {activeTheme === 'MIDNIGHT' && 'Pure black sleek theme'}
                        {activeTheme === 'FOREST' && 'Dark green natural theme'}
                        {activeTheme === 'OCEAN' && 'Deep blue aquatic theme'}
                        {activeTheme === 'SUNSET' && 'Warm amber evening theme'}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Change theme */}
              <Card>
                <div className="p-4">
                  <p className="text-text-disabled text-xs font-bold uppercase tracking-widest mb-3">Choose Theme</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {THEMES.map(t => {
                      const active = activeTheme === t
                      const [bg, c1, c2] = THEME_COLORS[t]
                      return (
                        <button key={t} onClick={() => saveSetting('app_theme', t)}
                          className={`p-3 rounded-lg text-left transition-all ${
                            active ? 'ring-2' : 'hover:bg-white/[0.03]'
                          }`}
                          style={{
                            background: active ? `${bg}40` : 'rgba(255,255,255,0.03)',
                            borderColor: active ? '#F59E0B' : 'rgba(255,255,255,0.06)',
                            borderWidth: 1,
                            borderStyle: 'solid',
                          }}>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg overflow-hidden relative shrink-0" style={{ background: bg }}>
                              <div className="absolute bottom-0.5 left-0.5 w-2.5 h-2.5 rounded-full" style={{ background: c1 }} />
                              <div className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full" style={{ background: c2 }} />
                            </div>
                            <div>
                              <p className={`text-xs font-bold ${active ? 'text-white' : 'text-text-disabled'}`}>
                                {t.split('_')[0]}
                              </p>
                              <p className="text-[10px] mt-px" style={{ color: active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)' }}>
                                {t === 'DEEP_SPACE' && 'Cosmic'}
                                {t === 'MIDNIGHT' && 'Sleek'}
                                {t === 'FOREST' && 'Nature'}
                                {t === 'OCEAN' && 'Aquatic'}
                                {t === 'SUNSET' && 'Warm'}
                              </p>
                            </div>
                            {active && <CheckCircle size={14} style={{ color: '#F59E0B' }} className="ml-auto" />}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* ── AUDIO ── */}
          {activeSection === 'audio' && (
            <div className="max-w-lg space-y-4">
              <Card>
                <div className="p-4">
                  <p className="text-text-disabled text-xs font-bold uppercase tracking-widest mb-3">Audio Features</p>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className={`p-3 rounded-lg text-center ${settings.voice_enabled ? '' : 'opacity-40'}`}
                      style={{ background: settings.voice_enabled ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(245,158,11,0.1)' }}>
                      <Mic size={18} style={{ color: '#F59E0B' }} className="mx-auto mb-1.5" />
                      <p className="text-text-white text-xs font-bold">Voice Input</p>
                      <p className="text-text-disabled text-[10px] mt-0.5">Speak to AI</p>
                    </div>
                    <div className={`p-3 rounded-lg text-center ${settings.auto_read_enabled ? '' : 'opacity-40'}`}
                      style={{ background: settings.auto_read_enabled ? 'rgba(0,229,255,0.08)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,229,255,0.1)' }}>
                      <Volume2 size={18} style={{ color: '#00E5FF' }} className="mx-auto mb-1.5" />
                      <p className="text-text-white text-xs font-bold">Auto-Read</p>
                      <p className="text-text-disabled text-[10px] mt-0.5">Read aloud</p>
                    </div>
                    <div className={`p-3 rounded-lg text-center ${settings.quiz_sound_enabled ? '' : 'opacity-40'}`}
                      style={{ background: settings.quiz_sound_enabled ? 'rgba(124,77,255,0.08)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(124,77,255,0.1)' }}>
                      <Bell size={18} style={{ color: '#7C4DFF' }} className="mx-auto mb-1.5" />
                      <p className="text-text-white text-xs font-bold">Quiz SFX</p>
                      <p className="text-text-disabled text-[10px] mt-0.5">Sound effects</p>
                    </div>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="p-4">
                  <p className="text-text-disabled text-xs font-bold uppercase tracking-widest mb-2">Manage Audio</p>
                  <ToggleRow icon={Mic} color="#F59E0B" title="Voice Input" subtitle="Speak to AI" value={!!settings.voice_enabled} onChange={v => saveSetting('voice_enabled', v)} />
                  <Divider />
                  <ToggleRow icon={Volume2} color="#00E5FF" title="Auto-Read" subtitle="Read aloud" value={!!settings.auto_read_enabled} onChange={v => saveSetting('auto_read_enabled', v)} />
                  <Divider />
                  <ToggleRow icon={Bell} color="#7C4DFF" title="Quiz SFX" subtitle="Sound effects" value={!!settings.quiz_sound_enabled} onChange={v => saveSetting('quiz_sound_enabled', v)} />
                </div>
              </Card>
            </div>
          )}

          {/* ── NOTIFICATIONS ── */}
          {activeSection === 'notifications' && (
            <div className="max-w-lg space-y-4">
              <Card>
                <div className="p-4">
                  <p className="text-text-disabled text-xs font-bold uppercase tracking-widest mb-3">Notification Status</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className={`p-3 rounded-lg text-center ${settings.notifications_enabled ? '' : 'opacity-40'}`}
                      style={{ background: settings.notifications_enabled ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(245,158,11,0.1)' }}>
                      <Bell size={18} style={{ color: '#F59E0B' }} className="mx-auto mb-1.5" />
                      <p className="text-text-white text-xs font-bold">Push Notifications</p>
                      <p className="text-text-disabled text-[10px] mt-0.5">Updates & news</p>
                    </div>
                    <div className={`p-3 rounded-lg text-center ${settings.study_reminders_enabled ? '' : 'opacity-40'}`}
                      style={{ background: settings.study_reminders_enabled ? 'rgba(0,229,255,0.08)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,229,255,0.1)' }}>
                      <BellRing size={18} style={{ color: '#00E5FF' }} className="mx-auto mb-1.5" />
                      <p className="text-text-white text-xs font-bold">Study Reminders</p>
                      <p className="text-text-disabled text-[10px] mt-0.5">Daily reminders</p>
                    </div>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="p-4">
                  <p className="text-text-disabled text-xs font-bold uppercase tracking-widest mb-2">Manage Notifications</p>
                  <ToggleRow icon={Bell} color="#F59E0B" title="Push Notifications" subtitle="Updates & news" value={!!settings.notifications_enabled} onChange={v => saveSetting('notifications_enabled', v)} />
                  <Divider />
                  <ToggleRow icon={BellRing} color="#00E5FF" title="Study Reminders" subtitle="Daily reminders" value={!!settings.study_reminders_enabled} onChange={v => saveSetting('study_reminders_enabled', v)} />
                </div>
              </Card>
            </div>
          )}

          {/* ── LINKS ── */}
          {activeSection === 'links' && (
            <div className="max-w-lg space-y-4">
              <Card>
                <div className="p-4">
                  <p className="text-text-disabled text-xs font-bold uppercase tracking-widest mb-3">Quick Links</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button onClick={() => navigate('/progress')}
                      className="p-3 rounded-lg text-left transition-all hover:bg-white/[0.03]"
                      style={{ background: 'rgba(124,77,255,0.06)', border: '1px solid rgba(124,77,255,0.1)' }}>
                      <BarChart2 size={18} style={{ color: '#7C4DFF' }} className="mb-1" />
                      <p className="text-text-white text-sm font-bold">Progress</p>
                      <p className="text-text-disabled text-[10px] mt-0.5">Stats & achievements</p>
                    </button>
                    <button onClick={() => navigate('/timetable')}
                      className="p-3 rounded-lg text-left transition-all hover:bg-white/[0.03]"
                      style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.1)' }}>
                      <Calendar size={18} style={{ color: '#F59E0B' }} className="mb-1" />
                      <p className="text-text-white text-sm font-bold">Timetable</p>
                      <p className="text-text-disabled text-[10px] mt-0.5">Study schedule</p>
                    </button>
                    <button onClick={() => {}}
                      className="p-3 rounded-lg text-left transition-all hover:bg-white/[0.03] opacity-60"
                      style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.1)' }}>
                      <Download size={18} style={{ color: '#00E676' }} className="mb-1" />
                      <p className="text-text-white text-sm font-bold">Offline Mode</p>
                      <p className="text-text-disabled text-[10px] mt-0.5">Coming soon</p>
                    </button>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="p-4">
                  <p className="text-text-disabled text-xs font-bold uppercase tracking-widest mb-3">Information</p>
                  <div className="p-3 rounded-lg flex items-center gap-3 mb-2"
                    style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.1)' }}>
                    <Info size={18} style={{ color: '#00E5FF' }} />
                    <div>
                      <p className="text-text-white text-sm font-medium">Version</p>
                      <p className="text-text-disabled text-xs">TutorUG v1.0.0</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg flex items-center gap-3 mb-2"
                    style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.1)' }}>
                    <Shield size={18} style={{ color: '#F59E0B' }} />
                    <div>
                      <p className="text-text-white text-sm font-medium">Privacy Policy</p>
                      <p className="text-text-disabled text-xs">Data protection</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg flex items-center gap-3"
                    style={{ background: 'rgba(124,77,255,0.06)', border: '1px solid rgba(124,77,255,0.1)' }}>
                    <FileCheck size={18} style={{ color: '#7C4DFF' }} />
                    <div>
                      <p className="text-text-white text-sm font-medium">Terms of Service</p>
                      <p className="text-text-disabled text-xs">Usage terms</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* ── ACCOUNT ── */}
          {activeSection === 'account' && (
            <div className="max-w-lg space-y-4">
              <Card>
                <div className="p-4">
                  <p className="text-text-disabled text-xs font-bold uppercase tracking-widest mb-3">Account Info</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <p className="text-text-disabled text-[10px] uppercase tracking-wider mb-1">Email</p>
                      <p className="text-text-white text-sm font-medium truncate">{profile.email}</p>
                    </div>
                    <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <p className="text-text-disabled text-[10px] uppercase tracking-wider mb-1">Member Since</p>
                      <p className="text-text-white text-sm font-medium">
                        {new Date(profile.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="p-4 space-y-3">
                  <p className="text-text-disabled text-xs font-bold uppercase tracking-widest">Change Password</p>
                  {pwdError && <p className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>{pwdError}</p>}
                  {pwdSuccess && <p className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(0,230,118,0.1)', color: '#00E676' }}>Password changed!</p>}
                  <div className="relative">
                    <input type={showPwd ? 'text' : 'password'} value={pwdForm.newPwd}
                      onChange={e => setPwdForm(f => ({ ...f, newPwd: e.target.value }))}
                      placeholder="New password"
                      className="w-full rounded-lg px-3 py-2 pr-9 text-sm outline-none transition-all focus:border-primary"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }} />
                    <button onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-disabled hover:text-primary">
                      {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <input type="password" value={pwdForm.confirm}
                    onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))}
                    placeholder="Confirm password"
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all focus:border-primary"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }} />
                  <button onClick={changePassword} disabled={pwdLoading || !pwdForm.newPwd}
                    className="w-full py-2.5 rounded-lg text-sm font-bold disabled:opacity-30 transition-all hover:brightness-110 flex items-center justify-center gap-1.5"
                    style={{
                      background: pwdForm.newPwd ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'rgba(255,255,255,0.05)',
                      color: pwdForm.newPwd ? '#0A0A1F' : '#666',
                      boxShadow: pwdForm.newPwd ? '0 3px 10px rgba(245,158,11,0.25)' : 'none',
                    }}>
                    {pwdLoading ? <Loader2 size={10} className="animate-spin" /> : null}
                    Update Password
                  </button>
                </div>
              </Card>
              <button onClick={() => setShowLogout(true)}
                className="w-full p-4 rounded-xl flex items-center gap-3 transition-all hover:brightness-110"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.15)' }}>
                  <LogOut size={18} style={{ color: '#EF4444' }} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold" style={{ color: '#EF4444' }}>Sign Out</p>
                  <p className="text-xs" style={{ color: 'rgba(239,68,68,0.5)' }}>Sign out of your account</p>
                </div>
              </button>
            </div>
          )}


        </div>
      </div>

      {/* ── LOGOUT DIALOG ── */}
      {showLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
          <div className="rounded-xl p-5 w-full max-w-[260px] text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(18,18,42,0.96), rgba(26,26,58,0.92))',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(239,68,68,0.15)' }}>
              <LogOut size={22} style={{ color: '#EF4444' }} />
            </div>
            <p className="text-text-white font-bold text-base mb-1">Sign Out?</p>
            <p className="text-text-disabled text-xs mb-4">You'll need to sign in again.</p>
            <div className="flex gap-2.5">
              <button onClick={() => setShowLogout(false)}
                className="flex-1 py-2 rounded-lg text-xs font-bold transition-all hover:bg-white/5"
                style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#999' }}>
                Cancel
              </button>
              <button onClick={handleLogout}
                className="flex-1 py-2 rounded-lg text-xs font-bold transition-all hover:brightness-110"
                style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)', color: '#fff' }}>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  )
}

function Chip({ icon: Icon, color, label, value }: { icon: any; color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs" style={{ background: `${color}08`, border: `1px solid ${color}15` }}>
      <Icon size={11} style={{ color }} />
      <span className="text-text-disabled">{label}:</span>
      <span className="text-text-white font-medium">{value}</span>
    </div>
  )
}
