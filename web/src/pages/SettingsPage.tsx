import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera, Loader2, MapPin, GraduationCap, MessageSquare, FileText,
  BookOpen, ChevronRight, Mic, Volume2, Bell, BellRing, BarChart2,
  Calendar, Download, Info, Shield, FileCheck, Star, Share2,
  Lock, LogOut, Eye, EyeOff, School, Briefcase,
} from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { SUPABASE_URL } from '@/lib/supabase'
import { EDUCATION_LEVELS } from '@/lib/constants'
import type { UserSettings } from '@/types'

const THEMES = ['DEEP_SPACE', 'MIDNIGHT', 'FOREST', 'OCEAN', 'SUNSET']
const DIFFICULTIES = ['adaptive', 'easy', 'medium', 'hard']

const THEME_COLORS: Record<string, [string, string, string]> = {
  DEEP_SPACE: ['#0F0F2E', '#FFC107', '#7C4DFF'],
  MIDNIGHT:   ['#000000', '#FFC107', '#00E5FF'],
  FOREST:     ['#050F05', '#00E676', '#FFC107'],
  OCEAN:      ['#020D1A', '#00E5FF', '#FFC107'],
  SUNSET:     ['#100500', '#FF6B6B', '#FFC107'],
}

// ── Reusable section label ────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-text-disabled text-xs font-bold uppercase tracking-wider px-1 mb-2">{children}</p>
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#12122A' }}>
      {children}
    </div>
  )
}

// ── Divider ───────────────────────────────────────────────────────────────────
function Divider() {
  return <div className="h-px mx-4" style={{ background: 'rgba(255,255,255,0.06)' }} />
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${value ? 'bg-primary' : 'bg-outline'}`}>
      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${value ? 'translate-x-6' : 'translate-x-0.5'}`} />
    </button>
  )
}

// ── Icon box ──────────────────────────────────────────────────────────────────
function IconBox({ icon: Icon, color }: { icon: any; color: string }) {
  return (
    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
      style={{ background: `${color}20` }}>
      <Icon size={18} style={{ color }} />
    </div>
  )
}

// ── Settings row with toggle ──────────────────────────────────────────────────
function ToggleRow({ icon, color, title, subtitle, value, onChange }: {
  icon: any; color: string; title: string; subtitle: string
  value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer" onClick={() => onChange(!value)}>
      <IconBox icon={icon} color={color} />
      <div className="flex-1 min-w-0">
        <p className="text-text-white text-sm font-medium">{title}</p>
        <p className="text-text-disabled text-xs">{subtitle}</p>
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  )
}

// ── Settings row with chevron ─────────────────────────────────────────────────
function NavRow({ icon, color, title, subtitle, onClick, badge }: {
  icon: any; color: string; title: string; subtitle: string
  onClick: () => void; badge?: string
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer" onClick={onClick}>
      <IconBox icon={icon} color={color} />
      <div className="flex-1 min-w-0">
        <p className="text-text-white text-sm font-medium">{title}</p>
        <p className="text-text-disabled text-xs">{subtitle}</p>
      </div>
      {badge
        ? <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,229,255,0.15)', color: '#00E5FF' }}>{badge}</span>
        : <ChevronRight size={16} className="text-text-disabled shrink-0" />}
    </div>
  )
}

