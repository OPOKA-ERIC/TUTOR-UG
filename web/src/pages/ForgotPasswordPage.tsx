import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { SUPABASE_URL, SUPABASE_ANON } from '@/lib/supabase'
import Logo from '@/components/Logo'

type Step = 'email' | 'otp' | 'newpwd' | 'done'

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function sendOtp() {
    setError(''); setLoading(true)
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}` },
      body: JSON.stringify({ email: email.trim() }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) setError(data.error || 'Failed to send OTP')
    else setStep('otp')
  }

  async function verifyOtp() {
    setError(''); setLoading(true)
    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}` },
      body: JSON.stringify({ email: email.trim(), otp_code: otp.trim() }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) setError(data.error || 'Invalid OTP')
    else setStep('newpwd')
  }

  async function resetPassword() {
    if (newPwd.length < 6) { setError('Password must be at least 6 characters'); return }
    setError(''); setLoading(true)
    const res = await fetch(`${SUPABASE_URL}/functions/v1/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}` },
      body: JSON.stringify({ email: email.trim(), new_password: newPwd }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) setError(data.error || 'Failed to reset password')
    else setStep('done')
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8"><Logo size="lg" /></div>
        <div className="card">
          <Link to="/login" className="flex items-center gap-1 text-text-disabled text-sm hover:text-text-light mb-5">
            <ArrowLeft size={16} /> Back to login
          </Link>

          {error && <div className="bg-error/10 border border-error/30 rounded-xl p-3 mb-4 text-error text-sm">{error}</div>}

          {step === 'email' && <>
            <h2 className="text-text-white text-xl font-bold mb-2">Reset Password</h2>
            <p className="text-text-disabled text-sm mb-5">Enter your email and we'll send you a 6-digit code.</p>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com" className="input-field mb-4" />
            <button onClick={sendOtp} disabled={loading || !email} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <Loader2 size={18} className="animate-spin" /> : null} Send Code
            </button>
          </>}

          {step === 'otp' && <>
            <h2 className="text-text-white text-xl font-bold mb-2">Enter OTP</h2>
            <p className="text-text-disabled text-sm mb-5">We sent a 6-digit code to <span className="text-primary">{email}</span>. It expires in 15 minutes.</p>
            <input value={otp} onChange={e => setOtp(e.target.value)} maxLength={6}
              placeholder="123456" className="input-field mb-4 text-center text-2xl tracking-widest" />
            <button onClick={verifyOtp} disabled={loading || otp.length < 6} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <Loader2 size={18} className="animate-spin" /> : null} Verify Code
            </button>
          </>}

          {step === 'newpwd' && <>
            <h2 className="text-text-white text-xl font-bold mb-2">New Password</h2>
            <p className="text-text-disabled text-sm mb-5">Choose a strong new password.</p>
            <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)}
              placeholder="Min 6 characters" className="input-field mb-4" />
            <button onClick={resetPassword} disabled={loading || newPwd.length < 6} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <Loader2 size={18} className="animate-spin" /> : null} Reset Password
            </button>
          </>}

          {step === 'done' && <>
            <div className="text-center py-4">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-lime text-xl font-bold mb-2">Password Reset!</h2>
              <p className="text-text-disabled text-sm mb-5">You can now log in with your new password.</p>
              <Link to="/login" className="btn-primary inline-block">Go to Login</Link>
            </div>
          </>}
        </div>
      </div>
    </div>
  )
}
