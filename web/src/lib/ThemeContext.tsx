import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'

// ── Theme token maps — mirrors Android AppTheme exactly ──────────────────────
const THEMES: Record<string, Record<string, string>> = {
  DEEP_SPACE: {
    '--color-bg':           '#0A0A1F',
    '--color-surface':      '#12122A',
    '--color-surface-var':  '#1A1A3A',
    '--color-surface-card': '#1E1E40',
    '--color-surface-input':'#252545',
    '--color-primary':      '#FFB800',
    '--color-primary-dark': '#E6A500',
    '--color-secondary':    '#7C3AED',
    '--color-tertiary':     '#6D28D9',
    '--color-outline':      '#2A2A4A',
    '--color-bar-start':    '#12122A',
    '--color-bar-end':      '#1A1A3A',
  },
  MIDNIGHT: {
    '--color-bg':           '#000000',
    '--color-surface':      '#0D0D0D',
    '--color-surface-var':  '#1A1A1A',
    '--color-surface-card': '#1F1F1F',
    '--color-surface-input':'#252525',
    '--color-primary':      '#FFB800',
    '--color-primary-dark': '#E6A500',
    '--color-secondary':    '#00E5FF',
    '--color-tertiary':     '#00BCD4',
    '--color-outline':      '#2A2A2A',
    '--color-bar-start':    '#0D0D0D',
    '--color-bar-end':      '#1A1A1A',
  },
  FOREST: {
    '--color-bg':           '#050F05',
    '--color-surface':      '#0A1A0A',
    '--color-surface-var':  '#122212',
    '--color-surface-card': '#162816',
    '--color-surface-input':'#1C301C',
    '--color-primary':      '#00E676',
    '--color-primary-dark': '#00C853',
    '--color-secondary':    '#FFB800',
    '--color-tertiary':     '#E6A500',
    '--color-outline':      '#1A3A1A',
    '--color-bar-start':    '#0A1A0A',
    '--color-bar-end':      '#122212',
  },
  OCEAN: {
    '--color-bg':           '#020D1A',
    '--color-surface':      '#051525',
    '--color-surface-var':  '#0A1F35',
    '--color-surface-card': '#0D2540',
    '--color-surface-input':'#102B4A',
    '--color-primary':      '#00E5FF',
    '--color-primary-dark': '#00B8D4',
    '--color-secondary':    '#FFB800',
    '--color-tertiary':     '#E6A500',
    '--color-outline':      '#0A2A3A',
    '--color-bar-start':    '#051525',
    '--color-bar-end':      '#0A1F35',
  },
  SUNSET: {
    '--color-bg':           '#100500',
    '--color-surface':      '#1A0A00',
    '--color-surface-var':  '#251200',
    '--color-surface-card': '#2D1500',
    '--color-surface-input':'#351A00',
    '--color-primary':      '#FF6B35',
    '--color-primary-dark': '#E55A25',
    '--color-secondary':    '#FFB800',
    '--color-tertiary':     '#E6A500',
    '--color-outline':      '#3A1A00',
    '--color-bar-start':    '#1A0A00',
    '--color-bar-end':      '#251200',
  },
}

function applyTheme(themeName: string) {
  const tokens = THEMES[themeName] ?? THEMES.DEEP_SPACE
  const root = document.documentElement
  Object.entries(tokens).forEach(([k, v]) => root.style.setProperty(k, v))
}

// ── Context ───────────────────────────────────────────────────────────────────
interface ThemeCtx {
  theme: string
  setTheme: (t: string) => void
}

const ThemeContext = createContext<ThemeCtx>({ theme: 'DEEP_SPACE', setTheme: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [theme, setThemeState] = useState('DEEP_SPACE')

  // Load saved theme from DB when user logs in
  useEffect(() => {
    if (!profile) return
    supabase
      .from('user_settings')
      .select('app_theme')
      .eq('user_id', profile.user_id)
      .single()
      .then(({ data }) => {
        const saved = data?.app_theme ?? 'DEEP_SPACE'
        setThemeState(saved)
        applyTheme(saved)
      })
  }, [profile?.user_id])

  // Apply on mount with whatever is current
  useEffect(() => { applyTheme(theme) }, [theme])

  function setTheme(t: string) {
    setThemeState(t)
    applyTheme(t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() { return useContext(ThemeContext) }
