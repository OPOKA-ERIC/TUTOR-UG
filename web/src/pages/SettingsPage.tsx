import { useState, useEffect, useRef } from 'react'
import { Loader2, Camera, Eye, EyeOff, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { SUPABASE_URL, SUPABASE_ANON } from '@/lib/supabase'
import { EDUCATION_LEVELS, REGIONS, getSubjectsForLevel } from '@/lib/constants'
import { ArrowLeft } from 'lucide-react'
import Logo from '@/components/Logo'
import type { UserSettings } from '@/types'

const THEMES = ['DEEP_SPACE','MIDNIGHT','FOREST','OCEAN','SUNSET']
const DIFFICULTIES = ['adaptive','easy','medium','hard']

export default function SettingsPage() {
  const { profile, logout, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [settings, setSettings] = useState<Partial<UserSettings>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [pwdForm, setPwdForm] = useState({ current: '', newPwd: '', confirm: '' })
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [pwdSuccess, setPwdSuccess] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [profileForm, setProfileForm] = useState({ name: '', district: '', region: '', education_level: '', school: '', combination: '', course: '', profession: '' })
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (profile) {
      setProfileForm({ name: profile.name, district: profile.district, region: profile.region, education_level: profile.education_level, school: profile.school, combination: profile.combination, course: profile.course, profession: profile.profession })
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
    const update = { [field]: value, user_id: profile.user_id, updated_at: new Date().toISOString() }
    setSettings(s => ({ ...s, [field]: value }))
    await supabase.from('user_settings').upsert(update, { onConflict: 'user_id' })
  }

  async function saveProfile() {
    if (!profile) return
    setSaving(true)
    await supabase.from('users').update(profileForm).eq('user_id', profile.user_id)
    await refreshProfile()
    setSaving(false)
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
    else { setPwdSuccess(true); setPwdForm({ current: '', newPwd: '', confirm: '' }) }
  }

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  if (!profile) return null

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!value)}
      className={`w-12 h-6 rounded-full transition-colors relative ${value ? 'bg-primary' : 'bg-outline'}`}>
      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${value ? 'translate-x-6' : 'translate-x-0.5'}`} />
    </button>
  )

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-surface to-bg">
      {/* TOP BAR */}
      <div className="bg-gradient-to-r from-surface to-surface-var px-2 py-2 flex items-center gap-1 shrink-0">
        <button onClick={() => navigate('/chat')} className="w-12 h-12 flex items-center justify-center shrink-0">
          <div className="w-9 h-9 bg-surface-input rounded-full flex items-center justify-center">
            <ArrowLeft size={18} className="text-text-white" />
          </div>
        </button>
        <Logo size="sm" />
        <span className="text-text-white font-bold text-xl ml-2">Settings</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* Avatar + Profile */}
        <div className="card">
          <h2 className="text-text-white font-bold mb-4">Profile</h2>
          <div className="flex items-center gap-4 mb-5">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                {profile.avatar_url
                  ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />
                  : <span className="text-primary text-2xl font-bold">{profile.name.charAt(0)}</span>}
              </div>
              <button onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-full flex items-center justify-center text-ink hover:bg-primary-dark transition-colors">
                {avatarUploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
            </div>
            <div>
              <p className="text-text-white font-semibold">{profile.name}</p>
              <p className="text-text-disabled text-sm">{profile.email}</p>
              <p className="text-text-disabled text-xs">{profile.education_level} · {profile.district}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-text-light text-xs mb-1 block">Full Name</label>
              <input value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} className="input-field text-sm" />
            </div>
            <div>
              <label className="text-text-light text-xs mb-1 block">District</label>
              <input value={profileForm.district} onChange={e => setProfileForm(f => ({ ...f, district: e.target.value }))} className="input-field text-sm" />
            </div>
            <div>
              <label className="text-text-light text-xs mb-1 block">Education Level</label>
              <select value={profileForm.education_level} onChange={e => setProfileForm(f => ({ ...f, education_level: e.target.value }))} className="input-field text-sm">
                {EDUCATION_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-text-light text-xs mb-1 block">School</label>
              <input value={profileForm.school} onChange={e => setProfileForm(f => ({ ...f, school: e.target.value }))} className="input-field text-sm" />
            </div>
          </div>
          <button onClick={saveProfile} disabled={saving} className="btn-primary mt-4 flex items-center gap-2 py-2 px-5 text-sm">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null} Save Profile
          </button>
        </div>

        {/* App settings */}
        <div className="card space-y-4">
          <h2 className="text-text-white font-bold">App Settings</h2>
          {[
            { label: 'Voice Enabled', key: 'voice_enabled' },
            { label: 'Auto-Read Responses', key: 'auto_read_enabled' },
            { label: 'Quiz Sound Effects', key: 'quiz_sound_enabled' },
            { label: 'Notifications', key: 'notifications_enabled' },
            { label: 'Study Reminders', key: 'study_reminders_enabled' },
          ].map(({ label, key }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-text-light text-sm">{label}</span>
              <Toggle value={!!(settings as any)[key]} onChange={v => saveSetting(key, v)} />
            </div>
          ))}

          <div className="flex items-center justify-between">
            <span className="text-text-light text-sm">Quiz Difficulty</span>
            <select value={settings.quiz_difficulty || 'adaptive'} onChange={e => saveSetting('quiz_difficulty', e.target.value)}
              className="bg-surface-input border border-outline rounded-lg px-3 py-1.5 text-text-white text-sm focus:outline-none focus:border-primary">
              {DIFFICULTIES.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
            </select>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-text-light text-sm">App Theme</span>
            <select value={settings.app_theme || 'DEEP_SPACE'} onChange={e => saveSetting('app_theme', e.target.value)}
              className="bg-surface-input border border-outline rounded-lg px-3 py-1.5 text-text-white text-sm focus:outline-none focus:border-primary">
              {THEMES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>

        {/* Change password */}
        <div className="card">
          <h2 className="text-text-white font-bold mb-4">Change Password</h2>
          {pwdError && <div className="bg-error/10 border border-error/30 rounded-xl p-3 mb-3 text-error text-sm">{pwdError}</div>}
          {pwdSuccess && <div className="bg-lime/10 border border-lime/30 rounded-xl p-3 mb-3 text-lime text-sm">Password changed successfully!</div>}
          <div className="space-y-3">
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={pwdForm.newPwd}
                onChange={e => setPwdForm(f => ({ ...f, newPwd: e.target.value }))}
                placeholder="New password" className="input-field pr-11 text-sm" />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-light">
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <input type="password" value={pwdForm.confirm}
              onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))}
              placeholder="Confirm new password" className="input-field text-sm" />
            <button onClick={changePassword} disabled={pwdLoading || !pwdForm.newPwd}
              className="btn-primary flex items-center gap-2 py-2 px-5 text-sm">
              {pwdLoading ? <Loader2 size={14} className="animate-spin" /> : null} Update Password
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="card">
          <h2 className="text-text-white font-bold mb-4">Your Stats</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { label: 'Messages', value: profile.total_messages },
              { label: 'Quizzes', value: profile.total_quizzes },
              { label: 'Documents', value: profile.total_documents },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-2xl font-black text-primary">{value}</p>
                <p className="text-text-disabled text-xs">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Logout */}
        <button onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-error/30 text-error hover:bg-error/10 transition-colors font-medium">
          <LogOut size={18} /> Sign Out
        </button>
        <div className="h-4" />
      </div>
    </div>
  )
}
