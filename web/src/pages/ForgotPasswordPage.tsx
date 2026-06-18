import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Mail, Lock, KeyRound } from 'lucide-react'
import { SUPABASE_URL, SUPABASE_ANON } from '@/lib/supabase'
import Logo from '@/components/Logo'

type Step = 'email' | 'otp' | 'newpwd' | 'done'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [resendMsg, setResendMsg] = useState('')

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

  async function resendOtp() {
    setResendMsg(''); setError(''); setResending(true)
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}` },
      body: JSON.stringify({ email: email.trim() }),
    })
    setResending(false)
    setOtp('')
    setResendMsg(res.ok ? 'New code sent!' : 'Failed to resend. Try again.')
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
    <div className="min-h-screen bg-gradient-to-b from-surface to-bg relative overflow-hidden flex flex-col items-center">
      <div className="max-w-3xl mx-auto w-full flex flex-col h-full">

      {/* Top bar */}
      <div className="bg-gradient-to-r from-surface to-surface-var px-2 py-2 flex items-center gap-1">
        <button onClick={() => navigate('/login')}
          className="w-12 h-12 flex items-center justify-center shrink-0">
          <div className="w-9 h-9 bg-surface-input rounded-full flex items-center justify-center">
            <ArrowLeft size={18} className="text-text-white" />
          </div>
        </button>
        <Logo size="sm" />
        <span className="text-text-white text-xl font-bold ml-2">Reset Password</span>
      </div>

      <div className="px-6 py-6 max-w-md mx-auto">

        {/* Error toast */}
        {error && (
          <div className="bg-error/10 border border-error/30 rounded-xl p-3 mb-5 text-error text-sm">{error}</div>
        )}
        {resendMsg && (
          <div className="bg-lime/10 border border-lime/30 rounded-xl p-3 mb-5 text-lime text-sm">{resendMsg}</div>
        )}

        {/* ── EMAIL STEP ── */}
        {step === 'email' && (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div className="w-18 h-18 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(255,184,0,0.12)', width: 72, height: 72 }}>
                <Lock size={36} className="text-primary" />
              </div>
            </div>
            <div>
              <h2 className="text-text-white text-2xl font-bold">Forgot your password?</h2>
              <p className="text-text-disabled text-sm mt-2 leading-relaxed">
                Enter the email address linked to your account and we'll send you a 6-digit reset code.
              </p>
            </div>
            <div>
              <label className="text-text-disabled text-xs font-semibold uppercase mb-1.5 block">Email Address</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError('') }}
                  placeholder="your@email.com" className="input-field pl-10" />
              </div>
            </div>
            <button onClick={sendOtp} disabled={loading || !email.trim()}
              className="w-full h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all"
              style={{
                background: email.trim() && !loading ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'linear-gradient(135deg, #252545, #252545)',
                color: email.trim() && !loading ? '#0A0A1F' : '#606080',
              }}>
              {loading ? <Loader2 size={20} className="animate-spin" /> : 'Send Reset Code'}
            </button>
          </div>
        )}

        {/* ── OTP STEP ── */}
        {step === 'otp' && (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div className="rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(255,184,0,0.12)', width: 72, height: 72 }}>
                <Mail size={36} className="text-primary" />
              </div>
            </div>
            <div>
              <h2 className="text-text-white text-2xl font-bold">Check your email</h2>
              <p className="text-text-disabled text-sm mt-2 leading-relaxed">
                We sent a 6-digit code to <span className="text-primary font-medium">{email}</span>. It expires in 15 minutes.
              </p>
            </div>
            <div>
              <label className="text-text-disabled text-xs font-semibold uppercase mb-1.5 block">6-Digit Code</label>
              <div className="relative">
                <KeyRound size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                <input value={otp} onChange={e => { if (e.target.value.length <= 6 && /^\d*$/.test(e.target.value)) { setOtp(e.target.value); setError('') } }}
                  placeholder="000000" maxLength={6} inputMode="numeric"
                  className="input-field pl-10 text-center text-2xl tracking-widest" />
              </div>
            </div>
            <button onClick={verifyOtp} disabled={loading || otp.length < 6}
              className="w-full h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all"
              style={{
                background: otp.length === 6 && !loading ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'linear-gradient(135deg, #252545, #252545)',
                color: otp.length === 6 && !loading ? '#0A0A1F' : '#606080',
              }}>
              {loading ? <Loader2 size={20} className="animate-spin" /> : 'Verify Code'}
            </button>
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="text-text-disabled">Didn't receive it?</span>
              {resending
                ? <Loader2 size={14} className="animate-spin text-primary" />
                : <button onClick={resendOtp} className="text-primary font-semibold hover:underline">Resend Code</button>}
            </div>
          </div>
        )}

        {/* ── NEW PASSWORD STEP ── */}
        {step === 'newpwd' && (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div className="rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(255,184,0,0.12)', width: 72, height: 72 }}>
                <Lock size={36} className="text-primary" />
              </div>
            </div>
            <div>
              <h2 className="text-text-white text-2xl font-bold">New Password</h2>
              <p className="text-text-disabled text-sm mt-2">Choose a strong new password.</p>
            </div>
            <div>
              <label className="text-text-disabled text-xs font-semibold uppercase mb-1.5 block">New Password</label>
              <input type="password" value={newPwd} onChange={e => { setNewPwd(e.target.value); setError('') }}
                placeholder="Min 6 characters" className="input-field" />
            </div>
            <button onClick={resetPassword} disabled={loading || newPwd.length < 6}
              className="w-full h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all"
              style={{
                background: newPwd.length >= 6 && !loading ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'linear-gradient(135deg, #252545, #252545)',
                color: newPwd.length >= 6 && !loading ? '#0A0A1F' : '#606080',
              }}>
              {loading ? <Loader2 size={20} className="animate-spin" /> : 'Reset Password'}
            </button>
          </div>
        )}

        {/* ── DONE STEP ── */}
        {step === 'done' && (
          <div className="flex flex-col items-center text-center py-8 gap-4">
            <div className="text-6xl">✅</div>
            <h2 className="text-lime text-2xl font-bold">Password Reset!</h2>
            <p className="text-text-disabled text-sm">You can now log in with your new password.</p>
            <button onClick={() => navigate('/login')}
              className="w-full h-14 rounded-2xl font-bold text-base mt-2"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#0A0A1F' }}>
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
    </div>
  )
}
