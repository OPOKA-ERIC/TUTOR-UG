import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/types'

interface AuthCtx {
  profile: UserProfile | null
  loading: boolean
  login: (email: string, password: string) => Promise<string | null>
  register: (email: string, password: string, profile: Partial<UserProfile>) => Promise<string | null>
  signInWithGoogle: () => Promise<string | null>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single()
    if (data) setProfile(data as UserProfile)
  }

  async function ensureProfile(user: import('@supabase/supabase-js').User) {
    const { data: existing } = await supabase
      .from('users')
      .select('user_id')
      .eq('user_id', user.id)
      .single()
    if (existing) return
    const meta = user.user_metadata
    const { error: profileError } = await supabase.from('users').insert({
      user_id: user.id,
      email: user.email || '',
      name: meta?.full_name || meta?.name || user.email?.split('@')[0] || 'Student',
      avatar_url: meta?.avatar_url || '',
      district: '', region: '', education_level: '',
      school: '', combination: '', course: '', profession: '',
      total_messages: 0, total_quizzes: 0,
      total_documents: 0, streak_days: 0,
    })
    if (!profileError) {
      await supabase.from('user_settings').insert({
        user_id: user.id, voice_enabled: true, auto_read_enabled: false,
        quiz_sound_enabled: true, notifications_enabled: true,
        study_reminders_enabled: true, quiz_difficulty: 'adaptive',
        app_theme: 'DEEP_SPACE', language: 'en',
        updated_at: new Date().toISOString(),
      })
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        ensureProfile(data.session.user).then(() => fetchProfile(data.session.user.id).finally(() => setLoading(false)))
      } else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        if (event === 'SIGNED_IN') await ensureProfile(session.user)
        await fetchProfile(session.user.id)
      } else setProfile(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function login(email: string, password: string): Promise<string | null> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return parseError(error.message)
    if (data.user) await fetchProfile(data.user.id)
    return null
  }

  async function register(email: string, password: string, prof: Partial<UserProfile>): Promise<string | null> {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return parseError(error.message)
    const userId = data.user?.id
    if (!userId) return 'Registration failed. Please try again.'
    const { error: profileError } = await supabase.from('users').insert({
      user_id: userId, email, name: prof.name || '',
      district: prof.district || '', region: prof.region || '',
      education_level: prof.education_level || '',
      school: prof.school || '', combination: prof.combination || '',
      course: prof.course || '', profession: prof.profession || '',
      avatar_url: '', total_messages: 0, total_quizzes: 0,
      total_documents: 0, streak_days: 0,
    })
    if (profileError) return profileError.message
    await supabase.from('user_settings').insert({
      user_id: userId, voice_enabled: true, auto_read_enabled: false,
      quiz_sound_enabled: true, notifications_enabled: true,
      study_reminders_enabled: true, quiz_difficulty: 'adaptive',
      app_theme: 'DEEP_SPACE', language: 'en',
      updated_at: new Date().toISOString(),
    })
    return null
  }

  async function signInWithGoogle(): Promise<string | null> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    return error?.message || null
  }

  async function logout() {
    await supabase.auth.signOut()
    setProfile(null)
  }

  async function refreshProfile() {
    const { data } = await supabase.auth.getUser()
    if (data.user) await fetchProfile(data.user.id)
  }

  function parseError(msg: string): string {
    if (msg.includes('already registered')) return 'This email is already registered.'
    if (msg.includes('Invalid login')) return 'Incorrect email or password.'
    if (msg.includes('password')) return 'Password must be at least 6 characters.'
    return 'Something went wrong. Please try again.'
  }

  return (
    <AuthContext.Provider value={{ profile, loading, login, register, signInWithGoogle, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