// ── Profile stat item ─────────────────────────────────────────────────────────
function StatItem({ icon: Icon, color, label, value }: { icon: any; color: string; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={13} style={{ color }} />
      <div>
        <p className="text-text-disabled text-xs leading-none">{label}</p>
        <p className="text-text-white text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { profile, logout, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [settings, setSettings] = useState<Partial<UserSettings>>({})
  const [loading, setLoading] = useState(true)
  const [avatarUploading, setAvatarUploading] = useState(false)

  // District edit
  const [districtInput, setDistrictInput] = useState('')
  const [savingDistrict, setSavingDistrict] = useState(false)

  // Education edit
  const [eduForm, setEduForm] = useState({ level: '', school: '', combination: '', course: '', profession: '' })
  const [savingEdu, setSavingEdu] = useState(false)
  const [eduSaved, setEduSaved] = useState(false)

  // Password
  const [pwdForm, setPwdForm] = useState({ newPwd: '', confirm: '' })
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [pwdSuccess, setPwdSuccess] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  // Logout dialog
  const [showLogout, setShowLogout] = useState(false)

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
    await supabase.from('users').update({ education_level: eduForm.level, school: eduForm.school, combination: eduForm.combination, course: eduForm.course, profession: eduForm.profession }).eq('user_id', profile.user_id)
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
    navigate('/login')
  }

  if (!profile) return null

  const isALevel = ['S5', 'S6'].includes(eduForm.level)
  const isUniversity = eduForm.level === 'University'
  const isProfessional = eduForm.level === 'Professional'
  const showSchool = !isUniversity && !isProfessional
  const eduChanged = eduForm.level !== profile.education_level || eduForm.school !== profile.school || eduForm.combination !== profile.combination || eduForm.course !== profile.course || eduForm.profession !== profile.profession

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-surface to-bg overflow-hidden">

      {/* ── TOP BAR — matches mobile ── */}
      <div className="bg-gradient-to-r from-surface to-surface-var px-2 py-2 flex items-center gap-2 shrink-0">
        <button onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'rgba(255,255,255,0.06)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-white">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        {/* Logo placeholder */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#0A0A1F' }}>T</div>
        <p className="text-text-white font-bold text-lg">Settings</p>
      </div>

      {/* ── SCROLLABLE CONTENT ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

        {/* ── PROFILE CARD ── */}
        <div className="rounded-2xl overflow-hidden relative" style={{ background: '#12122A' }}>
          {/* Gradient top bar */}
          <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#F59E0B,#7C4DFF,#00E5FF)' }} />
          <div className="p-5">
            {/* Avatar + name row */}
            <div className="flex items-center gap-4 mb-4">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />
                    : <span className="text-3xl font-black" style={{ color: '#0A0A1F' }}>{profile.name.charAt(0).toUpperCase()}</span>}
                </div>
                <button onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: '#F59E0B' }}>
                  {avatarUploading ? <Loader2 size={12} className="animate-spin text-ink" /> : <Camera size={12} style={{ color: '#0A0A1F' }} />}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
              </div>

              {/* Name / email / level badge */}
              <div className="flex-1 min-w-0">
                <p className="text-text-white text-lg font-bold truncate">{profile.name || 'Student'}</p>
                <p className="text-text-disabled text-xs truncate">{profile.email}</p>
                <span className="inline-block mt-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                  {profile.education_level || 'Student'}
                </span>
              </div>
            </div>

            <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

            {/* District stat row */}
            <div className="mt-3 mb-2">
              <StatItem icon={MapPin} color="#00E5FF" label="District" value={profile.district || '—'} />
            </div>

            {/* Messages / Quizzes / Documents */}
            <div className="grid grid-cols-3 gap-3 mt-2">
              <StatItem icon={MessageSquare} color="#F59E0B" label="Messages" value={profile.total_messages} />
              <StatItem icon={BookOpen} color="#00E5FF" label="Quizzes" value={profile.total_quizzes} />
              <StatItem icon={FileText} color="#7C4DFF" label="Documents" value={profile.total_documents} />
            </div>

            {/* Course / Profession / Combination */}
            {isUniversity && profile.course && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <GraduationCap size={15} style={{ color: '#F59E0B' }} />
                <span className="text-text-disabled text-xs">Course: </span>
                <span className="text-text-white text-xs font-medium truncate">{profile.course}</span>
              </div>
            )}
            {isProfessional && profile.profession && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <Briefcase size={15} style={{ color: '#00E5FF' }} />
                <span className="text-text-disabled text-xs">Profession: </span>
                <span className="text-text-white text-xs font-medium truncate">{profile.profession}</span>
              </div>
            )}
            {isALevel && profile.combination && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <BookOpen size={15} style={{ color: '#7C4DFF' }} />
                <span className="text-text-disabled text-xs">Combination: </span>
                <span className="text-text-white text-xs font-medium truncate">{profile.combination}</span>
              </div>
            )}
            {profile.school && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <School size={15} style={{ color: '#F59E0B' }} />
                <span className="text-text-disabled text-xs">School: </span>
                <span className="text-text-white text-xs font-medium truncate">{profile.school}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── LOCATION & DISTRICT ── */}
        <div>
          <SectionLabel>📍 Location & District</SectionLabel>
          <Card>
            <div className="px-4 py-3.5 flex items-center gap-3">
              <IconBox icon={MapPin} color="#F59E0B" />
              <div className="flex-1 min-w-0">
                <p className="text-text-white text-sm font-medium">Change District</p>
                <input
                  value={districtInput}
                  onChange={e => setDistrictInput(e.target.value)}
                  placeholder="Enter your district"
                  className="mt-1 w-full text-xs rounded-lg px-3 py-1.5 outline-none focus:border-primary"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#F59E0B' }}
                />
              </div>
              <button onClick={saveDistrict} disabled={savingDistrict || districtInput.trim() === profile.district}
                className="px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 disabled:opacity-40"
                style={{ background: '#F59E0B', color: '#0A0A1F' }}>
                {savingDistrict ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
              </button>
            </div>
          </Card>
        </div>

        {/* ── EDUCATION ── */}
        <div>
          <SectionLabel>🎓 Education</SectionLabel>
          <Card>
            <div className="p-4 space-y-3">
              {/* Current badge */}
              <div className="flex items-center gap-2">
                <GraduationCap size={16} style={{ color: '#F59E0B' }} />
                <span className="text-text-disabled text-xs">Current:</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                  {profile.education_level || 'Not set'}
                </span>
              </div>

              {/* Level dropdown */}
              <select value={eduForm.level} onChange={e => { setEduForm(f => ({ ...f, level: e.target.value, school: '', combination: '', course: '', profession: '' })); setEduSaved(false) }}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>
                <option value="" disabled style={{ background: '#12122A' }}>Select level…</option>
                {EDUCATION_LEVELS.map(l => <option key={l} value={l} style={{ background: '#12122A' }}>{l}</option>)}
              </select>

              {/* Conditional fields */}
              {isALevel && (
                <input value={eduForm.combination} onChange={e => setEduForm(f => ({ ...f, combination: e.target.value }))}
                  placeholder="Subject Combination (e.g. PCB, HEG)"
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
              )}
              {isUniversity && (
                <input value={eduForm.course} onChange={e => setEduForm(f => ({ ...f, course: e.target.value }))}
                  placeholder="University Course"
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
              )}
              {isProfessional && (
                <input value={eduForm.profession} onChange={e => setEduForm(f => ({ ...f, profession: e.target.value }))}
                  placeholder="Your Profession"
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
              )}
              {showSchool && (
                <input value={eduForm.school} onChange={e => setEduForm(f => ({ ...f, school: e.target.value }))}
                  placeholder="School (Optional)"
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
              )}

              {eduChanged && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(245,158,11,0.08)' }}>
                  <Info size={13} style={{ color: '#F59E0B' }} />
                  <p className="text-text-disabled text-xs">Changing your level updates your subjects, AI tutor context and timetable subjects.</p>
                </div>
              )}

              <button onClick={saveEducation} disabled={!eduChanged || savingEdu}
                className="w-full h-11 rounded-xl font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: eduChanged ? '#F59E0B' : 'rgba(255,255,255,0.06)', color: eduChanged ? '#0A0A1F' : '#666' }}>
                {savingEdu ? <Loader2 size={14} className="animate-spin" /> : null}
                {eduSaved ? '✓ Saved!' : eduChanged ? 'Save Changes' : 'No Changes'}
              </button>
            </div>
          </Card>
        </div>

        {/* ── APPEARANCE ── */}
        <div>
          <SectionLabel>🎨 Appearance</SectionLabel>
          <Card>
            <div className="p-4">
              <p className="text-text-white text-sm font-medium">App Theme</p>
              <p className="text-text-disabled text-xs mb-3">Changes the colour scheme across the entire app</p>
              <div className="flex gap-2">
                {THEMES.map(theme => {
                  const [bg, c1, c2] = THEME_COLORS[theme]
                  const active = (settings.app_theme || 'DEEP_SPACE') === theme
                  return (
                    <button key={theme} onClick={() => saveSetting('app_theme', theme)}
                      className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-11 h-11 rounded-xl relative overflow-hidden"
                        style={{ background: bg, border: active ? `2.5px solid #F59E0B` : '1px solid rgba(255,255,255,0.1)' }}>
                        <div className="absolute bottom-1 left-1 w-3 h-3 rounded-full" style={{ background: c1 }} />
                        <div className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: c2 }} />
                        {active && <div className="absolute inset-0 flex items-center justify-center"><span className="text-primary text-xs font-bold">✓</span></div>}
                      </div>
                      <span className="text-xs" style={{ color: active ? '#F59E0B' : '#666', fontWeight: active ? 700 : 400 }}>
                        {theme.split('_')[0]}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </Card>
        </div>

        {/* ── VOICE & AUDIO ── */}
        <div>
          <SectionLabel>🎙️ Voice & Audio</SectionLabel>
          <Card>
            <ToggleRow icon={Mic} color="#F59E0B" title="Voice Input" subtitle="Speak your questions to the AI" value={!!settings.voice_enabled} onChange={v => saveSetting('voice_enabled', v)} />
            <Divider />
            <ToggleRow icon={Volume2} color="#00E5FF" title="Auto-Read Responses" subtitle="AI reads answers aloud automatically" value={!!settings.auto_read_enabled} onChange={v => saveSetting('auto_read_enabled', v)} />
            <Divider />
            <ToggleRow icon={Bell} color="#7C4DFF" title="Quiz Sound Effects" subtitle="Play sounds on correct/wrong answers" value={!!settings.quiz_sound_enabled} onChange={v => saveSetting('quiz_sound_enabled', v)} />
          </Card>
        </div>

        {/* ── NOTIFICATIONS ── */}
        <div>
          <SectionLabel>🔔 Notifications</SectionLabel>
          <Card>
            <ToggleRow icon={Bell} color="#F59E0B" title="Push Notifications" subtitle="Get updates and announcements" value={!!settings.notifications_enabled} onChange={v => saveSetting('notifications_enabled', v)} />
            <Divider />
            <ToggleRow icon={BellRing} color="#00E5FF" title="Study Reminders" subtitle="Daily reminders to keep learning" value={!!settings.study_reminders_enabled} onChange={v => saveSetting('study_reminders_enabled', v)} />
          </Card>
        </div>

        {/* ── LEARNING ── */}
        <div>
          <SectionLabel>📚 Learning</SectionLabel>
          <Card>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <IconBox icon={BookOpen} color="#F59E0B" />
              <div className="flex-1 min-w-0">
                <p className="text-text-white text-sm font-medium">Quiz Difficulty</p>
                <p className="text-text-disabled text-xs">Adjusts quiz complexity</p>
              </div>
              <select value={settings.quiz_difficulty || 'adaptive'} onChange={e => saveSetting('quiz_difficulty', e.target.value)}
                className="text-xs rounded-lg px-2 py-1.5 outline-none"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#F59E0B' }}>
                {DIFFICULTIES.map(d => <option key={d} value={d} style={{ background: '#12122A' }}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
            </div>
            <Divider />
            <NavRow icon={BarChart2} color="#7C4DFF" title="Learning Progress" subtitle="View your stats and achievements" onClick={() => navigate('/progress')} />
            <Divider />
            <NavRow icon={Calendar} color="#F59E0B" title="Study Timetable" subtitle="Schedule your weekly study sessions" onClick={() => navigate('/timetable')} />
            <Divider />
            <NavRow icon={Download} color="#00E676" title="Offline Mode" subtitle="Coming soon" onClick={() => {}} badge="Soon" />
          </Card>
        </div>

        {/* ── ABOUT ── */}
        <div>
          <SectionLabel>ℹ️ About</SectionLabel>
          <Card>
            <NavRow icon={Info} color="#00E5FF" title="App Version" subtitle="TutorUG v1.0.0" onClick={() => {}} />
            <Divider />
            <NavRow icon={Shield} color="#F59E0B" title="Privacy Policy" subtitle="How we protect your data" onClick={() => navigate('/privacy')} />
            <Divider />
            <NavRow icon={FileCheck} color="#7C4DFF" title="Terms of Service" subtitle="Usage terms and conditions" onClick={() => navigate('/terms')} />
            <Divider />
            <NavRow icon={Star} color="#F59E0B" title="Rate TutorUG" subtitle="Help us improve with your feedback" onClick={() => {}} />
            <Divider />
            <NavRow icon={Share2} color="#00E5FF" title="Share with Friends" subtitle="Invite fellow students to TutorUG" onClick={() => {}} />
          </Card>
        </div>

        {/* ── ACCOUNT ── */}
        <div>
          <SectionLabel>⚠️ Account</SectionLabel>
          <Card>
            {/* Change password */}
            <div className="px-4 py-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Lock size={15} className="text-text-disabled" />
                <p className="text-text-white text-sm font-medium">Change Password</p>
              </div>
              {pwdError && <p className="text-xs text-error bg-error/10 rounded-xl px-3 py-2">{pwdError}</p>}
              {pwdSuccess && <p className="text-xs text-lime bg-lime/10 rounded-xl px-3 py-2">Password changed successfully!</p>}
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} value={pwdForm.newPwd}
                  onChange={e => setPwdForm(f => ({ ...f, newPwd: e.target.value }))}
                  placeholder="New password"
                  className="w-full rounded-xl px-3 py-2.5 pr-10 text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-disabled">
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <input type="password" value={pwdForm.confirm}
                onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))}
                placeholder="Confirm new password"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
              <button onClick={changePassword} disabled={pwdLoading || !pwdForm.newPwd}
                className="flex items-center gap-2 py-2 px-5 rounded-xl text-sm font-bold disabled:opacity-40"
                style={{ background: '#F59E0B', color: '#0A0A1F' }}>
                {pwdLoading ? <Loader2 size={13} className="animate-spin" /> : null} Update Password
              </button>
            </div>

            <Divider />

            {/* Sign out row */}
            <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer" onClick={() => setShowLogout(true)}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(239,68,68,0.15)' }}>
                <LogOut size={18} style={{ color: '#EF4444' }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: '#EF4444' }}>Sign Out</p>
                <p className="text-text-disabled text-xs">Sign out of your account</p>
              </div>
              <ChevronRight size={16} style={{ color: 'rgba(239,68,68,0.5)' }} />
            </div>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center space-y-0.5 pb-6">
          <p className="text-text-disabled text-xs">TutorUG • Uganda's Smart Learning Companion 🇺🇬</p>
          <p className="text-text-disabled text-xs">Made with ❤️ for Ugandan Students</p>
        </div>
      </div>

      {/* ── LOGOUT DIALOG ── */}
      {showLogout && (
        <div className="fixed inset-0 bg-black/65 flex items-center justify-center z-50 p-6">
          <div className="rounded-2xl p-6 w-full max-w-xs text-center" style={{ background: '#12122A' }}>
            <div className="w-13 h-13 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(239,68,68,0.15)', width: 52, height: 52 }}>
              <LogOut size={24} style={{ color: '#EF4444' }} />
            </div>
            <p className="text-text-white font-bold text-lg mb-1">Sign Out?</p>
            <p className="text-text-disabled text-sm mb-5">You will need to sign in again to access your learning progress.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogout(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold border"
                style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#999' }}>Cancel</button>
              <button onClick={handleLogout}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: '#EF4444', color: '#fff' }}>Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
