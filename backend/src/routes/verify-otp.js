import { isEmail, fail } from '../utils/validate.js'
import { getDbHeaders, getSupabaseUrl } from '../utils/supabase-admin.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const { email: rawEmail, otp_code } = req.body
    if (!isEmail(rawEmail)) return fail(res, 'A valid email address is required.')
    if (typeof otp_code !== 'string' || !/^\d{6}$/.test(otp_code.trim())) {
      return fail(res, 'A valid 6-digit code is required.')
    }

    const email = rawEmail.trim().toLowerCase()
    const supabaseUrl = getSupabaseUrl()
    const dbHeaders = getDbHeaders()

    const resp = await fetch(
      `${supabaseUrl}/rest/v1/password_reset_otps?email=eq.${encodeURIComponent(email)}&used=eq.false&order=created_at.desc&limit=1`,
      { headers: dbHeaders }
    )
    const rows = await resp.json()

    if (!Array.isArray(rows) || rows.length === 0) {
      return fail(res, 'No active OTP found. Please request a new one.')
    }

    const record = rows[0]

    if (new Date() > new Date(record.expires_at)) {
      return fail(res, 'OTP has expired. Please request a new one.')
    }

    if (record.otp_code !== otp_code.trim()) {
      return fail(res, 'Incorrect OTP. Please try again.')
    }

    await fetch(
      `${supabaseUrl}/rest/v1/password_reset_otps?id=eq.${record.id}`,
      {
        method: 'PATCH',
        headers: { ...dbHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify({ used: true }),
      }
    )

    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}