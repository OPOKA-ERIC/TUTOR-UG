import { getDbHeaders, getSupabaseUrl } from '../utils/supabase-admin.js'
import { buildOtpEmail } from '../utils/email.js'

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const { email: rawEmail } = req.body
    if (!rawEmail) return res.status(400).json({ error: 'Email is required' })

    const email = rawEmail.trim().toLowerCase()
    const supabaseUrl = getSupabaseUrl()
    const dbHeaders = getDbHeaders()
    const resendKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev'

    const authResp = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      { headers: dbHeaders }
    )
    const authData = await authResp.json()
    const authUser = authData?.users?.[0]
    if (!authUser) {
      return res.status(404).json({ error: 'No account found with this email address.' })
    }

    const profileResp = await fetch(
      `${supabaseUrl}/rest/v1/users?user_id=eq.${authUser.id}&select=name&limit=1`,
      { headers: dbHeaders }
    )
    const profiles = await profileResp.json()
    const userName = profiles?.[0]?.name || 'Student'

    await fetch(
      `${supabaseUrl}/rest/v1/password_reset_otps?email=eq.${encodeURIComponent(email)}&used=eq.false`,
      {
        method: 'PATCH',
        headers: { ...dbHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify({ used: true }),
      }
    )

    const otpCode = generateOtp()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    const insertResp = await fetch(`${supabaseUrl}/rest/v1/password_reset_otps`, {
      method: 'POST',
      headers: { ...dbHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify({ email, otp_code: otpCode, expires_at: expiresAt, used: false }),
    })
    if (!insertResp.ok) throw new Error('Failed to store OTP')

    const emailResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `TutorUG <${fromEmail}>`,
        to: [email],
        subject: 'Your TutorUG Password Reset Code',
        html: buildOtpEmail(userName, otpCode),
      }),
    })
    if (!emailResp.ok) {
      const err = await emailResp.text()
      throw new Error(`Failed to send email: ${err}`)
    }

    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
