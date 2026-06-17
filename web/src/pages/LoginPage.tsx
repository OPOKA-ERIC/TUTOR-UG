import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Mail, Lock } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import Logo from '@/components/Logo'

export default function LoginPage() {
  const { login, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const err = await login(email.trim(), password)
      if (err) setError(err)
      else navigate('/chat')
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const canLogin = !loading && email.trim() !== '' && password !== ''

  return (
    <div className="min-h-screen bg-gradient-to-b from-surface to-bg flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative glows */}
      <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,184,0,0.1), transparent)' }} />
      <div className="absolute -bottom-16 -right-16 w-56 h-56 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.1), transparent)' }} />

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="flex flex-col items-center mb-4">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
            <Logo size="sm" />
          </div>
          <h1 className="text-text-white text-2xl font-bold">Welcome Back! 👋</h1>
          <p className="text-text-disabled mt-1 text-sm">Sign in to continue learning</p>
        </div>

        {/* Card */}
        <div className="bg-surface rounded-3xl p-5">
          {error && (
            <div className="bg-error/10 border border-error/30 rounded-xl p-2 mb-3 text-error text-xs">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-text-disabled text-xs font-semibold uppercase mb-1 block">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com" required
                  className="input-field pl-9" />
              </div>
            </div>

            <div>
              <label className="text-text-disabled text-xs font-semibold uppercase mb-1 block">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                <input type={showPwd ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required className="input-field pl-9 pr-10" />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-light">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="text-right">
              <Link to="/forgot-password" className="text-primary text-xs font-medium hover:underline">
                Forgot Password?
              </Link>
            </div>

            <button type="submit" disabled={!canLogin}
              className="w-full h-11 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
              style={{
                background: canLogin ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'linear-gradient(135deg, #252545, #252545)',
                color: canLogin ? '#0A0A1F' : '#606080',
              }}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : 'Sign In'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-3">
            <div className="flex-1 h-px bg-outline" />
            <span className="text-text-disabled text-xs">or</span>
            <div className="flex-1 h-px bg-outline" />
          </div>

          <button type="button" onClick={async () => { const err = await signInWithGoogle(); if (err) setError(err) }}
            className="w-full h-11 rounded-2xl font-semibold text-sm flex items-center justify-center gap-3 transition-all mb-3"
            style={{
              border: '1.5px solid',
              borderColor: 'rgba(255,255,255,0.12)',
              color: '#CCCCDD',
              background: 'rgba(255,255,255,0.04)',
            }}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 0 0 0 24c0 3.77.88 7.35 2.56 10.56l7.97-5.97z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Continue with Google
          </button>

          <Link to="/register"
            className="w-full h-11 rounded-2xl font-semibold text-sm flex items-center justify-center transition-all"
            style={{
              border: '1.5px solid',
              borderColor: 'rgba(255,184,0,0.5)',
              color: '#FFB800',
            }}>
            Create New Account
          </Link>
        </div>

        <p className="text-center text-text-disabled text-xs mt-3">🇺🇬 Empowering Ugandan Students</p>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl px-8 py-8 flex flex-col items-center gap-4">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-text-disabled text-sm">Signing you in...</p>
          </div>
        </div>
      )}
    </div>
  )
}
