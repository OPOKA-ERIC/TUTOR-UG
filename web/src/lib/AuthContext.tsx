import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase, SUPABASE_URL, SUPABASE_ANON } from '@/lib/supabase'
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
    const { data } = await supabase.rpc('get_own_profile')
    if (data && Array.isArray(data) && data.length > 0) {
      setProfile(data[0] as UserProfile)
    } else {
      // No profile row yet — create a minimal one so the app doesn't get stuck
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const minimal = {
          user_id: userId,
          email: user.email || '',
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Student',
          avatar_url: user.user_metadata?.avatar_url || '',
          role: 'student',
          district: '', region: '', education_level: '',
          school: '', combination: '', course: '', profession: '',
          total_messages: 0, total_quizzes: 0, total_documents: 0, streak_days: 0,
        }
        try { await supabase.from('users').insert(minimal) } catch {}
        setProfile(minimal as any)
      }
    }
  }

  async function ensureProfile(user: import('@supabase/supabase-js').User) {
    const { data: existing } = await supabase
      .from('users')
      .select('user_id')
      .eq('user_id', user.id)
      .single()
    if (existing) return
    const meta = user.user_metadata
    await supabase.from('users').insert({
      user_id: user.id,
      email: user.email || '',
      name: meta?.full_name || meta?.name || user.email?.split('@')[0] || 'Student',
      avatar_url: meta?.avatar_url || '',
      role: 'student',
      district: '', region: '', education_level: '',
      school: '', combination: '', course: '', profession: '',
      total_messages: 0, total_quizzes: 0,
      total_documents: 0, streak_days: 0,
    })
  }

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 5000)

    supabase.auth.getSession().then(({ data }) => {
      clearTimeout(timeout)
      if (data.session?.user) {
        ensureProfile(data.session.user)
          .then(() => fetchProfile(data.session.user.id))
          .catch(() => {})
          .finally(() => setLoading(false))
      } else setLoading(false)
    }).catch(() => { clearTimeout(timeout); setLoading(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        // auth-js awaits subscriber callbacks while holding its session lock, so any
        // blocking call here would deadlock setSession (login would hang). Defer.
        setTimeout(() => {
          const sync = async () => {
            if (event === 'SIGNED_IN') await ensureProfile(session.user).catch(() => {})
            await fetchProfile(session.user.id).catch(() => {})
          }
          void sync()
        }, 0)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })
    return () => { clearTimeout(timeout); subscription.unsubscribe() }
  }, [])

  async function login(email: string, password: string): Promise<string | null> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON,
        },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      })
      const data = await res.json()
      if (!res.ok) return parseError(data?.msg || data?.error_description || `HTTP ${res.status}`)
      const session = data as {
        access_token: string
        refresh_token: string
        expires_in: number
        token_type: string
      }
      if (!session.access_token) return 'Login response was missing an access token.'
      // Save with a second hard timeout: setSession validates the token via the
      // server, which on this app must not be blocked by our own subscriber (see handler).
      const saved = await new Promise<boolean>((resolve, reject) => {
        const c2 = setTimeout(() => reject(new Error('Sign-in is taking longer than usual. Please check your internet connection and try again.')), 20000)
        supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        }).then(() => { clearTimeout(c2); resolve(true) }).catch((err) => { clearTimeout(c2); reject(err) })
      })
      if (!saved) return 'Could not save your session. Please try again.'
      return null
    } catch (e: unknown) {
      if (e instanceof Error) {
        if (e.name === 'AbortError') return 'Login timed out. Please check your internet connection and try again.'
        return e.message
      }
      return 'Connection error. Please try again.'
    } finally {
      clearTimeout(timer)
    }
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
    return null
  }

  async function signInWithGoogle(): Promise<string | null> {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) return error.message
      return null
    } catch (e) {
      return e instanceof Error ? e.message : 'Failed to sign in with Google'
    }
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
