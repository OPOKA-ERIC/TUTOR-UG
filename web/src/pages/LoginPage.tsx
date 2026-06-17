import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Mail, Lock } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import Logo from '@/components/Logo'

export default function LoginPage() {
  const { login } = useAuth()
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
    const err = await login(email.trim(), password)
    setLoading(false)
    if (err) setError(err)
    else navigate('/chat')
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
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
            <Logo size="sm" />
          </div>
          <h1 className="text-text-white text-3xl font-bold">Welcome Back! 👋</h1>
          <p className="text-text-disabled mt-2 text-sm">Sign in to continue learning</p>
        </div>

        {/* Card */}
        <div className="bg-surface rounded-3xl p-6">
          {error && (
            <div className="bg-error/10 border border-error/30 rounded-xl p-3 mb-5 text-error text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-text-disabled text-xs font-semibold uppercase mb-2 block">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com" required
                  className="input-field pl-10" />
              </div>
            </div>

            <div>
              <label className="text-text-disabled text-xs font-semibold uppercase mb-2 block">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                <input type={showPwd ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required className="input-field pl-10 pr-11" />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-light">
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="text-right">
              <Link to="/forgot-password" className="text-primary text-sm font-medium hover:underline">
                Forgot Password?
              </Link>
            </div>

            <button type="submit" disabled={!canLogin}
              className="w-full h-13 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all"
              style={{
                background: canLogin ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'linear-gradient(135deg, #252545, #252545)',
                color: canLogin ? '#0A0A1F' : '#606080',
                height: '52px',
              }}>
              {loading ? <Loader2 size={20} className="animate-spin" /> : 'Sign In'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-outline" />
            <span className="text-text-disabled text-sm">or</span>
            <div className="flex-1 h-px bg-outline" />
          </div>

          <Link to="/register"
            className="w-full h-13 rounded-2xl font-semibold text-base flex items-center justify-center transition-all"
            style={{
              border: '1.5px solid',
              borderColor: 'rgba(255,184,0,0.5)',
              color: '#FFB800',
              height: '52px',
            }}>
            Create New Account
          </Link>
        </div>

        <p className="text-center text-text-disabled text-sm mt-6">🇺🇬 Empowering Ugandan Students</p>
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
